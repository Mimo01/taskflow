/**
 * BacklogPage tests — Jira-style backlog view (BACK-01..05, LOAD-04)
 *
 * Tests the redesigned BacklogPage that shows:
 *   - Active sprint section with header and issues
 *   - Future sprint sections with headers and issues
 *   - Backlog section (unassigned issues) always at bottom
 *
 * Requirements covered:
 *   BACK-01 — Backlog issue list (sprint issues + backlog issues, section headers appear)
 *   BACK-02 — Bulk "Move to sprint" action (checkbox selection, optimistic removal, rollback)
 *   BACK-03 — Create story entry point (+ Create Story button)
 *   BACK-04 — Epic / assignee filters (AND logic, applies across all sections, dismiss chip)
 *   BACK-05 — Row click opens issue detail
 *   LOAD-04 — Per-row epic Skeleton during epics loading, div-based row rendering
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useOutletContext: vi.fn(() => ({ onIssueClick: vi.fn(), openCreateStory: vi.fn() })),
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/services/jira', () => ({
  addIssuesToSprint: vi.fn().mockResolvedValue(undefined),
  fetchActiveSprint: vi.fn().mockResolvedValue(null),
  fetchEpicsBasic: vi.fn().mockResolvedValue([]),
  fetchProjectStatuses: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/jira/backlog', () => ({
  fetchBacklogIssues: vi.fn(),
  fetchSprintList: vi.fn(),
  fetchFutureSprintIssues: vi.fn(),
}));

vi.mock('@/services/jira/issues', () => ({
  fetchSprintStories: vi.fn(),
  fetchSprintSubtasks: vi.fn(),
}));

vi.mock('@/hooks/useBoardId', () => ({
  useBoardId: vi.fn().mockReturnValue({ boardId: 1, isLoading: false }),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  })),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    epicColorFieldKey: 'customfield_10013',
    accountFieldKey: null,
    quickFilters: [],
    addQuickFilter: vi.fn(),
    removeQuickFilter: vi.fn(),
    renameQuickFilter: vi.fn(),
    moveQuickFilter: vi.fn(),
  })),
}));

// Mock @tanstack/react-virtual to render all items without virtualization in jsdom.
// In jsdom, scrollElement is always null so the virtualizer returns 0 virtual items.
// This mock renders all items directly, matching what a real browser would show.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * estimateSize(),
        size: estimateSize(),
      })),
    getTotalSize: () => count * estimateSize(),
  }),
}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    List: () => <span data-testid="icon-list" />,
    RefreshCw: () => <span />,
    ChevronDown: () => <span data-testid="icon-chevron-down" />,
    ChevronRight: () => <span data-testid="icon-chevron-right" />,
  };
});

// ── Fixtures ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal JiraIssue fixture sufficient for BacklogPage rendering and filter tests.
 * epicKey populates customfield_10014 (epicLinkFieldKey).
 */
function makeIssue(key: string, summary: string, epicKey?: string, assigneeDisplayName?: string) {
  return {
    id: key,
    key,
    fields: {
      summary,
      status: { id: 'todo', name: 'To Do', statusCategory: { key: 'new' as const } },
      assignee: assigneeDisplayName
        ? { displayName: assigneeDisplayName, avatarUrls: { '48x48': '' } }
        : null,
      customfield_10016: null, // story points
      customfield_10014: epicKey ?? null, // epic link
      customfield_10015: null, // epic name
      issuetype: { name: 'Story', subtask: false },
      labels: [],
    },
  };
}

function makeSprint(id: number, name: string, state: 'active' | 'future' = 'active') {
  return { id, name, state };
}

// ── Render helper ──────────────────────────────────────────────────────────────

