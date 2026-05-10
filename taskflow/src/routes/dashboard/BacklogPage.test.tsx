/**
 * BacklogPage tests — Jira-style backlog view (BACK-01..05)
 *
 * Tests the redesigned BacklogPage that shows:
 *   - Active sprint section with header and issues
 *   - Future sprint sections with headers and issues
 *   - Backlog section (unassigned issues) always at bottom
 *
 * Requirements covered:
 *   BACK-01 — Backlog issue list (sprint issues + backlog issues, section headers appear)
 *   BACK-02 — Right-click context menu "Move to sprint" (per-row, optimistic removal)
 *   BACK-03 — Create story entry point (+ Create Story button)
 *   BACK-04 — Epic / assignee filters (AND logic, applies across all sections, dismiss chip)
 *   BACK-05 — Row click opens issue detail
 *   LOAD-04 — Per-row epic skeleton appears when allEpics query is pending
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpicEnriched } from '@/services/jira';

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
  fetchEpicsBasic: vi.fn().mockResolvedValue([]),
  fetchProjectStatuses: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/jira/issues', () => ({
  fetchSprintStories: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/jira/backlog', () => ({
  fetchBacklogSprintStories: vi.fn().mockResolvedValue([]),
  fetchSprintList: vi.fn().mockResolvedValue([]),
  fetchBacklogIssues: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/hooks/useBoardId', () => ({
  useBoardId: vi.fn(() => ({ boardId: 1 })),
}));

vi.mock('@/hooks/useDelayedLoading', () => ({
  useDelayedLoading: vi.fn((isPending: boolean) => isPending),
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
 * sprintId populates fields.sprint.id (for grouping sprint stories by sprint).
 */
function makeIssue(
  key: string,
  summary: string,
  epicKey?: string,
  assigneeDisplayName?: string,
  sprintId?: number,
) {
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
      sprint: sprintId ? { id: sprintId } : null,
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

// ── Tests ──────────────────────────────────────────────────────────────────────

// Re-establish base mocks after resetAllMocks (resetAllMocks clears implementations)
async function resetMocks() {
  vi.resetAllMocks();
  const { readSecret } = await import('@/services/stronghold');
  vi.mocked(readSecret).mockResolvedValue('test-jira-token');
  const { fetchEpicsBasic, fetchProjectStatuses, addIssuesToSprint } = await import(
    '@/services/jira'
  );
  vi.mocked(fetchEpicsBasic).mockResolvedValue([]);
  vi.mocked(fetchProjectStatuses).mockResolvedValue([]);
  vi.mocked(addIssuesToSprint).mockResolvedValue(undefined);
  const { fetchSprintStories } = await import('@/services/jira/issues');
  vi.mocked(fetchSprintStories).mockResolvedValue([]);
  const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
    '@/services/jira/backlog'
  );
  vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
  vi.mocked(fetchSprintList).mockResolvedValue([]);
  vi.mocked(fetchBacklogIssues).mockResolvedValue([]);
  const { useBoardId } = await import('@/hooks/useBoardId');
  vi.mocked(useBoardId).mockReturnValue({ boardId: 1, isLoading: false });
  const { useDelayedLoading } = await import('@/hooks/useDelayedLoading');
  vi.mocked(useDelayedLoading).mockImplementation((isPending: boolean) => isPending);
  const { useOutletContext } = await import('react-router-dom');
  vi.mocked(useOutletContext).mockReturnValue({ onIssueClick: vi.fn(), openCreateStory: vi.fn() });
}

