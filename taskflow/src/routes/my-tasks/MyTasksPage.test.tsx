/**
 * MyTasksPage smoke test — MYTASK-01 (updated for 82-DESIGN-TARGET round 7)
 *
 * Verifies the page mounts and renders without throwing.
 * Checks the new structure: 3-way scope control, 3 stat tiles.
 * The GROUP control row and Updated sort toggle are removed (round 7); always My Day grouping.
 *
 * Pattern: DashboardInProgressCard.test.tsx (mock useQuery at the top,
 * provide QueryClientProvider + MemoryRouter in render helper).
 */

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDuration } from '@/services/jira/duration';

// ── Top-of-file mocks ─────────────────────────────────────────────────────────

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    }),
  };
});

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: null,
    gitlabUserId: null,
  })),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      storyPointsFieldKey: 'customfield_10016',
      flaggedFieldKey: 'customfield_10021',
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/services/jira', () => ({
  fetchMyTasksHierarchy: vi.fn().mockResolvedValue({ issues: [], myIssueKeys: new Set() }),
  fetchAllAssignedHierarchy: vi.fn().mockResolvedValue({ issues: [], myIssueKeys: new Set() }),
  fetchAllReportedHierarchy: vi.fn().mockResolvedValue({ issues: [], myIssueKeys: new Set() }),
  isIssueFlagged: vi.fn().mockReturnValue(false),
}));

vi.mock('@/services/gitlab', () => ({
  fetchAuthoredMRs: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

// Mock Tauri plugin-store to prevent IPC calls in jsdom
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

// ── Import component after mocks ──────────────────────────────────────────────

import MyTasksPage from './MyTasksPage';

// ── Test helpers ──────────────────────────────────────────────────────────────

// Mock useOutletContext so the component gets a proper outlet context in tests
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: vi.fn(),
  };
});

import { useOutletContext } from 'react-router-dom';

function renderPage(outletCtx?: Record<string, unknown>) {
  vi.mocked(useOutletContext).mockReturnValue(outletCtx ?? {});
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <MyTasksPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MyTasksPage — MYTASK-01 smoke render (82-DESIGN-TARGET)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "My Tasks" page title without throwing', () => {
    renderPage();
    expect(screen.getByText('My Tasks')).toBeDefined();
  });

  it('renders the three stat tiles (To Do / In Progress / Done)', () => {
    renderPage();
    // The new design has 3 tiles (replacing the old 6 filter chips)
    const toDo = screen.getAllByText('To Do');
    expect(toDo.length).toBeGreaterThanOrEqual(1);
    const inProgress = screen.getAllByText('In Progress');
    expect(inProgress.length).toBeGreaterThanOrEqual(1);
    const done = screen.getAllByText('Done');
    expect(done.length).toBeGreaterThanOrEqual(1);
  });

  it('renders all three scope toggle options in the right toolbar', () => {
    renderPage();
    expect(screen.getByText('Current Sprint')).toBeDefined();
    expect(screen.getByText('All Assigned')).toBeDefined();
    expect(screen.getByText('All Reported')).toBeDefined();
  });

  it('renders the empty state when no data is available', () => {
    renderPage();
    // My Day with no issues should show the "all caught up" empty state
    expect(screen.getByText("You're all caught up")).toBeDefined();
  });

  it('B1: outlet onOpenIssue is consumed (not navigate) for peek context', () => {
    // If outlet context provides onOpenIssue, the component should not throw when receiving it
    const onOpenIssue = vi.fn();
    const onIssueClick = vi.fn();
    renderPage({ onIssueClick, onOpenIssue });
    expect(screen.getByText('My Tasks')).toBeDefined();
  });
});

// ── Subtask suppression regression tests ──────────────────────────────────────

/**
 * Builds a minimal JiraIssue fixture sufficient for renderMyDayList / groupByMyDay.
 */
function makeIssue(
  key: string,
  statusCategory: 'done' | 'indeterminate' | 'new',
  opts: {
    subtask?: boolean;
    parentKey?: string;
    timeSpentSeconds?: number;
    originalEstimateSeconds?: number;
  } = {},
) {
  return {
    key,
    fields: {
      summary: `Summary for ${key}`,
      status: {
        name:
          statusCategory === 'indeterminate'
            ? 'In Progress'
            : statusCategory === 'done'
              ? 'Done'
              : 'To Do',
        statusCategory: { key: statusCategory },
      },
      issuetype: { subtask: opts.subtask ?? false },
      parent: opts.parentKey ? { key: opts.parentKey } : undefined,
      priority: { name: 'Medium', iconUrl: '' },
      assignee: null,
      customfield_10016: null,
      customfield_10021: null,
      duedate: null,
      timetracking:
        opts.timeSpentSeconds !== undefined || opts.originalEstimateSeconds !== undefined
          ? {
              timeSpentSeconds: opts.timeSpentSeconds ?? 0,
              originalEstimateSeconds: opts.originalEstimateSeconds ?? 0,
            }
          : null,
    },
  };
}

/** Default useQuery response (no data). */
const NO_DATA_RESPONSE = {
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
};

