/**
 * TodayColumn render/interaction tests — STAND-09, STAND-08, MRs scope
 *
 * Tests:
 *   1. Log Work trigger present on In Progress rows (STAND-09)
 *   2. Log Work trigger present on Up Next rows (STAND-09 / D-06)
 *   3. Log Work click does NOT invoke row's onIssueClick spy (STAND-09 / D-07)
 *   4. MRS AWAITING YOU section absent when GitLab not connected (MRs scope)
 *
 * Strategy: mock all four useQuery calls to return fixture data synchronously,
 * mock the stores, and mount TodayColumn inside the required providers.
 *
 * Pattern source: SprintHealthPanel.test.tsx + YesterdayColumn.tempo-disabled.test.tsx
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JiraIssue } from '@/services/jira';

// ─── Mock TanStack Query ──────────────────────────────────────────────────────
// useQuery is mocked so all four queries return deterministic data.
// useQueryClient is mocked so invalidateQueries can be spied on.

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false, isError: false }),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  };
});

// ─── Mock stores ─────────────────────────────────────────────────────────────

const authStoreMock = {
  jiraBaseUrl: 'https://jira.example.com',
  gitlabBaseUrl: 'https://gitlab.example.com',
  activeJiraProject: 'PROJ',
  jiraUsername: 'testuser',
  jiraUserDisplayName: 'Test User',
  gitlabUserId: 42,
};

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector?: (s: typeof authStoreMock) => unknown) =>
    selector ? selector(authStoreMock) : authStoreMock,
  ),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn((selector: (s: { tempoEnabled: boolean; storyPointsFieldKey: string }) => unknown) =>
    selector({ tempoEnabled: true, storyPointsFieldKey: 'customfield_10016' }),
  ),
}));

vi.mock('@/stores/pinned-tabs.store', () => ({
  usePinnedTabsStore: vi.fn(() => ({
    pinnedKeys: [],
    pinnedCycleMeta: {},
    isPinned: vi.fn(),
  })),
}));

// ─── Mock services ────────────────────────────────────────────────────────────

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
  fetchIssueMeta: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/services/gitlab', () => ({
  fetchReviewerMRs: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/tempo', () => ({
  fetchWorklogs: vi.fn().mockResolvedValue([]),
}));

// ─── Mock react-router-dom navigation ─────────────────────────────────────────

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  };
});

// ─── Fixture builders ─────────────────────────────────────────────────────────

function makeIssue(
  key: string,
  statusCategoryKey: 'indeterminate' | 'new' | 'done',
  opts: { isSubtask?: boolean; subtasksLen?: number; displayName?: string } = {},
): JiraIssue {
  const {
    isSubtask = true,
    subtasksLen = 0,
    displayName = 'Test User',
  } = opts;

  return {
    id: key,
    key,
    fields: {
      summary: `Summary of ${key}`,
      status: {
        id: '1',
        name: statusCategoryKey === 'indeterminate' ? 'In Progress' : statusCategoryKey === 'new' ? 'To Do' : 'Done',
        statusCategory: { key: statusCategoryKey },
      },
      assignee: { displayName },
      issuetype: { name: 'Sub-task', subtask: isSubtask },
      subtasks: Array.from({ length: subtasksLen }, (_, i) => ({ key: `${key}-sub-${i}` })),
      customfield_10016: 3,
      parent: undefined,
      timetracking: {},
    },
  } as unknown as JiraIssue;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TodayColumn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Log Work trigger — STAND-09', () => {
    it('shows a Log Work trigger on In Progress rows', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      const inProgressIssue = makeIssue('PROJ-1', 'indeterminate');

      vi.mocked(useQuery).mockImplementation((opts) => {
        const key = Array.isArray(opts.queryKey) ? opts.queryKey[1] : '';
        if (key === 'sprint-board-today-full') {
          return { data: [inProgressIssue], isLoading: false, isError: false } as ReturnType<typeof useQuery>;
        }
        return { data: undefined, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
      });

      const onIssueClick = vi.fn();
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { default: TodayColumn } = await import('./TodayColumn');

      render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <TodayColumn onIssueClick={onIssueClick} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // The LogWorkPopover renders a built-in "Log Work" trigger button
      const logWorkButtons = screen.getAllByText('Log Work');
      expect(logWorkButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('shows a Log Work trigger on Up Next rows (D-06: both sections loggable)', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      const upNextIssue = makeIssue('PROJ-2', 'new');

      vi.mocked(useQuery).mockImplementation((opts) => {
        const key = Array.isArray(opts.queryKey) ? opts.queryKey[1] : '';
        if (key === 'sprint-board-today-full') {
          return { data: [upNextIssue], isLoading: false, isError: false } as ReturnType<typeof useQuery>;
        }
        return { data: undefined, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
      });

      const onIssueClick = vi.fn();
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { default: TodayColumn } = await import('./TodayColumn');

      render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <TodayColumn onIssueClick={onIssueClick} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const logWorkButtons = screen.getAllByText('Log Work');
      expect(logWorkButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('clicking Log Work does NOT invoke onIssueClick (stopPropagation — D-07)', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      const inProgressIssue = makeIssue('PROJ-3', 'indeterminate');

      vi.mocked(useQuery).mockImplementation((opts) => {
        const key = Array.isArray(opts.queryKey) ? opts.queryKey[1] : '';
        if (key === 'sprint-board-today-full') {
          return { data: [inProgressIssue], isLoading: false, isError: false } as ReturnType<typeof useQuery>;
        }
        return { data: undefined, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
      });

      const onIssueClick = vi.fn();
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { default: TodayColumn } = await import('./TodayColumn');

      render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <TodayColumn onIssueClick={onIssueClick} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // Click the Log Work trigger
      const logWorkButton = screen.getByText('Log Work');
      await userEvent.click(logWorkButton);

      // onIssueClick must NOT have been called — stopPropagation blocks row navigation
      expect(onIssueClick).not.toHaveBeenCalled();
    });
  });

  describe('Parent story with subtasks — gap #5 regression guard', () => {
    it('shows a parent story (non-subtask with subtasksLen>0) in In Progress section', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      // A parent story: isSubtask=false, subtasksLen=2, indeterminate status
      const parentStory = makeIssue('PROJ-10', 'indeterminate', { isSubtask: false, subtasksLen: 2 });

      vi.mocked(useQuery).mockImplementation((opts) => {
        const key = Array.isArray(opts.queryKey) ? opts.queryKey[1] : '';
        if (key === 'sprint-board-today-full') {
          return { data: [parentStory], isLoading: false, isError: false } as ReturnType<typeof useQuery>;
        }
        return { data: undefined, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
      });

      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { default: TodayColumn } = await import('./TodayColumn');

      render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <TodayColumn onIssueClick={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // The parent story summary must appear in IN PROGRESS
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
      expect(screen.getByText('Summary of PROJ-10')).toBeInTheDocument();
    });
  });

  describe('Progress bar — Decision 2', () => {
    it('renders a progress bar when originalEstimateSeconds is set', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      const issueWithEstimate = {
        ...makeIssue('PROJ-20', 'indeterminate'),
        fields: {
          ...makeIssue('PROJ-20', 'indeterminate').fields,
          timetracking: { originalEstimateSeconds: 36000, timeSpentSeconds: 18000 },
        },
      } as unknown as JiraIssue;

      vi.mocked(useQuery).mockImplementation((opts) => {
        const key = Array.isArray(opts.queryKey) ? opts.queryKey[1] : '';
        if (key === 'sprint-board-today-full') {
          return { data: [issueWithEstimate], isLoading: false, isError: false } as ReturnType<typeof useQuery>;
        }
        return { data: undefined, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
      });

      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { default: TodayColumn } = await import('./TodayColumn');

      render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <TodayColumn onIssueClick={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // Progress bar format: [█████░░░░░] Xh / Yh
      // 18000s = 5h, 36000s = 10h
      expect(screen.getByText(/\[.*\].*\/.*h/)).toBeInTheDocument();
    });

    it('does NOT render a progress bar when no originalEstimateSeconds', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      const issueNoEstimate = makeIssue('PROJ-21', 'indeterminate');
      // timetracking is {} — no originalEstimateSeconds

      vi.mocked(useQuery).mockImplementation((opts) => {
        const key = Array.isArray(opts.queryKey) ? opts.queryKey[1] : '';
        if (key === 'sprint-board-today-full') {
          return { data: [issueNoEstimate], isLoading: false, isError: false } as ReturnType<typeof useQuery>;
        }
        return { data: undefined, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
      });

      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { default: TodayColumn } = await import('./TodayColumn');

      render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <TodayColumn onIssueClick={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // No bracket-bar pattern in DOM
      expect(screen.queryByText(/\[.*\].*\/.*h/)).not.toBeInTheDocument();
    });
  });

  describe('MRs Awaiting You section — MRs scope', () => {
    it('hides MRS AWAITING YOU section when GitLab not connected', async () => {
      const { useAuthStore } = await import('@/stores/auth.store');

      // Override auth to have no GitLab connection
      vi.mocked(useAuthStore).mockImplementation(((selector?: (s: typeof authStoreMock) => unknown) => {
        const noGitlab = { ...authStoreMock, gitlabBaseUrl: null, gitlabUserId: null };
        return selector ? selector(noGitlab as unknown as typeof authStoreMock) : noGitlab;
      }) as unknown as typeof useAuthStore);

      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { default: TodayColumn } = await import('./TodayColumn');

      render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <TodayColumn onIssueClick={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // The "MRS AWAITING YOU" section header must not be in the DOM
      expect(screen.queryByText('MRS AWAITING YOU')).not.toBeInTheDocument();
    });
  });
});