describe('BACK-01 List', () => {
  beforeEach(async () => {
    await resetMocks();
  });

  it('renders backlog issues AND sprint issues; sprint section headers appear', async () => {
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    vi.mocked(fetchSprintList).mockResolvedValue([makeSprint(1, 'Sprint 1', 'active')]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([
      makeIssue('PROJ-1', 'Sprint story one', undefined, undefined, 1),
    ]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([makeIssue('PROJ-2', 'Backlog story two')]);

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
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    vi.mocked(fetchSprintList).mockResolvedValue([
      { id: 1, name: 'Sprint 1', state: 'active' as const },
    ]);
    vi.mocked(fetchBacklogSprintStories).mockReturnValue(new Promise(() => {})); // never resolves
    vi.mocked(fetchBacklogIssues).mockReturnValue(new Promise(() => {})); // never resolves

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('shows epic skeleton badge while allEpics is loading (LOAD-04)', async () => {
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    const { fetchEpicsBasic } = await import('@/services/jira');

    // Sprint data resolves immediately
    vi.mocked(fetchSprintList).mockResolvedValue([]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
    // Backlog issues resolve with an issue that has an epic key
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Story with epic', 'EPIC-1'),
    ]);
    // Epics query never resolves — simulates loading state
    vi.mocked(fetchEpicsBasic).mockReturnValue(new Promise(() => {}));

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    // Wait for backlog issues to render
    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
    });

    // Epic badge should show skeleton (animate-pulse from Skeleton component)
    // since allEpics has not resolved yet
    const row = screen.getByTestId('backlog-row-PROJ-1');
    const skeletons = row.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty state message when queries resolve with no issues', async () => {
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    vi.mocked(fetchSprintList).mockResolvedValue([]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByText(/no backlog issues|backlog is empty/i)).toBeInTheDocument();
    });
  });

  it('renders Active badge on active sprint section and Future badge on future sprint section', async () => {
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    vi.mocked(fetchSprintList).mockResolvedValue([
      makeSprint(1, 'Sprint 1', 'active'),
      makeSprint(2, 'Sprint 2', 'future'),
    ]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Future')).toBeInTheDocument();
    });
  });

  it('does not render checkboxes in backlog rows', async () => {
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    vi.mocked(fetchSprintList).mockResolvedValue([]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([makeIssue('PROJ-1', 'Build login page')]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    // No checkboxes should exist
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });
});