describe('MyTasksPage — DONE parent subtask suppression (260618-ckn)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT render subtask rows for a DONE-category parent in Current Sprint', () => {
    // Fixtures: one DONE parent (STORY-1) with one subtask (SUB-1)
    const doneParent = makeIssue('STORY-1', 'done');
    const doneSubtask = makeIssue('SUB-1', 'done', { subtask: true, parentKey: 'STORY-1' });

    // Both keys belong to the current user so groupByMyDay includes STORY-1
    const sprintData = {
      issues: [doneParent, doneSubtask],
      myIssueKeys: new Set(['STORY-1', 'SUB-1']),
    };

    // Mock useQuery: return sprint data for the my-tasks query key, no-data for the rest
    // biome-ignore lint/suspicious/noExplicitAny: test mock — partial UseQueryResult is intentional
    vi.mocked(useQuery).mockImplementation((opts: any) => {
      const key: readonly unknown[] = opts.queryKey ?? [];
      if (key[0] === 'jira-issues' && key[1] === 'my-tasks') {
        // biome-ignore lint/suspicious/noExplicitAny: cast partial mock to satisfy UseQueryResult
        return { ...NO_DATA_RESPONSE, data: sprintData } as any;
      }
      // biome-ignore lint/suspicious/noExplicitAny: cast partial mock to satisfy UseQueryResult
      return NO_DATA_RESPONSE as any;
    });

    renderPage();

    // Parent row must be present
    expect(screen.getByTestId('my-task-row-STORY-1')).toBeDefined();
    // Subtask row must be absent — suppressed because parent is DONE
    expect(screen.queryByTestId('my-task-row-SUB-1')).toBeNull();
  });

  it('DOES render subtask rows for an IN-PROGRESS-category parent in Current Sprint', () => {
    // Fixtures: one IN-PROGRESS parent (STORY-2) with one subtask (SUB-2)
    const inProgressParent = makeIssue('STORY-2', 'indeterminate');
    const inProgressSubtask = makeIssue('SUB-2', 'indeterminate', {
      subtask: true,
      parentKey: 'STORY-2',
    });

    const sprintData = {
      issues: [inProgressParent, inProgressSubtask],
      myIssueKeys: new Set(['STORY-2', 'SUB-2']),
    };

    // biome-ignore lint/suspicious/noExplicitAny: test mock — partial UseQueryResult is intentional
    vi.mocked(useQuery).mockImplementation((opts: any) => {
      const key: readonly unknown[] = opts.queryKey ?? [];
      if (key[0] === 'jira-issues' && key[1] === 'my-tasks') {
        // biome-ignore lint/suspicious/noExplicitAny: cast partial mock to satisfy UseQueryResult
        return { ...NO_DATA_RESPONSE, data: sprintData } as any;
      }
      // biome-ignore lint/suspicious/noExplicitAny: cast partial mock to satisfy UseQueryResult
      return NO_DATA_RESPONSE as any;
    });

    renderPage();

    // Parent row present
    expect(screen.getByTestId('my-task-row-STORY-2')).toBeDefined();
    // Subtask row also present — IN PROGRESS parent keeps its subtasks
    expect(screen.getByTestId('my-task-row-SUB-2')).toBeDefined();
  });
});

// ── Time rollup regression tests ──────────────────────────────────────────────

describe('MyTasksPage — DONE parent time rollup (260618-efy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rolls up subtask time into a DONE parent even though subtask rows are hidden', () => {
    // Fixtures: one DONE parent with timetracking, one DONE subtask with timetracking
    const doneParent = makeIssue('STORY-1', 'done', {
      timeSpentSeconds: 3600,
      originalEstimateSeconds: 7200,
    });
    const doneSubtask = makeIssue('SUB-1', 'done', {
      subtask: true,
      parentKey: 'STORY-1',
      timeSpentSeconds: 1800,
      originalEstimateSeconds: 3600,
    });

    const sprintData = {
      issues: [doneParent, doneSubtask],
      myIssueKeys: new Set(['STORY-1', 'SUB-1']),
    };

    // biome-ignore lint/suspicious/noExplicitAny: test mock — partial UseQueryResult is intentional
    vi.mocked(useQuery).mockImplementation((opts: any) => {
      const key: readonly unknown[] = opts.queryKey ?? [];
      if (key[0] === 'jira-issues' && key[1] === 'my-tasks') {
        // biome-ignore lint/suspicious/noExplicitAny: cast partial mock to satisfy UseQueryResult
        return { ...NO_DATA_RESPONSE, data: sprintData } as any;
      }
      // biome-ignore lint/suspicious/noExplicitAny: cast partial mock to satisfy UseQueryResult
      return NO_DATA_RESPONSE as any;
    });

    renderPage();

    // Parent row must be present
    const parentRow = screen.getByTestId('my-task-row-STORY-1');
    expect(parentRow).toBeDefined();

    // Subtask row must be ABSENT — suppression still applies
    expect(screen.queryByTestId('my-task-row-SUB-1')).toBeNull();

    // Time caption must reflect COMBINED total: spent 3600+1800=5400s, est 7200+3600=10800s
    const expectedCaption = `${formatDuration(5400)} / ${formatDuration(10800)}`;
    expect(within(parentRow).getByText(expectedCaption)).toBeDefined();
  });
});
