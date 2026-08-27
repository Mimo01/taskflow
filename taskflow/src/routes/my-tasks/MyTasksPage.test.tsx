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

import { QueryClient, QueryClientProvider, useQueries, useQuery } from '@tanstack/react-query';
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
    useQueries: vi.fn().mockReturnValue([]),
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
  fetchMRApprovals: vi.fn(),
  fetchMRDiscussions: vi.fn(),
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
import { useAuthStore } from '@/stores/auth.store';

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

// ── Real MR review health regression tests (260827-gji) ─────────────────────

describe('MyTasksPage — real MR review health (260827-gji)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
      gitlabUserId: 42,
    });
  });

  const authoredMr = {
    id: 1,
    iid: 7,
    project_id: 99,
    title: 'PROJ-1 fix',
    source_branch: 'feature/PROJ-1',
    target_branch: 'main',
    state: 'opened' as const,
    draft: false,
    author: { id: 42, name: 'Me', username: 'me', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-01-01T00:00:00Z',
    web_url: 'https://gitlab.example.com/mr/7',
    labels: [],
    milestone: null,
  };

  function mockQueriesFor({
    approvals,
    discussions,
  }: {
    approvals: { approved_by: Array<{ user: { id: number; name: string } }>; approved: boolean };
    discussions: Array<{ notes: Array<{ resolvable: boolean; resolved: boolean }> }>;
  }) {
    // biome-ignore lint/suspicious/noExplicitAny: test mock — partial UseQueryResult is intentional
    vi.mocked(useQuery).mockImplementation((opts: any) => {
      const key: readonly unknown[] = opts.queryKey ?? [];
      if (key[0] === 'jira-issues' && key[1] === 'my-tasks') {
        return {
          ...NO_DATA_RESPONSE,
          data: {
            issues: [makeIssue('PROJ-1', 'indeterminate')],
            myIssueKeys: new Set(['PROJ-1']),
          },
          // biome-ignore lint/suspicious/noExplicitAny: cast partial mock to satisfy UseQueryResult
        } as any;
      }
      if (key[0] === 'gitlab-authored-mrs') {
        // biome-ignore lint/suspicious/noExplicitAny: cast partial mock to satisfy UseQueryResult
        return { ...NO_DATA_RESPONSE, data: [authoredMr] } as any;
      }
      // biome-ignore lint/suspicious/noExplicitAny: cast partial mock to satisfy UseQueryResult
      return NO_DATA_RESPONSE as any;
    });

    // biome-ignore lint/suspicious/noExplicitAny: test mock — partial UseQueryResult[] is intentional
    vi.mocked(useQueries).mockImplementation((opts: any) => {
      return opts.queries.map((q: { queryKey: readonly unknown[] }) => {
        if (q.queryKey[0] === 'gitlab-mr-approvals') {
          return { data: approvals, isLoading: false, isError: false };
        }
        if (q.queryKey[0] === 'gitlab-mr-discussions') {
          return { data: discussions, isLoading: false, isError: false };
        }
        return { data: undefined, isLoading: false, isError: false };
      });
    });
  }

  it('renders the approved chip when the authored MR has an approver', async () => {
    mockQueriesFor({
      approvals: { approved_by: [{ user: { id: 1, name: 'Reviewer' } }], approved: true },
      discussions: [],
    });

    renderPage();

    const parentRow = await screen.findByTestId('my-task-row-PROJ-1');
    expect(within(parentRow).getByText('Approved')).toBeDefined();
  });

  it('renders the changes-requested chip when zero approvers and an unresolved note exists', async () => {
    mockQueriesFor({
      approvals: { approved_by: [], approved: false },
      discussions: [{ notes: [{ resolvable: true, resolved: false }] }],
    });

    renderPage();

    const parentRow = await screen.findByTestId('my-task-row-PROJ-1');
    expect(within(parentRow).getByText('Changes requested')).toBeDefined();
  });

  it('constructs no enrichment queries when GitLab config is absent (renders unchanged)', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: null,
      gitlabUserId: null,
    });
    // biome-ignore lint/suspicious/noExplicitAny: test mock — partial UseQueryResult[] is intentional
    const queriesSpy = vi.mocked(useQueries).mockImplementation((opts: any) =>
      opts.queries.map(() => ({ data: undefined, isLoading: false, isError: false })),
    );

    renderPage();

    expect(screen.getByText('My Tasks')).toBeDefined();
    // Both useQueries calls (approvals + discussions) must be invoked with empty query arrays.
    for (const call of queriesSpy.mock.calls) {
      expect((call[0] as { queries: unknown[] }).queries).toEqual([]);
    }
  });
});
