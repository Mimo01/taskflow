// Phase 101 plan 09: Create-mode issue drafts (autosave, keep-on-close, discard, create/failed create).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAFT_DEBOUNCE_MS } from '@/hooks/useEditorDraft';
import { removeDraftFiles, stageDraftFile } from '@/lib/issue-draft-files';
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

vi.mock('@/lib/issue-draft-files', () => ({
  stageDraftFile: vi.fn(),
  readDraftFile: vi.fn(),
  removeDraftFiles: vi.fn().mockResolvedValue(undefined),
  removeDraftFile: vi.fn().mockResolvedValue(undefined),
}));

const issueDrafts = () => Object.values(useIssueDraftsStore.getState().drafts);

function renderModal(opts: { mode?: 'create' | 'edit'; onClose?: () => void } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = opts.onClose ?? vi.fn();
  const ui = (open: boolean) => (
    <QueryClientProvider client={qc}>
      <CreateEditIssueModal
        open={open}
        onClose={onClose}
        mode={opts.mode ?? 'create'}
        initialValues={
          opts.mode === 'edit'
            ? {
                issueKey: 'PROJ-1',
                summary: 'Existing',
                description: 'Original',
                assigneeName: null,
                priority: null,
                storyPoints: null,
                epicLinkKey: null,
                attachments: [],
              }
            : undefined
        }
      />
    </QueryClientProvider>
  );
  const view = render(ui(true));
  return { onClose, rerender: (open: boolean) => view.rerender(ui(open)) };
}

const summary = () => screen.getByPlaceholderText('Issue summary') as HTMLInputElement;
const typeSummary = (v: string) => fireEvent.change(summary(), { target: { value: v } });

function flushDraft() {
  act(() => {
    vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS + 10);
  });
}

beforeEach(() => {
  useIssueDraftsStore.setState({ drafts: {}, owner: null, saveFailed: false });
  vi.spyOn(useIssueDraftsStore.persist, 'hasHydrated').mockReturnValue(true);
  vi.mocked(createIssue).mockReset();
  vi.mocked(removeDraftFiles).mockClear();
  vi.mocked(stageDraftFile).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Create mode issue drafts', () => {
  it('keeps a draft when closed with X and shows no discard prompt', () => {
    const { onClose } = renderModal();
    typeSummary('Fix login');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    expect(issueDrafts()).toHaveLength(1);
    expect(issueDrafts()[0]).toMatchObject({ kind: 'issue', snapshot: { summary: 'Fix login' } });
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
  });

  it('keeps the draft on Cancel and on Esc without a prompt', async () => {
    const first = renderModal();
    typeSummary('One');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(first.onClose).toHaveBeenCalled();
    expect(issueDrafts()).toHaveLength(1);
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();

    useIssueDraftsStore.setState({ drafts: {} });
    const user = userEvent.setup();
    typeSummary('Two');
    await user.keyboard('{Escape}');
    expect(issueDrafts()).toHaveLength(1);
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
  });

  it('creates no draft when only non-content fields change (D-12)', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Story points'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(issueDrafts()).toHaveLength(0);
  });

  it('opens blank while drafts exist and the next typing makes a second draft (D-13)', () => {
    const { rerender } = renderModal();
    typeSummary('First');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(issueDrafts()).toHaveLength(1);
    rerender(false);
    rerender(true);
    expect(summary().value).toBe('');
    typeSummary('Second');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(issueDrafts()).toHaveLength(2);
  });

  it('shows Draft saved with Discard; Discard removes the draft and files and closes', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { onClose } = renderModal();
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
    typeSummary('Something');
    flushDraft();
    expect(screen.getByText('Draft saved')).toBeInTheDocument();
    const id = issueDrafts()[0].id;
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(issueDrafts()).toHaveLength(0);
    expect(removeDraftFiles).toHaveBeenCalledWith(id);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
  });

  it('copies a staged file into app storage and stores the ref on the draft', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(stageDraftFile).mockImplementation(async (id, f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      path: `issue-drafts/${id}/${f.name}`,
    }));
    renderModal();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(['data'], 'shot.png', { type: 'image/png' })] },
      });
    });
    flushDraft();
    expect(stageDraftFile).toHaveBeenCalledWith(expect.any(String), expect.any(File));
    const draft = issueDrafts()[0];
    expect(vi.mocked(stageDraftFile).mock.calls[0][0]).toBe(draft.id);
    expect(draft.files.map((f) => f.name)).toEqual(['shot.png']);
  });

  it('a successful create removes the draft and its copies, then closes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(createIssue).mockResolvedValue({ id: '1', key: 'ABC-1' });
    const { onClose } = renderModal();
    typeSummary('Ship it');
    flushDraft();
    const id = issueDrafts()[0].id;
    fireEvent.click(screen.getByRole('button', { name: 'Create issue' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(issueDrafts()).toHaveLength(0);
    expect(removeDraftFiles).toHaveBeenCalledWith(id);
  });

  it('a failed create keeps the draft and shows the draft-kept error', async () => {
    vi.mocked(createIssue).mockRejectedValue(new Error('Jira said no'));
    const { onClose } = renderModal();
    typeSummary('Will fail');
    fireEvent.click(screen.getByRole('button', { name: 'Create issue' }));
    expect(
      await screen.findByText("Couldn't create the issue. Your draft is kept, try again."),
    ).toBeInTheDocument();
    expect(screen.getByText('Jira said no')).toBeInTheDocument();
    expect(issueDrafts()).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Edit mode', () => {
  it('never writes to the issue drafts store', () => {
    renderModal({ mode: 'edit' });
    typeSummary('Edited summary');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(issueDrafts()).toHaveLength(0);
  });
});