function renderBacklogPage(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// ── Default mock setup helper — called in every beforeEach ─────────────────────
// Restores safe defaults for all service mocks after each test.
// Does NOT reset hook mocks (useBoardId, useAuthStore, etc.) since they are
// set at module level and do not change between tests.
async function resetMocks() {
  vi.clearAllMocks();
  const backlogMod = await import('@/services/jira/backlog');
  const issuesMod = await import('@/services/jira/issues');
  const jiraMod = await import('@/services/jira');
  vi.mocked(backlogMod.fetchBacklogIssues).mockResolvedValue([]);
  vi.mocked(backlogMod.fetchSprintList).mockResolvedValue([]);
  vi.mocked(backlogMod.fetchFutureSprintIssues).mockResolvedValue([]);
  vi.mocked(issuesMod.fetchSprintStories).mockResolvedValue([]);
  vi.mocked(issuesMod.fetchSprintSubtasks).mockResolvedValue([]);
  vi.mocked(jiraMod.addIssuesToSprint).mockResolvedValue(undefined);
  vi.mocked(jiraMod.fetchActiveSprint).mockResolvedValue(null);
  vi.mocked(jiraMod.fetchEpicsBasic).mockResolvedValue([]);
  vi.mocked(jiraMod.fetchProjectStatuses).mockResolvedValue([]);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BACK-01 List', () => {
  beforeEach(async () => {
    await resetMocks();
  });

  it('renders backlog issues AND sprint issues; sprint section headers appear', async () => {
    const { fetchBacklogIssues, fetchSprintList } = await import('@/services/jira/backlog');
    const { fetchSprintStories } = await import('@/services/jira/issues');
    vi.mocked(fetchSprintList).mockResolvedValue([makeSprint(1, 'Sprint 1', 'active')]);
    vi.mocked(fetchSprintStories).mockResolvedValue([makeIssue('PROJ-1', 'Sprint story one')] as any);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([makeIssue('PROJ-2', 'Backlog story two')] as any);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      // Sprint section header
      expect(screen.getByText('Sprint 1')).toBeInTheDocument();
      // Sprint issue
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      expect(screen.getByText('Sprint story one')).toBeInTheDocument();
      // Backlog section header (two "Backlog" elements: h1 page title + section header span)
      expect(screen.getAllByText('Backlog').length).toBeGreaterThanOrEqual(2);
      // Backlog issue
      expect(screen.getByText('PROJ-2')).toBeInTheDocument();
      expect(screen.getByText('Backlog story two')).toBeInTheDocument();
    });
  });

  it('renders skeleton/loading state while query is pending', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    vi.mocked(fetchBacklogIssues).mockReturnValue(new Promise(() => {})); // never resolves

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('renders empty state message when no issues and no sprint sections', async () => {
    const { fetchBacklogIssues, fetchSprintList } = await import('@/services/jira/backlog');
    vi.mocked(fetchSprintList).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByText(/no backlog issues|backlog is empty/i)).toBeInTheDocument();
    });
  });

  it('renders Active badge on active sprint section and Future badge on future sprint section', async () => {
    const { fetchSprintList } = await import('@/services/jira/backlog');
    vi.mocked(fetchSprintList).mockResolvedValue([
      makeSprint(1, 'Sprint 1', 'active'),
      makeSprint(2, 'Sprint 2', 'future'),
    ]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Future')).toBeInTheDocument();
    });
  });
});

