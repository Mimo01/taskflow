/**
 * Wave 0 progressive-rendering test scaffold for IssueDetailPage.
 *
 * These tests assert per-section independent rendering (PERF-DETAIL-01/02).
 * They MUST FAIL initially (RED gate) — the page still uses the global gate
 * and does not have independent queries for comments/subtasks/changelog.
 * They will turn GREEN after 75-02 wires up the independent queries.
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
  useResizable: vi.fn().mockReturnValue({ width: 400, isDragging: false, handleMouseDown: () => {} }),
}));

vi.mock('@/services/jira', () => ({
  fetchIssueDetail: vi.fn(),
  fetchEnrichedSubtasks: vi.fn(),
  fetchEpicStories: vi.fn().mockResolvedValue([]),
  deleteComment: vi.fn(),
  updateComment: vi.fn(),
  // Needed by IssueDetailSidebar → FieldsSection
  isIssueFlagged: vi.fn().mockReturnValue(false),
  invalidateGhBacklogData: vi.fn(),
  mergeTimeline: vi.fn().mockReturnValue([]),
  filterTimeline: vi.fn().mockReturnValue([]),
  countByType: vi.fn().mockReturnValue({ comment: 0, change: 0, worklog: 0 }),
  // Needed by StatusPopover (in case it renders despite the component-level mock)
  useGhTransitions: vi.fn().mockReturnValue({ data: undefined, isLoading: false, isError: false }),
  filterTransitionsForStatus: vi.fn().mockReturnValue([]),
}));

vi.mock('@/services/jira/comments', () => ({
  fetchComments: vi.fn(),
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

// --- Imports (after mocks) ---

import type React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { deleteComment, fetchEnrichedSubtasks, fetchIssueDetail, updateComment } from '@/services/jira';
import { fetchComments } from '@/services/jira/comments';
import { fetchIssueChangelog } from '@/services/jira/changelog';
import { postTransition } from '@/services/jira/transitions';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { useRecentItemsStore } from '@/stores/recent-items.store';
import { useSettingsStore } from '@/stores/settings.store';

import IssueDetailPage from './IssueDetailPage';
import { FieldsSection } from './issue-detail/FieldsSection';

// --- Constants ---

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
    description: null,
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

// --- Test helpers ---

const mockUseSettingsStore = vi.mocked(useSettingsStore);
const mockUseAuthStore = vi.mocked(useAuthStore);
const mockUseBreadcrumbStore = vi.mocked(useBreadcrumbStore);
const mockUsePinnedTabsStore = vi.mocked(usePinnedTabsStore);
const mockUseRecentItemsStore = vi.mocked(useRecentItemsStore);
const mockUseDelayedLoading = vi.mocked(useDelayedLoading);
const mockFetchIssueDetail = vi.mocked(fetchIssueDetail);
const mockFetchComments = vi.mocked(fetchComments);
const mockFetchIssueChangelog = vi.mocked(fetchIssueChangelog);
const mockFetchEnrichedSubtasks = vi.mocked(fetchEnrichedSubtasks);
const mockDeleteComment = vi.mocked(deleteComment);
const mockUpdateComment = vi.mocked(updateComment);
const mockPostTransition = vi.mocked(postTransition);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// Minimal FieldsSection issue fixture for status-transition test
const FIELDS_SECTION_ISSUE = {
  id: '10001',
  key: ISSUE_KEY,
  fields: {
    summary: 'Test issue',
    status: { id: '1', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
    assignee: { displayName: 'Alice', name: 'alice', avatarUrls: { '48x48': '' } },
    reporter: { displayName: 'Bob', name: 'bob', emailAddress: 'bob@example.com', avatarUrls: { '48x48': '' } },
    priority: { name: 'Medium' },
    issuetype: { id: '10001', name: 'Story', subtask: false },
    project: { id: '1', key: 'PROJ', name: 'Project' },
    description: null,
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
    watches: { watchCount: 0, isWatching: false },
    customfield_10014: null,
    customfield_10020: null,
  },
};

// Minimal no-op mutation prop for FieldsSection
const noopMutation = {
  mutate: () => {},
  isPending: false,
  isError: false,
  isSuccess: false,
  isIdle: true,
  reset: () => {},
  status: 'idle' as const,
  data: undefined,
  error: null,
  variables: undefined,
  context: undefined,
  failureCount: 0,
  failureReason: null,
  submittedAt: 0,
  mutateAsync: () => Promise.resolve(undefined),
};

// Comment fixture authored by logged-in user (Alice) — used for mutation tests
const MOCK_COMMENT = {
  id: 'c1',
  author: { displayName: 'Alice', name: 'alice', emailAddress: 'alice@example.com' },
  body: 'Hello world',
  created: '2026-01-01T10:00:00.000Z',
  updated: '2026-01-01T10:00:00.000Z',
};

function renderPage(client?: QueryClient) {
  const qc = client ?? makeQueryClient();
  return {
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/issue/${ISSUE_KEY}`]}>
          <IssueDetailPage />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
    queryClient: qc,
  };
}

function setupDefaultStores() {
  // useSettingsStore is called with selectors — mock as implementation
  mockUseSettingsStore.mockImplementation((selector?: unknown) => {
    const store = {
      epicLinkFieldKey: 'customfield_10014',
      epicNameFieldKey: 'customfield_10010',
      sprintFieldKey: 'customfield_10020',
      storyPointsFieldKey: 'customfield_10016',
      epicColorFieldKey: undefined,
      issueDetailPanelWidth: 400,
      setIssueDetailPanelWidth: () => {},
      commentSortOrder: 'newest',
    };
    if (typeof selector === 'function') return selector(store);
    return store;
  });

  mockUseAuthStore.mockImplementation((selector?: unknown) => {
    const store = {
      jiraBaseUrl: JIRA_BASE_URL,
      jiraConnected: true,
      jiraUserDisplayName: 'Alice',
    };
    if (typeof selector === 'function') return selector(store);
    return store;
  });

  mockUseBreadcrumbStore.mockImplementation((selector?: unknown) => {
    const store = { trail: [], pop: () => {} };
    if (typeof selector === 'function') return selector(store);
    return store;
  });

  mockUsePinnedTabsStore.mockImplementation((selector?: unknown) => {
    const store = { pinnedKeys: [], togglePin: () => {} };
    if (typeof selector === 'function') return selector(store);
    return store;
  });

  mockUseRecentItemsStore.mockImplementation((selector?: unknown) => {
    const store = { pushItem: () => {} };
    if (typeof selector === 'function') return selector(store);
    return store;
  });
}

// --- Tests ---

describe('IssueDetailPage — progressive rendering (Wave 0 RED gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDelayedLoading.mockReturnValue(false);
    setupDefaultStores();
    mockFetchIssueDetail.mockResolvedValue(BASE_ISSUE as never);
    mockFetchComments.mockReturnValue(new Promise(() => {})); // never resolves
    mockFetchIssueChangelog.mockReturnValue(new Promise(() => {})); // never resolves
    mockFetchEnrichedSubtasks.mockReturnValue(new Promise(() => {})); // never resolves
  });

  // PERF-DETAIL-01: header renders before comments query resolves
  it('renders issue title when base query resolves but comments query is still pending', async () => {
    // Base issue resolves immediately; comments query is pending (never resolves mock above)
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Test issue title')).toBeTruthy();
    });
    // The page should show the header without waiting for comments
    expect(screen.getByText(ISSUE_KEY)).toBeTruthy();
  });

  // PERF-DETAIL-02: comments-skeleton shown when comments query isPending + useDelayedLoading true
  it('renders comments-skeleton when comments query is pending and useDelayedLoading returns true', async () => {
    // useDelayedLoading returns true → skeleton should render
    mockUseDelayedLoading.mockReturnValue(true);
    mockFetchComments.mockReturnValue(new Promise(() => {}));

    renderPage();
    await waitFor(() => {
      // Base issue is loaded
      expect(screen.getByText('Test issue title')).toBeTruthy();
    });

    // comments-skeleton must be present (independent of base issue gate)
    expect(screen.getByTestId('comments-skeleton')).toBeTruthy();
  });

  // PERF-DETAIL-02: subtasks-skeleton shown when subtask enrichment query isPending
  it('renders subtasks-skeleton when subtask enrichment query is pending and useDelayedLoading returns true', async () => {
    const issueWithSubtasks = {
      ...BASE_ISSUE,
      fields: {
        ...BASE_ISSUE.fields,
        subtasks: [
          {
            id: '10002',
            key: 'PROJ-124',
            fields: {
              summary: 'Subtask 1',
              status: { name: 'To Do', statusCategory: { key: 'new' } },
              assignee: null,
            },
          },
        ],
      },
    };
    mockFetchIssueDetail.mockResolvedValue(issueWithSubtasks as never);
    mockUseDelayedLoading.mockReturnValue(true);
    mockFetchEnrichedSubtasks.mockReturnValue(new Promise(() => {}));

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Test issue title')).toBeTruthy();
    });

    // subtasks-skeleton must be present while enrichment is pending
    expect(screen.getByTestId('subtasks-skeleton')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PERF-DETAIL-03: Invalidation fan-out assertions
// ---------------------------------------------------------------------------

describe('invalidation fan-out (PERF-DETAIL-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDelayedLoading.mockReturnValue(false);
    setupDefaultStores();
    mockFetchIssueDetail.mockResolvedValue(BASE_ISSUE as never);
    mockFetchComments.mockResolvedValue([MOCK_COMMENT]);
    mockFetchIssueChangelog.mockResolvedValue([]);
    mockFetchEnrichedSubtasks.mockResolvedValue([]);
    mockDeleteComment.mockResolvedValue(undefined);
    mockUpdateComment.mockResolvedValue(MOCK_COMMENT as never);
    mockPostTransition.mockResolvedValue(undefined);
  });

  // PERF-DETAIL-03: deleting a comment invalidates jira-issue-comments
  it('comment delete mutation invalidates jira-issue-comments key', async () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    // Pre-seed the comments query so comments are already "loaded"
    qc.setQueryData(['jira-issue-comments', ISSUE_KEY, JIRA_BASE_URL], [MOCK_COMMENT]);

    // Trigger deletion directly via the mock — simulate what the mutation's
    // onSuccess does by calling deleteComment (already mocked) then waiting.
    // We render the page so the mutation handler is wired up, then call
    // deleteMutation.mutate via the rendered delete button.
    const user = userEvent.setup();

    // mock mergeTimeline to return a comment-type entry so CommentCard renders
    const { mergeTimeline, filterTimeline } = await import('@/services/jira');
    vi.mocked(mergeTimeline).mockReturnValue([{ type: 'comment', data: MOCK_COMMENT }] as never);
    vi.mocked(filterTimeline).mockReturnValue([{ type: 'comment', data: MOCK_COMMENT }] as never);

    renderPage(qc);

    // Wait for the issue to load
    await waitFor(() => expect(screen.getByText('Test issue title')).toBeTruthy());

    // The CommentCard 3-dot menu button (aria-label="Comment actions") is rendered
    // only for own comments (author.displayName === jiraUserDisplayName === 'Alice')
    const menuButton = await screen.findByLabelText('Comment actions');
    await user.click(menuButton);

    // Click the Delete button in the menu
    const deleteButton = await screen.findByRole('button', { name: /delete/i });
    // Bypass the window.confirm dialog
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    await user.click(deleteButton);

    // Wait for deleteComment to be called and onSuccess to fire
    await waitFor(() => expect(mockDeleteComment).toHaveBeenCalled());

    // Assert jira-issue-comments was invalidated
    await waitFor(() => {
      const calls = spy.mock.calls.map((c) => c[0]);
      expect(
        calls.some(
          (arg) =>
            Array.isArray((arg as { queryKey?: unknown }).queryKey) &&
            (arg as { queryKey: unknown[] }).queryKey[0] === 'jira-issue-comments',
        ),
      ).toBe(true);
    });
  });

  // PERF-DETAIL-03: editing a comment invalidates jira-issue-comments
  it('comment edit mutation invalidates jira-issue-comments key', async () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    qc.setQueryData(['jira-issue-comments', ISSUE_KEY, JIRA_BASE_URL], [MOCK_COMMENT]);

    const { mergeTimeline, filterTimeline } = await import('@/services/jira');
    vi.mocked(mergeTimeline).mockReturnValue([{ type: 'comment', data: MOCK_COMMENT }] as never);
    vi.mocked(filterTimeline).mockReturnValue([{ type: 'comment', data: MOCK_COMMENT }] as never);

    const { fireEvent } = await import('@testing-library/react');

    renderPage(qc);
    await waitFor(() => expect(screen.getByText('Test issue title')).toBeTruthy());

    // Open the 3-dot comment actions menu, then click Edit inside it.
    // Use the parent container of the menu button to scope button lookups and avoid
    // collisions with the "Edit" button in IssueDetailContent's action row.
    const { within } = await import('@testing-library/react');
    const menuButton = await screen.findByLabelText('Comment actions');
    const menuContainer = menuButton.closest('.relative') as HTMLElement;
    fireEvent.click(menuButton);

    // The dropdown is rendered inside the same .relative container
    const editButton = within(menuContainer).getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    // After clicking Edit, the CommentCard switches to edit mode — a Textarea
    // pre-filled with the comment body appears inside the comment card.
    await waitFor(() => {
      const textareas = screen.getAllByRole('textbox');
      const editingTextarea = textareas.find(
        (el) => (el as HTMLTextAreaElement).value === MOCK_COMMENT.body,
      );
      expect(editingTextarea).toBeTruthy();
    });
    const textareas = screen.getAllByRole('textbox');
    const editTextarea = textareas.find(
      (el) => (el as HTMLTextAreaElement).value === MOCK_COMMENT.body,
    );
    if (!editTextarea) throw new Error('edit textarea not found');

    fireEvent.change(editTextarea, { target: { value: 'Updated comment text' } });

    // The Save button is inside the edit form
    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockUpdateComment).toHaveBeenCalled());

    await waitFor(() => {
      const calls = spy.mock.calls.map((c) => c[0]);
      expect(
        calls.some(
          (arg) =>
            Array.isArray((arg as { queryKey?: unknown }).queryKey) &&
            (arg as { queryKey: unknown[] }).queryKey[0] === 'jira-issue-comments',
        ),
      ).toBe(true);
    });
  });

  // PERF-DETAIL-03: status transition invalidates jira-issue-changelog
  it('status transition mutation invalidates jira-issue-changelog key', async () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    // Render FieldsSection directly with a stubbed StatusPopover that calls onSelect
    const { render: rtlRender } = await import('@testing-library/react');
    const user = userEvent.setup();

    const { default: React2 } = await import('react');

    rtlRender(
      <QueryClientProvider client={qc}>
        <FieldsSection
          issue={FIELDS_SECTION_ISSUE as never}
          issueKey={ISSUE_KEY}
          jiraBaseUrl={JIRA_BASE_URL}
          storyPointsFieldKey="customfield_10016"
          epicLinkFieldKey="customfield_10014"
          epicNameFieldKey="customfield_10010"
          sprintFieldKey="customfield_10020"
          epicColorFieldKey="customfield_10013"
          mutation={noopMutation as never}
          epicIssue={null}
          onOpenIssue={undefined}
        />
      </QueryClientProvider>,
    );

    // The stub StatusPopover renders as a button that calls onSelect('done-transition-id', 'Done')
    const statusButton = screen.getByTestId('status-popover-trigger');
    await user.click(statusButton);

    // postTransition resolves immediately (mock)
    await waitFor(() => expect(mockPostTransition).toHaveBeenCalled());

    // Assert jira-issue-changelog was invalidated in onSettled
    await waitFor(() => {
      const calls = spy.mock.calls.map((c) => c[0]);
      expect(
        calls.some(
          (arg) =>
            Array.isArray((arg as { queryKey?: unknown }).queryKey) &&
            (arg as { queryKey: unknown[] }).queryKey[0] === 'jira-issue-changelog',
        ),
      ).toBe(true);
    });

    // Suppress unused import warning
    void React2;
  });
});
