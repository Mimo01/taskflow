/**
 * Comment-edit host logic (Phase 100-06): WikiEditorLazy swap, Cmd+Enter / Esc keys,
 * discard guard, and local drafts. The editor is the shared textarea stub.
 */

// --- Mocks (declared before any imports that use them) ---

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/stores/breadcrumb.store', () => ({
  useBreadcrumbStore: vi.fn(),
}));

vi.mock('@/stores/pinned-tabs.store', () => ({
  usePinnedTabsStore: vi.fn(),
}));

vi.mock('@/stores/recent-items.store', () => ({
  useRecentItemsStore: vi.fn(),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/hooks/useDelayedLoading', () => ({
  useDelayedLoading: vi.fn().mockReturnValue(false),
}));

vi.mock('@/hooks/useMentionUserMap', () => ({
  useMentionUserMap: vi.fn().mockReturnValue({}),
}));

vi.mock('@/hooks/useResizable', () => ({
  useResizable: vi
    .fn()
    .mockReturnValue({ width: 400, isDragging: false, handleMouseDown: () => {} }),
}));

vi.mock('@/services/jira', () => ({
  fetchIssueDetail: vi.fn(),
  fetchComments: vi.fn(),
  fetchEnrichedSubtasks: vi.fn(),
  fetchEpicStories: vi.fn().mockResolvedValue([]),
  // Epic progress section lazy queries (261001-ilq)
  fetchEpicWorklogs: vi.fn().mockResolvedValue(new Map()),
  fetchEpicStatusHistory: vi.fn().mockResolvedValue(new Map()),
  fetchAllJiraStatuses: vi.fn().mockResolvedValue([]),
  deleteComment: vi.fn(),
  updateComment: vi.fn(),
  // Needed by IssueDetailSidebar → FieldsSection
  isIssueFlagged: vi.fn().mockReturnValue(false),
  invalidateGhAllData: vi.fn(),
  invalidateGhBacklogData: vi.fn(),
  mergeTimeline: vi.fn((comments: unknown[]) =>
    comments.map((data) => ({ type: 'comment', data })),
  ),
  filterTimeline: vi.fn().mockReturnValue([]),
  countByType: vi.fn().mockReturnValue({ all: 1, comment: 1, change: 0, worklog: 0 }),
  // Needed by StatusPopover (in case it renders despite the component-level mock)
  useGhTransitions: vi.fn().mockReturnValue({ data: undefined, isLoading: false, isError: false }),
  filterTransitionsForStatus: vi.fn().mockReturnValue([]),
}));

vi.mock('@/services/jira/changelog', () => ({
  fetchIssueChangelog: vi.fn(),
}));

vi.mock('@/services/jira/worklogs', () => ({
  fetchFullWorklogs: vi.fn().mockResolvedValue([]),
  deleteWorklog: vi.fn(),
  updateWorklog: vi.fn(),
}));

vi.mock('@/services/jira/transitions', () => ({
  postTransition: vi.fn(),
  fetchIssueTransitionsWithFields: vi.fn().mockResolvedValue([]),
  // Mirror the real key factory so FieldsSection's queryKey matches production.
  transitionsWithFieldsKey: vi.fn((issueKey, baseUrl, statusId) => [
    'jira-issue-transitions-fields',
    issueKey,
    baseUrl,
    statusId,
  ]),
}));

vi.mock('@/hooks/useBoardId', () => ({
  useBoardId: vi.fn().mockReturnValue({ boardId: null }),
}));

vi.mock('@/services/jira/backlog', () => ({
  fetchSprintList: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/jira/sprints', () => ({
  addIssuesToSprint: vi.fn(),
  moveIssuesToBacklog: vi.fn(),
}));

