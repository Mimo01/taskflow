import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DraftsChip } from '@/components/app/DraftsChip';
import { readDraftFile, removeDraftFiles, stageDraftFile } from '@/lib/issue-draft-files';
import { useCreateModalStore } from '@/stores/create-modal.store';
import { type IssueDraft, useIssueDraftsStore } from '@/stores/issue-drafts.store';
import { lastStubProps } from '@/test/wiki-editor-stub';

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    epicNameFieldKey: 'customfield_10015',
  }),
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  }),
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('tok'),
}));
vi.mock('@/services/jira', () => ({
  createIssue: vi.fn(),
}));
vi.mock(
  '@/components/wiki-editor/WikiEditorLazy',
  async () => (await import('@/test/wiki-editor-stub')).wikiEditorLazyMock,
);
vi.mock('@/lib/upload-staged-files', () => ({
  uploadStagedFiles: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/issue-draft-files', () => ({
  stageDraftFile: vi.fn(),
  readDraftFile: vi.fn(),
  removeDraftFiles: vi.fn().mockResolvedValue(undefined),
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('CreateEpicDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIssueDraftsStore.setState({ drafts: {}, owner: null, saveFailed: false });
    vi.spyOn(useIssueDraftsStore.persist, 'hasHydrated').mockReturnValue(true);
    vi.mocked(stageDraftFile).mockImplementation(async (_id, f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      path: `p/${f.name}`,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('EPIC-04: submits createIssue with issuetype Epic, summary, and epicNameFieldKey', async () => {
    const { createIssue } = await import('@/services/jira');
    (createIssue as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '99', key: 'PROJ-99' });
    const { CreateEpicDialog } = await import('./CreateEpicDialog');
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={makeClient()}>
        <CreateEpicDialog open={true} onClose={onClose} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: /epic name/i }), {
      target: { value: 'My New Epic' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() =>
      expect(createIssue).toHaveBeenCalledWith(
        'https://jira.example.com',
        'tok',
        'PROJ',
        'My New Epic',
        expect.objectContaining({ issuetype: 'Epic', customfield_10015: 'My New Epic' }),
      ),
    );
  });

  it('EPIC-04: does not submit when epic name is empty', async () => {
    const { createIssue } = await import('@/services/jira');
    const { CreateEpicDialog } = await import('./CreateEpicDialog');
    render(
      <QueryClientProvider client={makeClient()}>
        <CreateEpicDialog open={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() => expect(createIssue).not.toHaveBeenCalled());
  });

  async function setup(onClose = vi.fn()) {
    const { createIssue } = await import('@/services/jira');
    (createIssue as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '9', key: 'PROJ-9' });
    const { uploadStagedFiles } = await import('@/lib/upload-staged-files');
    const { CreateEpicDialog } = await import('./CreateEpicDialog');
    render(
      <QueryClientProvider client={makeClient()}>
        <CreateEpicDialog open={true} onClose={onClose} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: /epic name/i }), {
      target: { value: 'E' },
    });
    return { createIssue: createIssue as ReturnType<typeof vi.fn>, uploadStagedFiles, onClose };
  }

  it('renders the full-preset editor with host config', async () => {
    await setup();
    expect(lastStubProps.current?.preset).toBe('full');
    expect(lastStubProps.current?.placeholder).toBe('Optional description');
    expect(lastStubProps.current?.['aria-label']).toBe('Description');
    expect(lastStubProps.current?.host?.staged).toBe(true);
    expect(lastStubProps.current?.host?.projectKey).toBe('PROJ');
  });

  it('passes the editor text as description, undefined when empty', async () => {
    const { createIssue } = await setup();
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1));
    expect(createIssue.mock.calls[0][4].description).toBeUndefined();
  });

  it('sends description text', async () => {
    const { createIssue } = await setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
      target: { value: 'h1. Hi' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() => expect(createIssue).toHaveBeenCalled());
    expect(createIssue.mock.calls[0][4].description).toBe('h1. Hi');
  });

  it('stages files via host.stageFile and removes chips', async () => {
    await setup();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    act(() => lastStubProps.current?.host?.stageFile?.(file));
    expect(screen.getByText('a.png')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    expect(screen.queryByText('a.png')).toBeNull();
  });

  it('Attach file routes the chosen file through the editor handle', async () => {
    await setup();
    const file = new File(['x'], 'b.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('create-epic-file-input'), { target: { files: [file] } });
    expect(screen.getByText('b.png')).toBeTruthy();
  });

  it('uploads staged files to the created epic, then closes', async () => {
    const { uploadStagedFiles, onClose } = await setup();
    const file = new File(['x'], 'a.png');
    act(() => lastStubProps.current?.host?.stageFile?.(file));
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(uploadStagedFiles).toHaveBeenCalledWith('https://jira.example.com', 'tok', 'PROJ-9', [
      file,
    ]);
  });

  it('does not call uploadStagedFiles with nothing staged', async () => {
    const { uploadStagedFiles, onClose } = await setup();
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(uploadStagedFiles).not.toHaveBeenCalled();
  });

  it('keeps the dialog open with an error and blocks a duplicate epic on upload failure', async () => {
    const { uploadStagedFiles, createIssue, onClose } = await setup();
    (uploadStagedFiles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['a.png']);
    act(() => lastStubProps.current?.host?.stageFile?.(new File(['x'], 'a.png')));
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await screen.findByText(/Issue created, but 1 file\(s\) failed to upload: a.png/);
    expect(onClose).not.toHaveBeenCalled();
    const btn = screen.getByRole('button', { name: /create epic/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(createIssue).toHaveBeenCalledTimes(1);
  });

  describe('Cmd+Enter submit', () => {
    it('Cmd+Enter in the name input submits once', async () => {
      const { createIssue } = await setup();
      fireEvent.keyDown(screen.getByRole('textbox', { name: /epic name/i }), {
        key: 'Enter',
        metaKey: true,
      });
      await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1));
    });

    it('Ctrl+Enter behaves the same', async () => {
      const { createIssue } = await setup();
      fireEvent.keyDown(screen.getByRole('textbox', { name: /epic name/i }), {
        key: 'Enter',
        ctrlKey: true,
      });
      await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1));
    });

    it('Cmd+Enter from the editor submits with the latest text', async () => {
      const { createIssue } = await setup();
      const editor = screen.getByRole('textbox', { name: 'Description' });
      fireEvent.change(editor, { target: { value: 'fresh' } });
      fireEvent.keyDown(editor, { key: 'Enter', metaKey: true });
      await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1));
      expect(createIssue.mock.calls[0][4].description).toBe('fresh');
    });

    it('Cmd+Enter with an empty name does not submit and focuses the name field', async () => {
      const { createIssue } = await setup();
      const name = screen.getByRole('textbox', { name: /epic name/i });
      fireEvent.change(name, { target: { value: '' } });
      const editor = screen.getByRole('textbox', { name: 'Description' });
      fireEvent.keyDown(editor, { key: 'Enter', metaKey: true });
      expect(createIssue).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(name);
    });

    it('Cmd+Enter does not create a second epic after created-with-error', async () => {
      const { uploadStagedFiles, createIssue } = await setup();
      (uploadStagedFiles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['a.png']);
      act(() => lastStubProps.current?.host?.stageFile?.(new File(['x'], 'a.png')));
      fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
      await screen.findByRole('alert');
      fireEvent.keyDown(screen.getByRole('textbox', { name: /epic name/i }), {
        key: 'Enter',
        metaKey: true,
      });
      expect(createIssue).toHaveBeenCalledTimes(1);
    });

    it('Cmd+Enter while pending does not submit again', async () => {
      const { createIssue } = await setup();
      createIssue.mockReturnValue(new Promise(() => {}));
      const name = screen.getByRole('textbox', { name: /epic name/i });
      fireEvent.keyDown(name, { key: 'Enter', metaKey: true });
      await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1));
      fireEvent.keyDown(name, { key: 'Enter', metaKey: true });
      expect(createIssue).toHaveBeenCalledTimes(1);
    });

    it('plain Enter in the editor never submits', async () => {
      const { createIssue } = await setup();
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Description' }), { key: 'Enter' });
      expect(createIssue).not.toHaveBeenCalled();
    });

    it('button tooltip shows Create Epic with keycaps', async () => {
      await setup();
      fireEvent.focus(screen.getByRole('button', { name: /create epic/i }));
      fireEvent.mouseEnter(screen.getByRole('button', { name: /create epic/i }));
      const tip = await screen.findByText('⌘', {}, { timeout: 2000 });
      expect(tip.tagName).toBe('KBD');
      expect(screen.getByText('↵')).toBeTruthy();
    });
  });

  describe('drafts', () => {
    const drafts = () => Object.values(useIssueDraftsStore.getState().drafts);
    const epicDraft = (over: Partial<IssueDraft> = {}): IssueDraft =>
      ({
        id: 'd1',
        kind: 'epic',
        updatedAt: 1,
        projectKey: 'PROJ',
        snapshot: { epicName: 'Placeholder epic', description: 'Placeholder text' },
        files: [],
        ...over,
      }) as IssueDraft;

    function renderDialog(props: { resumeDraftId?: string | null; onClose?: () => void } = {}) {
      const onClose = props.onClose ?? vi.fn();
      const ui = (open: boolean) => (
        <QueryClientProvider client={makeClient()}>
          <CreateEpicDialogRef.current
            open={open}
            onClose={onClose}
            resumeDraftId={props.resumeDraftId}
          />
        </QueryClientProvider>
      );
      const r = render(ui(true));
      return { ...r, onClose, setOpen: (o: boolean) => r.rerender(ui(o)) };
    }
    const CreateEpicDialogRef: { current: typeof import('./CreateEpicDialog').CreateEpicDialog } = {
      current: (() => null) as never,
    };
    beforeEach(async () => {
      CreateEpicDialogRef.current = (await import('./CreateEpicDialog')).CreateEpicDialog;
    });

    it('keeps a draft with kind epic when closed with content, no prompt', async () => {
      const { onClose } = renderDialog();
      fireEvent.change(screen.getByRole('textbox', { name: /epic name/i }), {
        target: { value: 'Placeholder epic' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalled();
      expect(drafts()).toHaveLength(1);
      expect(drafts()[0].kind).toBe('epic');
      expect((drafts()[0].snapshot as { epicName: string }).epicName).toBe('Placeholder epic');
    });

    it('stores nothing when closed without content', () => {
      renderDialog();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(drafts()).toHaveLength(0);
    });

    it('opens blank without resumeDraftId even when an epic draft exists', () => {
      useIssueDraftsStore.getState().upsertDraft(epicDraft());
      renderDialog();
      expect((screen.getByRole('textbox', { name: /epic name/i }) as HTMLInputElement).value).toBe(
        '',
      );
      expect(screen.queryByText('Draft saved')).toBeNull();
    });

    it('restores name, description and files on resume; flags missing files', async () => {
      useIssueDraftsStore.getState().upsertDraft(
        epicDraft({
          files: [
            { name: 'ok.txt', size: 1, type: 'text/plain', path: 'p/ok.txt' },
            { name: 'photo.png', size: 1, type: 'image/png', path: 'p/photo.png' },
          ],
        }),
      );
      vi.mocked(readDraftFile).mockImplementation(async (ref) =>
        ref.name === 'ok.txt' ? new File(['x'], 'ok.txt', { type: 'text/plain' }) : null,
      );
      renderDialog({ resumeDraftId: 'd1' });
      expect((screen.getByRole('textbox', { name: /epic name/i }) as HTMLInputElement).value).toBe(
        'Placeholder epic',
      );
      expect(
        (screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement).value,
      ).toBe('Placeholder text');
      expect(await screen.findByText('ok.txt')).toBeTruthy();
      expect(screen.getByText('photo.png is missing')).toBeTruthy();
      expect(screen.getByText('Draft saved')).toBeTruthy();
    });

    it('creates a local preview for restored images', async () => {
      const create = vi.fn(() => 'blob:x');
      const revoke = vi.fn();
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
      useIssueDraftsStore.getState().upsertDraft(
        epicDraft({
          files: [{ name: 'photo.png', size: 1, type: 'image/png', path: 'p/photo.png' }],
        }),
      );
      vi.mocked(readDraftFile).mockResolvedValue(
        new File(['x'], 'photo.png', { type: 'image/png' }),
      );
      renderDialog({ resumeDraftId: 'd1' });
      await screen.findByText('photo.png');
      await waitFor(() => expect(create).toHaveBeenCalled());
    });

    it('Discard removes the draft and its files and closes', () => {
      useIssueDraftsStore.getState().upsertDraft(epicDraft());
      const { onClose } = renderDialog({ resumeDraftId: 'd1' });
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(drafts()).toHaveLength(0);
      expect(removeDraftFiles).toHaveBeenCalledWith('d1');
      expect(onClose).toHaveBeenCalled();
    });

    it('successful create removes the draft and its files', async () => {
      const { createIssue } = await import('@/services/jira');
      (createIssue as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '9', key: 'PROJ-9' });
      useIssueDraftsStore.getState().upsertDraft(epicDraft());
      const { onClose } = renderDialog({ resumeDraftId: 'd1' });
      fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(drafts()).toHaveLength(0);
      expect(removeDraftFiles).toHaveBeenCalledWith('d1');
    });

    it('upload failure still removes the draft and keeps the error behaviour', async () => {
      const { createIssue } = await import('@/services/jira');
      const { uploadStagedFiles } = await import('@/lib/upload-staged-files');
      (createIssue as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '9', key: 'PROJ-9' });
      (uploadStagedFiles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['a.png']);
      useIssueDraftsStore.getState().upsertDraft(epicDraft());
      const { onClose } = renderDialog({ resumeDraftId: 'd1' });
      act(() => lastStubProps.current?.host?.stageFile?.(new File(['x'], 'a.png')));
      fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
      await screen.findByText(/Issue created, but 1 file\(s\) failed to upload: a.png/);
      expect(onClose).not.toHaveBeenCalled();
      await waitFor(() => expect(drafts()).toHaveLength(0));
      expect(removeDraftFiles).toHaveBeenCalledWith('d1');
    });

    it('resumes an epic draft from the chip through the create-modal store', async () => {
      const { CreateEpicDialog } = await import('./CreateEpicDialog');
      useIssueDraftsStore.getState().upsertDraft(epicDraft());
      useCreateModalStore.setState({ epicOpen: false, epicResumeDraftId: null });
      function Harness() {
        const epicOpen = useCreateModalStore((s) => s.epicOpen);
        const epicResumeDraftId = useCreateModalStore((s) => s.epicResumeDraftId);
        const closeEpic = useCreateModalStore((s) => s.closeEpic);
        return (
          <>
            <DraftsChip />
            <CreateEpicDialog
              open={epicOpen}
              resumeDraftId={epicResumeDraftId}
              onClose={closeEpic}
            />
          </>
        );
      }
      render(
        <QueryClientProvider client={makeClient()}>
          <Harness />
        </QueryClientProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: /^Drafts, 1/ }));
      fireEvent.click(await screen.findByText('Placeholder epic'));
      const input = await screen.findByRole('textbox', { name: /epic name/i });
      expect((input as HTMLInputElement).value).toBe('Placeholder epic');
      await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Drafts' })).toBeNull());
    });
  });
});