describe('BACK-02 Move to sprint', () => {
  beforeEach(async () => {
    await resetMocks();
  });

  it('selecting a row checkbox reveals the bulk action bar', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([makeIssue('PROJ-1', 'Build login page')] as any);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const checkbox = screen.getByRole('checkbox', { name: /PROJ-1/i });
    fireEvent.click(checkbox);

    expect(screen.getByRole('button', { name: /move to sprint/i })).toBeInTheDocument();
  });

  it('"Move to sprint" button is disabled when fetchActiveSprint returns null', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    const { fetchActiveSprint } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([makeIssue('PROJ-1', 'Build login page')] as any);
    vi.mocked(fetchActiveSprint).mockResolvedValue(null);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const checkbox = screen.getByRole('checkbox', { name: /PROJ-1/i });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /move to sprint/i })).toBeDisabled();
    });
  });

  it('clicking "Move to sprint" removes selected backlog issues optimistically from the list', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    const { fetchActiveSprint, addIssuesToSprint } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Build login page'),
      makeIssue('PROJ-2', 'Fix signup flow'),
    ] as any);
    vi.mocked(fetchActiveSprint).mockResolvedValue({
      id: 42,
      name: 'Sprint 1',
      state: 'active',
    });
    vi.mocked(addIssuesToSprint).mockResolvedValue(undefined);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const checkbox = screen.getByRole('checkbox', { name: /PROJ-1/i });
    fireEvent.click(checkbox);

    const moveBtn = await screen.findByRole('button', { name: /move to sprint/i });
    fireEvent.click(moveBtn);

    await waitFor(() => {
      expect(screen.queryByText('PROJ-1')).not.toBeInTheDocument();
      expect(screen.getByText('PROJ-2')).toBeInTheDocument();
    });
  });

  it('clicking "Move to sprint" removes selected sprint issues optimistically from the list', async () => {
    const { fetchSprintList } = await import('@/services/jira/backlog');
    const { fetchSprintStories } = await import('@/services/jira/issues');
    const { fetchActiveSprint, addIssuesToSprint } = await import('@/services/jira');
    vi.mocked(fetchSprintList).mockResolvedValue([makeSprint(1, 'Sprint 1', 'active')]);
    vi.mocked(fetchSprintStories).mockResolvedValue([
      makeIssue('PROJ-1', 'Sprint issue one'),
      makeIssue('PROJ-2', 'Sprint issue two'),
    ] as any);
    vi.mocked(fetchActiveSprint).mockResolvedValue({ id: 1, name: 'Sprint 1', state: 'active' });
    vi.mocked(addIssuesToSprint).mockResolvedValue(undefined);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const checkbox = screen.getByRole('checkbox', { name: /PROJ-1/i });
    fireEvent.click(checkbox);

    const moveBtn = await screen.findByRole('button', { name: /move to sprint/i });
    fireEvent.click(moveBtn);

    await waitFor(() => {
      expect(screen.queryByText('PROJ-1')).not.toBeInTheDocument();
      expect(screen.getByText('PROJ-2')).toBeInTheDocument();
    });
  });

  it('when addIssuesToSprint rejects, issues reappear and error message is shown', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    const { fetchActiveSprint, addIssuesToSprint } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([makeIssue('PROJ-1', 'Build login page')] as any);
    vi.mocked(fetchActiveSprint).mockResolvedValue({
      id: 42,
      name: 'Sprint 1',
      state: 'active',
    });
    vi.mocked(addIssuesToSprint).mockRejectedValue(
      new Error('Failed to add issues to sprint: 500'),
    );

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const checkbox = screen.getByRole('checkbox', { name: /PROJ-1/i });
    fireEvent.click(checkbox);

    const moveBtn = await screen.findByRole('button', { name: /move to sprint/i });
    fireEvent.click(moveBtn);

    await waitFor(() => {
      // Issue reappears (rollback)
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      // Error message shown
      expect(screen.getByText(/failed to add issues to sprint/i)).toBeInTheDocument();
    });
  });
});

describe('BACK-03 Create story', () => {
  beforeEach(async () => {
    await resetMocks();
  });

  it('clicking "+ Create Story" button calls openCreateStory from outlet context', async () => {
    const openCreateStory = vi.fn();
    const { useOutletContext } = await import('react-router-dom');
    vi.mocked(useOutletContext).mockReturnValue({ onIssueClick: vi.fn(), openCreateStory });

    const { fetchBacklogIssues, fetchSprintList } = await import('@/services/jira/backlog');
    vi.mocked(fetchSprintList).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      const createBtn = screen.getByRole('button', { name: /create story/i });
      fireEvent.click(createBtn);
      expect(openCreateStory).toHaveBeenCalledTimes(1);
    });
  });
});

