// Phase 101 plan 09: "Create another" (D-06..D-09, UI-02).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAFT_DEBOUNCE_MS } from '@/hooks/useEditorDraft';
import { uploadStagedFiles } from '@/lib/upload-staged-files';
import { createIssue } from '@/services/jira';
import { useIssueDraftsStore } from '@/stores/issue-drafts.store';
import { CreateEditIssueModal } from './CreateEditIssueModal';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-pat'),
}));

vi.mock(
  '@/components/wiki-editor/WikiEditorLazy',
  async () => (await import('@/test/wiki-editor-stub')).wikiEditorLazyMock,
);

vi.mock('@/stores/auth.store', () => {
  const state = { jiraBaseUrl: 'https://jira.example.com', activeJiraProject: 'PROJ' };
  return {
    useAuthStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
  };
});

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    epicLinkFieldKey: null,
    storyPointsFieldKey: null,
    accountFieldKey: null,
  }),
}));

vi.mock('@/services/jira', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/jira')>();
  return {
    ...actual,
    fetchCreatemeta: vi.fn().mockResolvedValue([]),
    fetchIssueLinkTypes: vi.fn().mockResolvedValue([]),
    searchJiraForLink: vi.fn().mockResolvedValue([]),
    createIssue: vi.fn(),
    bulkUpdateIssue: vi.fn().mockResolvedValue(undefined),
    createIssueLink: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => ({ values: [] }) }),
}));

vi.mock('@/services/jira/attachments', () => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

vi.mock('@/lib/upload-staged-files', () => ({ uploadStagedFiles: vi.fn() }));

vi.mock('@/lib/issue-draft-files', () => ({
  stageDraftFile: vi.fn(async (id: string, f: File) => ({
    name: f.name,
    size: f.size,
    type: f.type,
    path: `issue-drafts/${id}/${f.name}`,
  })),
  readDraftFile: vi.fn(),
  removeDraftFiles: vi.fn().mockResolvedValue(undefined),
}));

const issueDrafts = () => Object.values(useIssueDraftsStore.getState().drafts);

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const onOpenIssue = vi.fn();
  const ui = (open: boolean) => (
    <QueryClientProvider client={qc}>
      <CreateEditIssueModal open={open} onClose={onClose} mode="create" onOpenIssue={onOpenIssue} />
    </QueryClientProvider>
  );
  const view = render(ui(true));
  return { onClose, onOpenIssue, rerender: (open: boolean) => view.rerender(ui(open)) };
}

const summary = () => screen.getByPlaceholderText('Issue summary') as HTMLInputElement;
const description = () =>
  screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement;
const checkbox = () => screen.getByLabelText('Create another') as HTMLInputElement;

function flushDraft() {
  act(() => {
    vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS + 10);
  });
}

async function submitAnother(key = 'ABC-1') {
  vi.mocked(createIssue).mockResolvedValue({ id: '1', key });
  fireEvent.change(summary(), { target: { value: 'First issue' } });
  fireEvent.change(description(), { target: { value: 'Body' } });
  fireEvent.click(checkbox());
  fireEvent.click(screen.getByRole('button', { name: 'Create Issue' }));
  await screen.findByText(`✓ Created ${key}`);
}

beforeEach(() => {
  useIssueDraftsStore.setState({ drafts: {}, owner: null, saveFailed: false });
  vi.spyOn(useIssueDraftsStore.persist, 'hasHydrated').mockReturnValue(true);
  vi.mocked(createIssue).mockReset();
  vi.mocked(uploadStagedFiles).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Create another', () => {
  it('is unticked on every open, even after being ticked', () => {
    const { rerender } = renderModal();
    expect(checkbox().checked).toBe(false);
    fireEvent.click(checkbox());
    expect(checkbox().checked).toBe(true);
    rerender(false);
    rerender(true);
    expect(checkbox().checked).toBe(false);
  });

  it('ticked success keeps the modal open, resets the form and shows the created line', async () => {
    const { onClose } = renderModal();
    fireEvent.change(screen.getByLabelText('Story points'), { target: { value: '5' } });
    await submitAnother();
    expect(onClose).not.toHaveBeenCalled();
    expect(summary().value).toBe('');
    expect(description().value).toBe('');
    expect((screen.getByLabelText('Story points') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  it('refocuses Summary after the reset', async () => {
    renderModal();
    await submitAnother();
    await waitFor(() => expect(document.activeElement).toBe(summary()));
  });

  it('Open calls onOpenIssue with the key and the modal stays open', async () => {
    const { onOpenIssue, onClose } = renderModal();
    await submitAnother();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpenIssue).toHaveBeenCalledWith('ABC-1');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('typing clears the created line and starts a fresh draft id', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderModal();
    fireEvent.change(summary(), { target: { value: 'First issue' } });
    flushDraft();
    const firstId = issueDrafts()[0].id;
    vi.mocked(createIssue).mockResolvedValue({ id: '1', key: 'ABC-1' });
    fireEvent.click(checkbox());
    fireEvent.click(screen.getByRole('button', { name: 'Create Issue' }));
    await screen.findByText('✓ Created ABC-1');
    expect(issueDrafts()).toHaveLength(0);

    fireEvent.change(summary(), { target: { value: 'Second issue' } });
    expect(screen.queryByText('✓ Created ABC-1')).not.toBeInTheDocument();
    flushDraft();
    expect(issueDrafts()).toHaveLength(1);
    expect(issueDrafts()[0].id).not.toBe(firstId);
  });

  it('clears staged files on success', async () => {
    vi.mocked(uploadStagedFiles).mockResolvedValue([]);
    renderModal();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(['d'], 'shot.png', { type: 'image/png' })] },
      });
    });
    expect(screen.getByText('shot.png')).toBeInTheDocument();
    await submitAnother();
    expect(screen.queryByText('shot.png')).not.toBeInTheDocument();
  });

  it('a staged upload failure keeps the modal open with the error and disabled submit, no reset', async () => {
    vi.mocked(uploadStagedFiles).mockResolvedValue(['shot.png']);
    const { onClose } = renderModal();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(['d'], 'shot.png', { type: 'image/png' })] },
      });
    });
    vi.mocked(createIssue).mockResolvedValue({ id: '1', key: 'ABC-2' });
    fireEvent.change(summary(), { target: { value: 'Has file' } });
    fireEvent.click(checkbox());
    fireEvent.click(screen.getByRole('button', { name: 'Create Issue' }));
    expect(await screen.findByText(/failed to upload/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(summary().value).toBe('Has file');
    expect(screen.queryByText('✓ Created ABC-2')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Issue' })).toBeDisabled();
  });

  it('disables the checkbox while the create is pending', async () => {
    vi.mocked(createIssue).mockReturnValue(new Promise(() => {}));
    renderModal();
    fireEvent.change(summary(), { target: { value: 'Pending' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Issue' }));
    await waitFor(() => expect(checkbox()).toBeDisabled());
  });
});