vi.mock('@/services/jira/versions', () => ({
  fetchFixVersions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('./StatusPopover', () => ({
  default: ({
    onSelect,
    currentStatus,
  }: {
    onSelect: (id: string, name: string) => void;
    currentStatus: string;
  }) => (
    <button
      type="button"
      data-testid="status-popover-trigger"
      onClick={() => onSelect('done-transition-id', 'Done')}
    >
      {currentStatus}
    </button>
  ),
}));

vi.mock('./issue-detail/WatcherToggle', () => ({
  WatcherToggle: () => null,
}));

vi.mock('./issue-detail/TimeTrackingSummary', () => ({
  TimeTrackingSummary: () => null,
}));

vi.mock('./issue-detail/OverdueBadge', () => ({
  OverdueBadge: () => null,
}));

vi.mock('./issue-detail/MetaRow', () => ({
  MetaRow: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div data-testid={`meta-row-${label.toLowerCase()}`}>{children}</div>
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn().mockReturnValue({ key: 'PROJ-123' }),
    useNavigate: vi.fn().mockReturnValue(() => {}),
    useOutletContext: vi.fn().mockReturnValue({
      onIssueClick: () => {},
      openEdit: () => {},
      openClone: () => {},
      openAddSubtask: () => {},
    }),
  };
});

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

// Stub heavy sub-trees not relevant to progressive rendering tests
vi.mock('./IssueDetailSidebar', () => ({
  IssueDetailSidebar: () => null,
}));
vi.mock('./issue-detail/AioTestRunsSection', () => ({
  AioTestRunsSection: () => null,
}));
vi.mock('./CommentComposer', () => ({
  CommentComposer: () => null,
}));
vi.mock(
  '@/components/wiki-editor/WikiEditorLazy',
  async () => (await import('@/test/wiki-editor-stub')).wikiEditorLazyMock,
);

// --- Imports (after mocks) ---

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchComments,
  fetchEnrichedSubtasks,
  fetchIssueDetail,
  updateComment,
} from '@/services/jira';
import { fetchIssueChangelog } from '@/services/jira/changelog';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { useDraftsStore } from '@/stores/drafts.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { useRecentItemsStore } from '@/stores/recent-items.store';
import { useSettingsStore } from '@/stores/settings.store';
import { ApiError } from '@/lib/api-error';
import { lastStubProps } from '@/test/wiki-editor-stub';

import { IssueDetailView } from './IssueDetailView';

const JIRA_BASE_URL = 'https://jira.example.com';
const ISSUE_KEY = 'PROJ-123';

const BASE_ISSUE = {
  id: '10001',
  key: ISSUE_KEY,
  fields: {
    summary: 'Test issue title',
    status: { id: '1', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
    assignee: { displayName: 'Alice', avatarUrls: { '48x48': '' }, name: 'alice' },
    reporter: { displayName: 'Bob', name: 'bob', emailAddress: 'bob@example.com' },
    priority: { name: 'Medium' },
    issuetype: { name: 'Story', subtask: false },
    project: { id: '1', key: 'PROJ', name: 'Project' },
    description: 'The description',
    attachment: [],
    issuelinks: [],
    subtasks: [],
    labels: [],
    fixVersions: [],
    parent: undefined,
    timetracking: {},
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    duedate: null,
    customfield_13415: null,
  },
};

const comment = (id: string, body: string) => ({
  id,
  author: { displayName: 'Alice', name: 'alice', emailAddress: 'alice@example.com' },
  body,
  created: '2026-01-01T10:00:00.000Z',
  updated: '2026-01-01T10:00:00.000Z',
});

const mockFetchIssueDetail = vi.mocked(fetchIssueDetail);
const mockFetchComments = vi.mocked(fetchComments);
const mockUpdateComment = vi.mocked(updateComment);

function setupStores() {
  const wire = (hook: unknown, store: Record<string, unknown>) =>
    vi
      .mocked(hook as (...a: unknown[]) => unknown)
      .mockImplementation((selector?: unknown) =>
        typeof selector === 'function' ? selector(store) : store,
      );
  wire(useSettingsStore, {
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10010',
    sprintFieldKey: 'customfield_10020',
    storyPointsFieldKey: 'customfield_10016',
    epicColorFieldKey: undefined,
    issueDetailPanelWidth: 400,
    setIssueDetailPanelWidth: () => {},
    commentSortOrder: 'newest',
  });
  wire(useAuthStore, {
    jiraBaseUrl: JIRA_BASE_URL,
    jiraConnected: true,
    jiraUserDisplayName: 'Alice',
  });
  wire(useBreadcrumbStore, { trail: [], pop: () => {} });
  wire(usePinnedTabsStore, { pinnedKeys: [], togglePin: () => {} });
  wire(useRecentItemsStore, { pushItem: () => {} });
}

let qc: QueryClient;

function renderView() {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <IssueDetailView issueKey={ISSUE_KEY} layout="single-column" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Opens the first available Edit (the card already being edited hides its menu). */
async function startEdit() {
  const buttons = await screen.findAllByLabelText('Comment actions');
  fireEvent.click(buttons[0] as HTMLElement);
  const menuContainer = (await screen.findByText('Delete')).closest('.fixed') as HTMLElement;
  fireEvent.click(menuContainer.querySelector('button') as HTMLElement);
  return (await screen.findByLabelText('Edit comment')) as HTMLTextAreaElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  useDraftsStore.setState({ drafts: {}, owner: null });
  vi.spyOn(useDraftsStore.persist, 'hasHydrated').mockReturnValue(true);
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  setupStores();
  mockFetchIssueDetail.mockResolvedValue(BASE_ISSUE as never);
  mockFetchComments.mockResolvedValue([comment('c1', 'Hello world')] as never);
  vi.mocked(fetchIssueChangelog).mockResolvedValue([]);
  vi.mocked(fetchEnrichedSubtasks).mockResolvedValue([]);
  mockUpdateComment.mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('comment edit host (Task 1)', () => {
  it('renders the compact editor with the comment body and a host', async () => {
    renderView();
    const editor = await startEdit();
    expect(editor.value).toBe('Hello world');
    expect(lastStubProps.current?.preset).toBe('compact');
    expect(lastStubProps.current?.host?.issueKey).toBe(ISSUE_KEY);
    expect(lastStubProps.current?.host?.isReferencedElsewhere?.('The description')).toBe(true);
    expect(lastStubProps.current?.host?.isReferencedElsewhere?.('Hello world')).toBe(true);
  });

  it('Cmd+Enter saves the trimmed text; empty text does not save', async () => {
    renderView();
    const editor = await startEdit();
    fireEvent.change(editor, { target: { value: '  Updated  ' } });
    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true });
    await waitFor(() =>
      expect(mockUpdateComment).toHaveBeenCalledWith(
        JIRA_BASE_URL,
        'mock-token',
        ISSUE_KEY,
        'c1',
        'Updated',
      ),
    );
    mockUpdateComment.mockClear();
    const again = await startEdit();
    fireEvent.change(again, { target: { value: '   ' } });
    fireEvent.keyDown(again, { key: 'Enter', metaKey: true });
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it('shows Save and Cancel tooltips with keycaps', async () => {
    renderView();
    await startEdit();
    fireEvent.focus(screen.getByRole('button', { name: 'Save' }));
    const save = await screen.findByText('⌘');
    expect(save.closest('[data-slot="tooltip-content"]')?.textContent).toContain('Save');
    expect(screen.getByText('↵')).toBeTruthy();
    fireEvent.focus(screen.getByRole('button', { name: 'Cancel' }));
    const esc = await screen.findByText('Esc');
    expect(esc.closest('[data-slot="tooltip-content"]')?.textContent).toContain('Cancel');
  });

  it('Cancel and Esc without changes exit silently', async () => {
    renderView();
    const editor = await startEdit();
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(screen.queryByText('Discard changes?')).toBeNull();
    await waitFor(() => expect(screen.queryByLabelText('Edit comment')).toBeNull());

    await startEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Discard changes?')).toBeNull();
    await waitFor(() => expect(screen.queryByLabelText('Edit comment')).toBeNull());
  });

  it('Cancel or Esc with changes asks to discard; Keep editing keeps text and focuses', async () => {
    renderView();
    const editor = await startEdit();
    fireEvent.change(editor, { target: { value: 'Changed' } });
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(await screen.findByText('Discard changes?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByText('Discard changes?')).toBeNull());
    const still = screen.getByLabelText('Edit comment') as HTMLTextAreaElement;
    expect(still.value).toBe('Changed');
    await waitFor(() => expect(document.activeElement).toBe(still));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeTruthy();
  });

  it('Discard in the dialog exits edit mode', async () => {
    renderView();
    const editor = await startEdit();
    fireEvent.change(editor, { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByText('Discard changes?');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByLabelText('Edit comment')).toBeNull());
  });

  it('a failed save shows fixed copy and stays in edit mode', async () => {
    mockUpdateComment.mockRejectedValue(new Error('boom secret detail'));
    renderView();
    const editor = await startEdit();
    fireEvent.change(editor, { target: { value: 'Changed' } });
    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true });
    expect(
      await screen.findByText(
        "Couldn't save your changes. Your text is kept as a draft, try again.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/boom secret detail/)).toBeNull();
    expect(screen.getByLabelText('Edit comment')).toBeTruthy();
  });
});

const K1 = 'comment:edit:c1';
const stored = (key: string) => useDraftsStore.getState().drafts[key];
const seed = (id: string, text: string, base: string, issueKey = ISSUE_KEY, updatedAt = 1) =>
  useDraftsStore.setState((st) => ({
    drafts: {
      ...st.drafts,
      [`comment:edit:${id}`]: { kind: 'comment-edit', issueKey, text, base, updatedAt },
    },
  }));

describe('comment edit drafts (Task 2)', () => {
  it('writes the draft after 500 ms and shows Draft saved', async () => {
    renderView();
    const editor = await startEdit();
    fireEvent.change(editor, { target: { value: 'My draft' } });
    expect(stored(K1)).toBeUndefined();
    await waitFor(() => expect(stored(K1)?.text).toBe('My draft'), { timeout: 3000 });
    expect(stored(K1)?.base).toBe('Hello world');
    expect(stored(K1)?.kind).toBe('comment-edit');
    expect(await screen.findByText('Draft saved')).toBeTruthy();
  });

  it('reopens the comment in edit mode with the draft and scrolls it into view', async () => {
    seed('c1', 'Half typed', 'Hello world');
    renderView();
    const editor = (await screen.findByLabelText('Edit comment')) as HTMLTextAreaElement;
    expect(editor.value).toBe('Half typed');
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(screen.getByText('Draft saved')).toBeTruthy();
  });

  it('shows the stale note and Use Jira version takes the live body', async () => {
    seed('c1', 'Half typed', 'Old Jira text');
    renderView();
    await screen.findByLabelText('Edit comment');
    expect(await screen.findByText('Changed in Jira since your draft')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use Jira version' }));
    await waitFor(() =>
      expect((screen.getByLabelText('Edit comment') as HTMLTextAreaElement).value).toBe(
        'Hello world',
      ),
    );
    expect(stored(K1)).toBeUndefined();
    expect(screen.queryByText('Changed in Jira since your draft')).toBeNull();
  });

  it('the note Discard clears the draft, resets text to base and focuses, no dialog', async () => {
    seed('c1', 'Half typed', 'Hello world');
    renderView();
    await screen.findByLabelText('Edit comment');
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    const editor = screen.getByLabelText('Edit comment') as HTMLTextAreaElement;
    await waitFor(() => expect(editor.value).toBe('Hello world'));
    expect(stored(K1)).toBeUndefined();
    expect(screen.queryByText('Discard changes?')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(editor));
  });

  it('switching to another comment keeps the first one as a draft', async () => {
    mockFetchComments.mockResolvedValue([comment('c1', 'First'), comment('c2', 'Second')] as never);
    renderView();
    const editor = await startEdit();
    expect(editor.value).toBe('First');
    fireEvent.change(editor, { target: { value: 'First changed' } });
    // Open the other comment's menu right away (before the debounce fires).
    const second = await startEdit();
    await waitFor(() => expect(second.value).toBe('Second'));
    expect(stored(K1)?.text).toBe('First changed');
    expect(stored('comment:edit:c2')).toBeUndefined();
  });

  it('a successful save clears the draft; a failed save keeps it', async () => {
    mockUpdateComment.mockRejectedValueOnce(new Error('nope'));
    renderView();
    const editor = await startEdit();
    fireEvent.change(editor, { target: { value: 'Changed' } });
    await waitFor(() => expect(stored(K1)?.text).toBe('Changed'), { timeout: 3000 });
    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true });
    await screen.findByText(/Couldn't save your changes/);
    expect(stored(K1)?.text).toBe('Changed');
    fireEvent.keyDown(screen.getByLabelText('Edit comment'), { key: 'Enter', metaKey: true });
    await waitFor(() => expect(screen.queryByLabelText('Edit comment')).toBeNull());
    expect(stored(K1)).toBeUndefined();
  });

  it('Discard in the dialog clears the draft', async () => {
    renderView();
    const editor = await startEdit();
    fireEvent.change(editor, { target: { value: 'Changed' } });
    await waitFor(() => expect(stored(K1)).toBeDefined(), { timeout: 3000 });
    fireEvent.keyDown(editor, { key: 'Escape' });
    await screen.findByText('Discard changes?');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByLabelText('Edit comment')).toBeNull());
    expect(stored(K1)).toBeUndefined();
  });

  it('a complete comment list prunes drafts of missing comments (this issue only)', async () => {
    seed('c3', 'Orphan', 'x');
    seed('c9', 'Other issue', 'x', 'OTHER-1');
    renderView();
    await waitFor(() => expect(stored('comment:edit:c3')).toBeUndefined());
    expect(stored('comment:edit:c9')).toBeDefined();
  });

  it('a comments query error removes nothing', async () => {
    seed('c3', 'Orphan', 'x');
    mockFetchComments.mockRejectedValue(new Error('network'));
    renderView();
    await screen.findByRole('heading', { level: 2, name: 'Test issue title' });
    await new Promise((r) => setTimeout(r, 100));
    expect(stored('comment:edit:c3')).toBeDefined();
  });

  it('an issue 404 clears the drafts for the issue', async () => {
    seed('c1', 'Draft', 'Hello world');
    seed('c9', 'Other issue', 'x', 'OTHER-1');
    mockFetchIssueDetail.mockRejectedValue(new ApiError('gone', 404, 'jira'));
    renderView();
    await waitFor(() => expect(stored(K1)).toBeUndefined());
    expect(stored('comment:edit:c9')).toBeDefined();
  });

  it.each([401, 403])('an issue %i clears nothing', async (status) => {
    seed('c1', 'Draft', 'Hello world');
    mockFetchIssueDetail.mockRejectedValue(new ApiError('denied', status, 'jira'));
    renderView();
    await new Promise((r) => setTimeout(r, 200));
    expect(stored(K1)).toBeDefined();
  });
});