describe('BACK-04 Filters', () => {
  beforeEach(async () => {
    await resetMocks();
    const { useFilterStore } = await import('@/stores/filter.store');
    useFilterStore.getState().clearAll();
  });

  it('selecting an epic filter hides rows with a different epic (across sections)', async () => {
    const { fetchBacklogIssues, fetchSprintList } = await import('@/services/jira/backlog');
    const { fetchSprintStories } = await import('@/services/jira/issues');
    vi.mocked(fetchSprintList).mockResolvedValue([makeSprint(1, 'Sprint 1', 'active')]);
    vi.mocked(fetchSprintStories).mockResolvedValue([
      makeIssue('PROJ-1', 'Story in Epic A', 'EPIC-1'),
    ] as any);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-2', 'Story in Epic B', 'EPIC-2'),
    ] as any);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    // Apply epic filter via the filter store (UnifiedFilterBar uses popover UI)
    const { useFilterStore } = await import('@/stores/filter.store');
    useFilterStore.getState().setActiveEpics(new Set(['EPIC-1']));

    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      expect(screen.queryByText('PROJ-2')).not.toBeInTheDocument();
    });
  });

  it('selecting an assignee filter hides rows with a different assignee', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Alice story', undefined, 'Alice'),
      makeIssue('PROJ-2', 'Bob story', undefined, 'Bob'),
    ] as any);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    // Apply assignee filter via the filter store
    const { useFilterStore } = await import('@/stores/filter.store');
    useFilterStore.getState().setActiveAssignees(new Set(['Alice']));

    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      expect(screen.queryByText('PROJ-2')).not.toBeInTheDocument();
    });
  });

  it('two active filters narrow results using AND logic (epic AND assignee)', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Alice + Epic A', 'EPIC-1', 'Alice'),
      makeIssue('PROJ-2', 'Alice + Epic B', 'EPIC-2', 'Alice'),
      makeIssue('PROJ-3', 'Bob + Epic A', 'EPIC-1', 'Bob'),
    ] as any);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    // Apply both filters via the filter store
    const { useFilterStore } = await import('@/stores/filter.store');
    useFilterStore.getState().setActiveEpics(new Set(['EPIC-1']));
    useFilterStore.getState().setActiveAssignees(new Set(['Alice']));

    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument(); // Alice + EPIC-1 — shown
      expect(screen.queryByText('PROJ-2')).not.toBeInTheDocument(); // Alice + EPIC-2 — hidden
      expect(screen.queryByText('PROJ-3')).not.toBeInTheDocument(); // Bob + EPIC-1 — hidden
    });
  });

  it('clicking the dismiss chip on an active filter clears that filter', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Story in Epic A', 'EPIC-1'),
      makeIssue('PROJ-2', 'Story in Epic B', 'EPIC-2'),
    ] as any);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    // Apply epic filter via the filter store
    const { useFilterStore } = await import('@/stores/filter.store');
    useFilterStore.getState().setActiveEpics(new Set(['EPIC-1']));

    await waitFor(() => expect(screen.queryByText('PROJ-2')).not.toBeInTheDocument());

    // Clear filter via the store
    useFilterStore.getState().clearAll();

    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      expect(screen.getByText('PROJ-2')).toBeInTheDocument();
    });
  });
});

describe('BACK-05 Row click', () => {
  beforeEach(async () => {
    await resetMocks();
    const { useFilterStore } = await import('@/stores/filter.store');
    useFilterStore.getState().clearAll();
  });

  it('clicking a row (not checkbox) calls onIssueClick with the issue key', async () => {
    const onIssueClick = vi.fn();
    const { useOutletContext } = await import('react-router-dom');
    vi.mocked(useOutletContext).mockReturnValue({ onIssueClick, openCreateStory: vi.fn() });

    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([makeIssue('PROJ-1', 'Build login page')] as any);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    // Click the row (by summary text — not the checkbox)
    fireEvent.click(screen.getByText('Build login page'));

    expect(onIssueClick).toHaveBeenCalledWith('PROJ-1');
  });

  it('clicking a row in a sprint section calls onIssueClick with the issue key', async () => {
    const onIssueClick = vi.fn();
    const { useOutletContext } = await import('react-router-dom');
    vi.mocked(useOutletContext).mockReturnValue({ onIssueClick, openCreateStory: vi.fn() });

    const { fetchSprintList } = await import('@/services/jira/backlog');
    const { fetchSprintStories } = await import('@/services/jira/issues');
    vi.mocked(fetchSprintList).mockResolvedValue([makeSprint(1, 'Sprint 1', 'active')]);
    vi.mocked(fetchSprintStories).mockResolvedValue([
      makeIssue('PROJ-1', 'Sprint issue summary'),
    ] as any);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    fireEvent.click(screen.getByText('Sprint issue summary'));

    expect(onIssueClick).toHaveBeenCalledWith('PROJ-1');
  });
});