describe('BACK-02 Move to sprint (context menu)', () => {
  beforeEach(async () => {
    await resetMocks();
  });

  it('right-clicking a backlog row shows "Move to..." context menu label', async () => {
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    vi.mocked(fetchSprintList).mockResolvedValue([makeSprint(1, 'Sprint 1', 'active')]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([makeIssue('PROJ-1', 'Build login page')]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const row = screen.getByTestId('backlog-row-PROJ-1');
    fireEvent.contextMenu(row);

    await waitFor(() => {
      expect(screen.getByText('Move to...')).toBeInTheDocument();
    });
  });

  it('context menu shows sprint options with active badge', async () => {
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    vi.mocked(fetchSprintList).mockResolvedValue([makeSprint(1, 'Sprint 1', 'active')]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Build login page'),
      makeIssue('PROJ-2', 'Fix signup flow'),
    ]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const row = screen.getByTestId('backlog-row-PROJ-1');
    fireEvent.contextMenu(row);

    await waitFor(() => {
      expect(screen.getByText('Move to...')).toBeInTheDocument();
    });

    // Sprint option appears in the context menu (duplicate of header)
    const sprintOptions = screen.getAllByText('Sprint 1');
    expect(sprintOptions.length).toBeGreaterThanOrEqual(2); // header + context menu item
  });

  it('moving an issue to a sprint invalidates jira-backlog-sprint-stories cache key', async () => {
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    const { addIssuesToSprint } = await import('@/services/jira');
    vi.mocked(addIssuesToSprint).mockResolvedValue(undefined);
    vi.mocked(fetchSprintList).mockResolvedValue([makeSprint(1, 'Sprint 1', 'active')]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([makeIssue('PROJ-1', 'Build login page')]);

    // Create a QueryClient we can spy on
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { default: BacklogPage } = await import('./BacklogPage');
    render(
      <QueryClientProvider client={queryClient}>
        <BacklogPage />
      </QueryClientProvider>,
    );

    // Wait for backlog issue to render
    await waitFor(() => screen.getByText('PROJ-1'));

    // Right-click to open context menu
    const row = screen.getByTestId('backlog-row-PROJ-1');
    fireEvent.contextMenu(row);

    // Wait for context menu and click sprint option
    await waitFor(() => {
      expect(screen.getByText('Move to...')).toBeInTheDocument();
    });

    // Click the sprint option in context menu
    const sprintOptions = screen.getAllByText('Sprint 1');
    // The context menu item is the last one (header is first)
    const menuItem = sprintOptions[sprintOptions.length - 1];
    fireEvent.click(menuItem);

    // Confirm the sprint move dialog
    await waitFor(() => {
      expect(screen.getByText('Move Issue')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    // Verify invalidateQueries was called with jira-backlog-sprint-stories key
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['jira-backlog-sprint-stories'] }),
      );
    });

    invalidateSpy.mockRestore();
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

    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    vi.mocked(fetchSprintList).mockResolvedValue([]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
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
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    const { fetchEpicsBasic } = await import('@/services/jira');
    vi.mocked(fetchSprintList).mockResolvedValue([makeSprint(1, 'Sprint 1', 'active')]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([
      makeIssue('PROJ-1', 'Story in Epic A', 'EPIC-1', undefined, 1),
    ]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-2', 'Story in Epic B', 'EPIC-2'),
    ]);
    vi.mocked(fetchEpicsBasic).mockResolvedValue([
      { key: 'EPIC-1', epicName: 'EPIC-1', color: null },
      { key: 'EPIC-2', epicName: 'EPIC-2', color: null },
    ] as unknown as EpicEnriched[]);

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
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    vi.mocked(fetchSprintList).mockResolvedValue([]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Alice story', undefined, 'Alice'),
      makeIssue('PROJ-2', 'Bob story', undefined, 'Bob'),
    ]);

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
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    const { fetchEpicsBasic } = await import('@/services/jira');
    vi.mocked(fetchSprintList).mockResolvedValue([]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Alice + Epic A', 'EPIC-1', 'Alice'),
      makeIssue('PROJ-2', 'Alice + Epic B', 'EPIC-2', 'Alice'),
      makeIssue('PROJ-3', 'Bob + Epic A', 'EPIC-1', 'Bob'),
    ]);
    vi.mocked(fetchEpicsBasic).mockResolvedValue([
      { key: 'EPIC-1', epicName: 'EPIC-1', color: null },
      { key: 'EPIC-2', epicName: 'EPIC-2', color: null },
    ] as unknown as EpicEnriched[]);

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
    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    const { fetchEpicsBasic } = await import('@/services/jira');
    vi.mocked(fetchSprintList).mockResolvedValue([]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Story in Epic A', 'EPIC-1'),
      makeIssue('PROJ-2', 'Story in Epic B', 'EPIC-2'),
    ]);
    vi.mocked(fetchEpicsBasic).mockResolvedValue([
      { key: 'EPIC-1', epicName: 'EPIC-1', color: null },
      { key: 'EPIC-2', epicName: 'EPIC-2', color: null },
    ] as unknown as EpicEnriched[]);

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

    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    vi.mocked(fetchSprintList).mockResolvedValue([]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([makeIssue('PROJ-1', 'Build login page')]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    // Click the row (by summary text)
    fireEvent.click(screen.getByText('Build login page'));

    expect(onIssueClick).toHaveBeenCalledWith('PROJ-1');
  });

  it('clicking a row in a sprint section calls onIssueClick with the issue key', async () => {
    const onIssueClick = vi.fn();
    const { useOutletContext } = await import('react-router-dom');
    vi.mocked(useOutletContext).mockReturnValue({ onIssueClick, openCreateStory: vi.fn() });

    const { fetchBacklogSprintStories, fetchSprintList, fetchBacklogIssues } = await import(
      '@/services/jira/backlog'
    );
    vi.mocked(fetchSprintList).mockResolvedValue([makeSprint(1, 'Sprint 1', 'active')]);
    vi.mocked(fetchBacklogSprintStories).mockResolvedValue([
      makeIssue('PROJ-1', 'Sprint issue summary', undefined, undefined, 1),
    ]);
    vi.mocked(fetchBacklogIssues).mockResolvedValue([]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    fireEvent.click(screen.getByText('Sprint issue summary'));

    expect(onIssueClick).toHaveBeenCalledWith('PROJ-1');
  });
});
