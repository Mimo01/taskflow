// Edit Issue description drafts (FLOW-01), discard guard (FLOW-02) and Esc cancel (FLOW-03).
// Create mode must never read or write a description draft (Phase 101 owns create drafts).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/apiFetch';
import { fetchIssueDescription } from '@/services/jira';
import { DRAFT_DEBOUNCE_MS } from '@/hooks/useEditorDraft';
import { useDraftsStore } from '@/stores/drafts.store';
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
    bulkUpdateIssue: vi.fn().mockResolvedValue(undefined),
    createIssueLink: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn() }));

vi.mock('@/services/jira/attachments', () => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

const KEY = 'description:PROJ-1';

// Stable identity: the form re-RESETs whenever initialValues changes.
const initialValues = {
  issueKey: 'PROJ-1',
  summary: 'Existing issue',
  description: 'Original text',
  assigneeName: null,
  priority: null,
  storyPoints: null,
  epicLinkKey: null,
  attachments: [],
};

let liveDescription: string | null = 'Original text';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function renderModal(opts: { mode?: 'create' | 'edit'; onClose?: () => void } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = opts.onClose ?? vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <CreateEditIssueModal
        open={true}
        onClose={onClose}
        mode={opts.mode ?? 'edit'}
        initialValues={initialValues}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

const editor = () => screen.getByLabelText('Description') as HTMLTextAreaElement;

function type(value: string) {
  fireEvent.change(editor(), { target: { value } });
}

function flushDraft() {
  act(() => {
    vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS + 10);
  });
}

beforeEach(() => {
  useDraftsStore.setState({ drafts: {}, owner: null });
  vi.spyOn(useDraftsStore.persist, 'hasHydrated').mockReturnValue(true);
  liveDescription = 'Original text';
  vi.mocked(apiFetch).mockImplementation(async (_src, url) => {
    if (String(url).includes('fields=description,updated')) {
      return liveDescription === null
        ? jsonResponse(404, {})
        : jsonResponse(200, { fields: { description: liveDescription, updated: 'u' } });
    }
    return jsonResponse(200, { values: [] });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('fetchIssueDescription', () => {
  it('returns description + updated, maps null description to empty string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      jsonResponse(200, { fields: { description: null, updated: '2026-01-01' } }),
    );
    expect(await fetchIssueDescription('https://j.example.com/', 't', 'PROJ-1')).toEqual({
      description: '',
      updated: '2026-01-01',
    });
    const url = String(vi.mocked(apiFetch).mock.calls[0][1]);
    expect(url).toBe('https://j.example.com/rest/api/2/issue/PROJ-1?fields=description,updated');
  });

  it('returns null on 404 and throws on other non-OK', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse(404, {}));
    expect(await fetchIssueDescription('https://j.example.com', 't', 'PROJ-1')).toBeNull();
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse(500, {}));
    await expect(fetchIssueDescription('https://j.example.com', 't', 'PROJ-1')).rejects.toThrow();
  });
});

