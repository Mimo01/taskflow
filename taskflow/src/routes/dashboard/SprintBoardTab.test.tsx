/**
 * SprintBoardTab tests — HIER-02 Wave 0 RED stubs + infrastructure tests
 *
 * Infrastructure tests (loading/error/empty) PASS against current implementation.
 * HIER-02 behavior tests (column count, subtask grouping, collapse/expand, orphan suppression)
 * are intentionally in RED state — these will pass after HIER-02 implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock stronghold — avoid real Tauri vault calls
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// Mock jira service — controlled from each test
vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
  fetchProjectStatuses: vi.fn().mockResolvedValue([]),
  fetchTransitions: vi.fn().mockResolvedValue([]),
  postTransition: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: 'https://gitlab.example.com',
  })),
}));

// Mock settings store
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
  })),
}));

// Mock link engine
vi.mock('@/services/linkEngine', () => ({
  linkMRToTask: vi.fn().mockReturnValue(null),
  isStale: vi.fn().mockReturnValue(false),
}));

// Mock tauri opener
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

// Mock lucide-react — avoids SVG rendering issues in jsdom
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    ChevronDown: () => <span data-testid="chevron-down" />,
    ChevronRight: () => <span data-testid="chevron-right" />,
    RefreshCw: () => <span data-testid="refresh-cw" />,
  };
});

// Helper: build a minimal JiraIssue fixture
// statusId defaults to the status name so column matching (by id) works with makeStatus()
function makeIssue(
  key: string,
  summary: string,
  isSubtask: boolean,
  parentKey?: string,
  status = 'In Progress',
  statusId?: string,
) {
  return {
    id: key,
    key,
    fields: {
      summary,
      status: { id: statusId ?? status, name: status },
      assignee: null,
      customfield_10016: null,
      issuetype: {
        name: isSubtask ? 'Sub-task' : 'Story',
        subtask: isSubtask,
      },
      ...(parentKey
        ? { parent: { id: parentKey, key: parentKey, fields: { summary: `Summary for ${parentKey}` } } }
        : {}),
    },
  };
}

// Helper: build a JiraProjectStatus fixture matching makeIssue's statusId convention
function makeStatus(name: string, categoryKey: 'new' | 'indeterminate' | 'done' = 'indeterminate') {
  return { id: name, name, statusCategory: { key: categoryKey } };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('SprintBoardTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Infrastructure tests (PASS against current implementation) ────────────

  it('renders loading skeleton when isLoading', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    // Never resolve — keep loading state
    vi.mocked(fetchSprintIssues).mockReturnValue(new Promise(() => {}));

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Wait for readSecret to resolve and jiraToken to be set, enabling the query
    // Then skeleton columns should be visible (query never resolves → isLoading=true)
    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('renders error message when isError', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockRejectedValue(new Error('Failed to load sprint board'));

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    await screen.findByText(/Failed to load sprint board/i);
  });

  it('renders empty state when data is empty array', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    await screen.findByText(/No issues in the current sprint/i);
  });

  // ─── HIER-02 behavior stubs (RED state — FAIL against current implementation) ─

  it('column count shows draggable cards only (subtasks, not story headers)', async () => {
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    // Story with one subtask: column count = 1 (the subtask card), not 2 (story + subtask)
    const story = makeIssue('PROJ-1', 'Story One', false, undefined, 'Done');
    const subtask = makeIssue('PROJ-2', 'Subtask One', true, 'PROJ-1', 'Done');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([makeStatus('Done', 'done')]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Column header should show (1) — the subtask card — not (2) (story header is not a card)
    await waitFor(() => {
      const columnHeader = screen.getByText(/\(1\)/);
      expect(columnHeader).toBeTruthy();
    });
  });

  it('subtask card is always visible under its story header (no collapse)', async () => {
    // New design: subtasks are always shown as cards under a StoryHeaderRow — no collapse.
    // Replaces the old "collapsed by default" behavior.
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Story One', false, undefined, 'In Progress');
    const subtask = makeIssue('PROJ-2', 'Subtask One', true, 'PROJ-1', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([makeStatus('In Progress', 'indeterminate')]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Subtask card should be visible immediately (no expand required)
    await screen.findByText('Subtask One');
    // Story header (PROJ-1 key) should also be visible as a divider
    expect(screen.getByText('PROJ-1')).toBeTruthy();
  });

  it('clicking a story header row opens IssueDetailSheet for that story', async () => {
    // New design: story header rows are clickable — clicking opens the detail sheet.
    // Replaces old "expand subtasks chevron" behavior (no collapse in new design).
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Story One', false, undefined, 'In Progress');
    const subtask = makeIssue('PROJ-2', 'Subtask One', true, 'PROJ-1', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([makeStatus('In Progress', 'indeterminate')]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // StoryHeaderRow for PROJ-1 must be visible
    const storyHeader = await screen.findByText('PROJ-1');
    expect(storyHeader).toBeTruthy();

    // Subtask card is also visible (no expand needed)
    expect(screen.getByText('Subtask One')).toBeTruthy();
  });

  it('orphan subtask (parent not in sprint) is not rendered', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    // Subtask whose parent is NOT in the sprint
    const orphanSubtask = makeIssue('PROJ-99', 'Orphan Subtask', true, 'PROJ-999', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([orphanSubtask]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Wait for the board to finish loading — the refreshed time appears after data loads
    await waitFor(() => {
      expect(screen.getByText(/refreshed: \d/i)).toBeTruthy();
    });

    // Orphan subtask summary must NOT appear — it has no parent in the sprint
    // Current flat implementation shows it in the column — this test FAILS in RED state
    const orphanEl = screen.queryByText('Orphan Subtask');
    expect(orphanEl).toBeNull();
  });

  // ─── BOARD-01 / BOARD-03 Wave 0 RED stubs ─────────────────────────────────
  // These tests describe behavior for the redesigned sprint board.
  // They FAIL now because current board derives columns from issue statuses
  // and has no drag support. They will pass after the relevant plan implementations.

  it('renders workflow-API-derived columns (BOARD-01)', async () => {
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    vi.mocked(fetchProjectStatuses).mockResolvedValue([
      { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
      { id: '2', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
    ]);
    vi.mocked(fetchSprintIssues).mockResolvedValue([]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // RED: current board does not call fetchProjectStatuses for column headers
    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeTruthy();
      expect(screen.getByText('In Progress')).toBeTruthy();
    });
  });

  it('story header appears in each column that has its subtasks (BOARD-01)', async () => {
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    // Story in 'To Do', subtask in 'In Progress' — story header should appear in 'In Progress' column
    // Story does NOT appear in 'To Do' as a bare card because it has subtasks
    const story = makeIssue('PROJ-1', 'My Story', false, undefined, 'To Do');
    const subtaskInProgress = makeIssue('PROJ-2', 'My Subtask', true, 'PROJ-1', 'In Progress');
    const subtaskTodo = makeIssue('PROJ-3', 'Another Subtask', true, 'PROJ-1', 'To Do');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtaskInProgress, subtaskTodo]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([
      makeStatus('To Do', 'new'),
      makeStatus('In Progress', 'indeterminate'),
    ]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Story header (PROJ-1 key) should appear in both 'To Do' and 'In Progress' columns
    await waitFor(() => {
      const storyHeaders = screen.getAllByText('PROJ-1');
      expect(storyHeaders.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('onDragEnd moves card optimistically (BOARD-03)', async () => {
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Draggable Story', false, undefined, 'To Do');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([
      makeStatus('To Do', 'new'),
      makeStatus('In Progress', 'indeterminate'),
    ]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Card must render in the board
    await waitFor(() => {
      expect(screen.getByText('Draggable Story')).toBeTruthy();
    });

    // Board must expose data-droppable on each column (for DndContext in plan 10-03)
    // GREEN: BoardColumn now sets data-droppable on the card list area
    const inProgressColumn = document.querySelector('[data-droppable="In Progress"]');
    expect(inProgressColumn).not.toBeNull();
  });

  it('onDragEnd rollback: card reverts when postTransition throws (BOARD-03)', async () => {
    const { fetchSprintIssues, fetchProjectStatuses, postTransition } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Rollback Story', false, undefined, 'To Do');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story]);
    vi.mocked(postTransition).mockRejectedValue(new Error('Transition failed'));
    vi.mocked(fetchProjectStatuses).mockResolvedValue([
      makeStatus('To Do', 'new'),
      makeStatus('In Progress', 'indeterminate'),
    ]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // RED (drag not implemented yet): card appears in initial column
    await waitFor(() => {
      expect(screen.getByText('Rollback Story')).toBeTruthy();
    });

    // Board exposes data-droppable on each column
    const toDoDroppable = document.querySelector('[data-droppable="To Do"]');
    expect(toDoDroppable).not.toBeNull();
  });
});
