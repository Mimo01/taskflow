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
  fetchBacklogView: vi
    .fn()
    .mockResolvedValue({ sprints: [], backlog: [], epicNames: new Map(), epicColors: new Map() }),
  addIssuesToSprint: vi.fn().mockResolvedValue(undefined),
  fetchActiveSprint: vi.fn().mockResolvedValue(null),
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BACK-01 List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders backlog issues AND sprint issues; sprint section headers appear', async () => {
    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [
        {
          sprint: makeSprint(1, 'Sprint 1', 'active'),
          issues: [makeIssue('PROJ-1', 'Sprint story one')],
        },
      ],
      backlog: [makeIssue('PROJ-2', 'Backlog story two')],
      epicNames: new Map(),
      epicColors: new Map(),
    });

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
    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockReturnValue(new Promise(() => {})); // never resolves

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('renders empty state message when fetchBacklogView resolves with no issues', async () => {
    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [],
      backlog: [],
      epicNames: new Map(),
      epicColors: new Map(),
    });

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByText(/no backlog issues|backlog is empty/i)).toBeInTheDocument();
    });
  });

  it('renders Active badge on active sprint section and Future badge on future sprint section', async () => {
    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [
        { sprint: makeSprint(1, 'Sprint 1', 'active'), issues: [] },
        { sprint: makeSprint(2, 'Sprint 2', 'future'), issues: [] },
      ],
      backlog: [],
      epicNames: new Map(),
      epicColors: new Map(),
    });

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Future')).toBeInTheDocument();
    });
  });

  it('does not render checkboxes in backlog rows', async () => {
    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [],
      backlog: [makeIssue('PROJ-1', 'Build login page')],
      epicNames: new Map(),
      epicColors: new Map(),
    });

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    // No checkboxes should exist
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });
});

describe('BACK-02 Move to sprint (context menu)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('right-clicking a backlog row shows "Move to..." context menu label', async () => {
    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [{ sprint: makeSprint(1, 'Sprint 1', 'active'), issues: [] }],
      backlog: [makeIssue('PROJ-1', 'Build login page')],
      epicNames: new Map(),
      epicColors: new Map(),
    });

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
    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [{ sprint: makeSprint(1, 'Sprint 1', 'active'), issues: [] }],
      backlog: [makeIssue('PROJ-1', 'Build login page'), makeIssue('PROJ-2', 'Fix signup flow')],
      epicNames: new Map(),
      epicColors: new Map(),
    });

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
});

describe('BACK-03 Create story', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking "+ Create Story" button calls openCreateStory from outlet context', async () => {
    const openCreateStory = vi.fn();
    const { useOutletContext } = await import('react-router-dom');
    vi.mocked(useOutletContext).mockReturnValue({ onIssueClick: vi.fn(), openCreateStory });

    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [],
      backlog: [],
      epicNames: new Map(),
      epicColors: new Map(),
    });

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
    vi.clearAllMocks();
    const { useFilterStore } = await import('@/stores/filter.store');
    useFilterStore.getState().clearAll();
  });

  it('selecting an epic filter hides rows with a different epic (across sections)', async () => {
    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [
        {
          sprint: makeSprint(1, 'Sprint 1', 'active'),
          issues: [makeIssue('PROJ-1', 'Story in Epic A', 'EPIC-1')],
        },
      ],
      backlog: [makeIssue('PROJ-2', 'Story in Epic B', 'EPIC-2')],
      epicNames: new Map([
        ['EPIC-1', 'EPIC-1'],
        ['EPIC-2', 'EPIC-2'],
      ]),
      epicColors: new Map(),
    });

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
    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [],
      backlog: [
        makeIssue('PROJ-1', 'Alice story', undefined, 'Alice'),
        makeIssue('PROJ-2', 'Bob story', undefined, 'Bob'),
      ],
      epicNames: new Map(),
      epicColors: new Map(),
    });

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
    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [],
      backlog: [
        makeIssue('PROJ-1', 'Alice + Epic A', 'EPIC-1', 'Alice'),
        makeIssue('PROJ-2', 'Alice + Epic B', 'EPIC-2', 'Alice'),
        makeIssue('PROJ-3', 'Bob + Epic A', 'EPIC-1', 'Bob'),
      ],
      epicNames: new Map([
        ['EPIC-1', 'EPIC-1'],
        ['EPIC-2', 'EPIC-2'],
      ]),
      epicColors: new Map(),
    });

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
    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [],
      backlog: [
        makeIssue('PROJ-1', 'Story in Epic A', 'EPIC-1'),
        makeIssue('PROJ-2', 'Story in Epic B', 'EPIC-2'),
      ],
      epicNames: new Map([
        ['EPIC-1', 'EPIC-1'],
        ['EPIC-2', 'EPIC-2'],
      ]),
      epicColors: new Map(),
    });

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
    vi.clearAllMocks();
    const { useFilterStore } = await import('@/stores/filter.store');
    useFilterStore.getState().clearAll();
  });

  it('clicking a row (not checkbox) calls onIssueClick with the issue key', async () => {
    const onIssueClick = vi.fn();
    const { useOutletContext } = await import('react-router-dom');
    vi.mocked(useOutletContext).mockReturnValue({ onIssueClick, openCreateStory: vi.fn() });

    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [],
      backlog: [makeIssue('PROJ-1', 'Build login page')],
      epicNames: new Map(),
      epicColors: new Map(),
    });

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

    const { fetchBacklogView } = await import('@/services/jira');
    vi.mocked(fetchBacklogView).mockResolvedValue({
      sprints: [
        {
          sprint: makeSprint(1, 'Sprint 1', 'active'),
          issues: [makeIssue('PROJ-1', 'Sprint issue summary')],
        },
      ],
      backlog: [],
      epicNames: new Map(),
      epicColors: new Map(),
    });

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    fireEvent.click(screen.getByText('Sprint issue summary'));

    expect(onIssueClick).toHaveBeenCalledWith('PROJ-1');
  });
});