describe('edit mode description draft', () => {
  it('seeds the description from a stored draft in the same RESET', async () => {
    useDraftsStore.getState().setDraft(KEY, {
      kind: 'description',
      issueKey: 'PROJ-1',
      text: 'Draft text',
      base: 'Original text',
    });
    renderModal();
    expect(editor().value).toBe('Draft text');
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });

  it('uses initialValues.description when no draft is stored', () => {
    renderModal();
    expect(editor().value).toBe('Original text');
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
  });

  it('restores a draft that hydrates after open when the user has not typed', async () => {
    let hydrated = false;
    let finish: (() => void) | undefined;
    vi.spyOn(useDraftsStore.persist, 'hasHydrated').mockImplementation(() => hydrated);
    vi.spyOn(useDraftsStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      finish = () => fn(useDraftsStore.getState());
      return () => {};
    });
    renderModal();
    expect(editor().value).toBe('Original text');
    useDraftsStore.getState().setDraft(KEY, {
      kind: 'description',
      issueKey: 'PROJ-1',
      text: 'Late draft',
      base: 'Original text',
    });
    hydrated = true;
    act(() => finish?.());
    await waitFor(() => expect(editor().value).toBe('Late draft'));
  });

  it('writes the draft after 500 ms with the opening description as base', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderModal();
    type('Original text plus edits');
    expect(useDraftsStore.getState().drafts[KEY]).toBeUndefined();
    flushDraft();
    expect(useDraftsStore.getState().drafts[KEY]).toMatchObject({
      text: 'Original text plus edits',
      base: 'Original text',
      kind: 'description',
    });
    expect(screen.getByText('Draft saved')).toBeInTheDocument();
  });

  it('shows the stale line when Jira changed since the draft, and Use Jira version adopts it', async () => {
    liveDescription = 'Changed elsewhere';
    useDraftsStore.getState().setDraft(KEY, {
      kind: 'description',
      issueKey: 'PROJ-1',
      text: 'My draft',
      base: 'Original text',
    });
    renderModal();
    expect(await screen.findByText('Changed in Jira since your draft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use Jira version' }));
    expect(editor().value).toBe('Changed elsewhere');
    expect(useDraftsStore.getState().drafts[KEY]).toBeUndefined();
    expect(screen.queryByText('Changed in Jira since your draft')).not.toBeInTheDocument();
  });

  it('note Discard clears the draft and resets the description to base', async () => {
    useDraftsStore.getState().setDraft(KEY, {
      kind: 'description',
      issueKey: 'PROJ-1',
      text: 'Draft text',
      base: 'Original text',
    });
    renderModal();
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(editor().value).toBe('Original text');
    expect(useDraftsStore.getState().drafts[KEY]).toBeUndefined();
    expect(document.activeElement).toBe(editor());
  });

  it('a successful save clears the draft', async () => {
    const { bulkUpdateIssue } = await import('@/services/jira');
    useDraftsStore.getState().setDraft(KEY, {
      kind: 'description',
      issueKey: 'PROJ-1',
      text: 'Draft text',
      base: 'Original text',
    });
    const { onClose } = renderModal();
    await screen.findByText('Draft saved');
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bulkUpdateIssue).toHaveBeenCalled();
    expect(useDraftsStore.getState().drafts[KEY]).toBeUndefined();
  });

  it('a failed save keeps the draft and shows the draft-kept copy', async () => {
    const { bulkUpdateIssue } = await import('@/services/jira');
    vi.mocked(bulkUpdateIssue).mockRejectedValueOnce(new Error('boom'));
    useDraftsStore.getState().setDraft(KEY, {
      kind: 'description',
      issueKey: 'PROJ-1',
      text: 'Draft text',
      base: 'Original text',
    });
    const { onClose } = renderModal();
    await screen.findByText('Draft saved');
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(
      await screen.findByText(
        "Couldn't save your changes. Your text is kept as a draft, try again.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(useDraftsStore.getState().drafts[KEY]?.text).toBe('Draft text');
  });

  it('clears all drafts for the issue when the live fetch 404s', async () => {
    liveDescription = null;
    useDraftsStore.getState().setDraft(KEY, {
      kind: 'description',
      issueKey: 'PROJ-1',
      text: 'Draft text',
      base: 'Original text',
    });
    useDraftsStore.getState().setDraft('comment:new:PROJ-1', {
      kind: 'comment-new',
      issueKey: 'PROJ-1',
      text: 'a comment',
    });
    renderModal();
    await waitFor(() => expect(useDraftsStore.getState().drafts).toEqual({}));
  });

  it('create mode never reads, writes or shows a description draft', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useDraftsStore.getState().setDraft(KEY, {
      kind: 'description',
      issueKey: 'PROJ-1',
      text: 'Draft text',
      base: 'Original text',
    });
    renderModal({ mode: 'create' });
    expect(editor().value).toBe('Original text');
    type('new issue text');
    flushDraft();
    expect(Object.keys(useDraftsStore.getState().drafts)).toEqual([KEY]);
    expect(useDraftsStore.getState().drafts[KEY].text).toBe('Draft text');
    // The only note is the footer's issue-draft note (Phase 101), never the editor's
    // description note: exactly one, rendered in the footer status slot.
    expect(screen.getAllByText('Draft saved')).toHaveLength(1);
    expect(screen.getByTestId('modal-footer-status')).toHaveTextContent('Draft saved');
  });
});

describe('edit mode discard guard', () => {
  it('Base UI emits escape-key / close-press / outside-press as the guard relies on', async () => {
    // Esc on the summary input is an escape-key close request: dirty -> guard dialog, no close.
    const a = renderModal();
    type('Original text changed');
    fireEvent.keyDown(screen.getByPlaceholderText('Issue summary'), { key: 'Escape' });
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(a.onClose).not.toHaveBeenCalled();
  });

  it('X closes silently and keeps the draft', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    type('Original text changed');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(useDraftsStore.getState().drafts[KEY]?.text).toBe('Original text changed');
  });

  it('backdrop press closes silently and keeps the draft', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    type('Original text changed');
    const backdrop = document.querySelector('.bg-black\\/40') as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(useDraftsStore.getState().drafts[KEY]?.text).toBe('Original text changed');
  });

  it('dirty Cancel opens the discard dialog; clean Cancel closes directly', async () => {
    const user = userEvent.setup();
    const dirty = renderModal();
    type('Original text changed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(dirty.onClose).not.toHaveBeenCalled();
  });

  it('clean Cancel and clean Esc close with no dialog', async () => {
    const user = userEvent.setup();
    const a = renderModal();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(a.onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByPlaceholderText('Issue summary'), { key: 'Escape' });
    await waitFor(() => expect(a.onClose).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
  });

  it('editor Esc with changes opens the discard dialog exactly once', async () => {
    const { onClose } = renderModal();
    type('Original text changed');
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(await screen.findAllByText('Discard changes?')).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Keep editing returns to the modal, focuses the editor and keeps the draft', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    type('Original text changed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Edit PROJ-1')).toBeInTheDocument();
    expect(document.activeElement).toBe(editor());
    expect(editor().value).toBe('Original text changed');
  });

  it('Esc inside the discard dialog closes only the dialog', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    type('Original text changed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByText('Discard changes?');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Edit PROJ-1')).toBeInTheDocument();
  });

  it('Discard clears the draft and closes the modal', async () => {
    const user = userEvent.setup();
    useDraftsStore.getState().setDraft(KEY, {
      kind: 'description',
      issueKey: 'PROJ-1',
      text: 'Draft text',
      base: 'Original text',
    });
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    const discard = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent === 'Discard',
    ) as HTMLButtonElement;
    await user.click(discard);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useDraftsStore.getState().drafts[KEY]).toBeUndefined();
  });

  it('create mode with text: Cancel, Esc and X all close without a dialog', async () => {
    const user = userEvent.setup();
    const a = renderModal({ mode: 'create' });
    type('some new text');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(screen.getByPlaceholderText('Issue summary'), { key: 'Escape' });
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(a.onClose).toHaveBeenCalledTimes(3));
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
  });

  it('Cancel tooltip shows Cancel and the Esc keycap', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.hover(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Esc')).toBeInTheDocument();
  });
});
