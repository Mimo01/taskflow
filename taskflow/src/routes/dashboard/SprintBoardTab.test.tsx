/**
 * SprintBoardTab tests — HIER-02 Wave 0 RED stubs + infrastructure tests
 *
 * Infrastructure tests (loading/error/empty) PASS against current implementation.
 * HIER-02 behavior tests (column count, subtask grouping, collapse/expand, orphan suppression)
 * are intentionally in RED state — these will pass after HIER-02 implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
function makeIssue(
  key: string,
  summary: string,
  isSubtask: boolean,
  parentKey?: string,
  status = 'In Progress',
) {
  return {
    id: key,
    key,
    fields: {
      summary,
      status: { id: '3', name: status },
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

  it('column count shows stories only, not subtasks', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Story One', false, undefined, 'Done');
    const subtask = makeIssue('PROJ-2', 'Subtask One', true, 'PROJ-1', 'Done');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Wait for data to load — column header should show (1) not (2)
    // Current flat implementation will show (2) — this test FAILS in RED state
    await waitFor(() => {
      const columnHeader = screen.getByText(/\(1\)/);
      expect(columnHeader).toBeTruthy();
    });
  });

  it('subtask section is collapsed by default (subtask not visible initially)', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Story One', false, undefined, 'In Progress');
    const subtask = makeIssue('PROJ-2', 'Subtask One', true, 'PROJ-1', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Wait for story to appear
    await screen.findByText('Story One');

    // Subtask should NOT be visible by default (collapsed)
    // Current flat implementation shows it — this test FAILS in RED state
    const subtaskEl = screen.queryByText('Subtask One');
    expect(subtaskEl).toBeNull();
  });

  it('clicking chevron expands subtask section', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Story One', false, undefined, 'In Progress');
    const subtask = makeIssue('PROJ-2', 'Subtask One', true, 'PROJ-1', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Wait for story to appear
    await screen.findByText('Story One');

    // Find chevron button and click it
    // Current implementation has no chevron — this test FAILS in RED state
    const chevronBtn = screen.getByRole('button', { name: /expand subtasks/i });
    fireEvent.click(chevronBtn);

    // After click, subtask should be visible
    await screen.findByText('Subtask One');
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
    const { fetchSprintIssues } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'My Story', false, undefined, 'To Do');
    const subtask = makeIssue('PROJ-2', 'My Subtask', true, 'PROJ-1', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // RED: current board does not render story headers in subtask columns
    await waitFor(() => {
      const storyHeaders = screen.getAllByText('PROJ-1');
      expect(storyHeaders.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('onDragEnd moves card optimistically (BOARD-03)', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Draggable Story', false, undefined, 'To Do');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // RED: no drag support yet — DndContext not present, no handleDragEnd
    // After implementation, dragging the card to 'In Progress' column should
    // move it there optimistically before postTransition resolves.
    await waitFor(() => {
      expect(screen.getByText('Draggable Story')).toBeTruthy();
    });

    // Simulate drag: the board must expose a data-droppable on each column.
    // RED state: no data-droppable exists yet.
    const inProgressColumn = document.querySelector('[data-droppable="In Progress"]');
    expect(inProgressColumn).not.toBeNull();
  });

  it('onDragEnd rollback: card reverts when postTransition throws (BOARD-03)', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    const { postTransition } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Rollback Story', false, undefined, 'To Do');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story]);
    vi.mocked(postTransition).mockRejectedValue(new Error('Transition failed'));

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // RED: no drag rollback support yet — requires DragEndEvent handler with error recovery
    await waitFor(() => {
      expect(screen.getByText('Rollback Story')).toBeTruthy();
    });

    // After postTransition throws, card must still appear in original 'To Do' column.
    // RED state: no drag mechanism exists yet.
    const toDoDroppable = document.querySelector('[data-droppable="To Do"]');
    expect(toDoDroppable).not.toBeNull();
  });
});