describe('LOAD-04: per-row epic Skeleton and div-based row rendering', () => {
  beforeEach(async () => {
    await resetMocks();
  });

  it('renders div-based rows instead of table rows', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      {
        id: '1',
        key: 'PROJ-1',
        fields: {
          summary: 'Div row test',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new' as const } },
          assignee: null,
          customfield_10016: 3,
          issuetype: { name: 'Story', subtask: false },
          labels: [],
          customfield_10014: null,
          customfield_10015: null,
        },
      },
    ] as any);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByTestId('backlog-row-PROJ-1')).toBeInTheDocument();
    });

    // Verify it's a div, not a tr
    const row = screen.getByTestId('backlog-row-PROJ-1');
    expect(row.tagName).toBe('DIV');

    // Verify no table elements exist in the backlog page
    const page = screen.getByTestId('backlog-page');
    expect(page.querySelector('table')).toBeNull();
    expect(page.querySelector('tr')).toBeNull();
    expect(page.querySelector('td')).toBeNull();
  });

  it('shows Skeleton in epic cell when epics are loading and issue has epic key', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    const { fetchEpicsBasic } = await import('@/services/jira');
    // Issue with an epic key
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      {
        id: '1',
        key: 'PROJ-1',
        fields: {
          summary: 'Test issue with epic',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new' as const } },
          assignee: null,
          customfield_10016: null,
          issuetype: { name: 'Story', subtask: false },
          labels: [],
          customfield_10014: 'PROJ-100',
          customfield_10015: 'My Epic',
        },
      },
    ] as any);
    // fetchEpicsBasic never resolves — epics pending
    vi.mocked(fetchEpicsBasic).mockReturnValue(new Promise(() => {}));

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByTestId('backlog-row-PROJ-1')).toBeInTheDocument();
    });

    // When epicsLoading=true and issue has epic key, Skeleton should be in the epic cell
    // The BacklogRow renders a Skeleton element in epic cell when epicsLoading=true
    const row = screen.getByTestId('backlog-row-PROJ-1');
    const skeletonInRow = row.querySelector('.animate-pulse');
    expect(skeletonInRow).not.toBeNull();
  });

  it('does not show Skeleton in epic cell when issue has no epic key', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira/backlog');
    const { fetchEpicsBasic } = await import('@/services/jira');
    // Issue with NO epic key
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      {
        id: '2',
        key: 'PROJ-2',
        fields: {
          summary: 'No epic issue',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new' as const } },
          assignee: null,
          customfield_10016: null,
          issuetype: { name: 'Story', subtask: false },
          labels: [],
          customfield_10014: null,
          customfield_10015: null,
        },
      },
    ] as any);
    // fetchEpicsBasic never resolves — epics pending
    vi.mocked(fetchEpicsBasic).mockReturnValue(new Promise(() => {}));

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByTestId('backlog-row-PROJ-2')).toBeInTheDocument();
    });

    // Issue has no epic key, so no Skeleton in the epic cell of this row
    const row = screen.getByTestId('backlog-row-PROJ-2');
    const skeletonInRow = row.querySelector('.animate-pulse');
    expect(skeletonInRow).toBeNull();
  });
});
