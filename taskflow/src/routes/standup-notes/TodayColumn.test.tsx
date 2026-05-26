/**
 * TodayColumn render/interaction tests — STAND-08, MRs scope
 *
 * Tests:
 *   1. Parent story with subtasks renders in In Progress section
 *   2. Progress bar rendering (Decision 2)
 *   3. Nested MR under matched story (phase 70 MR matching)
 *   4. MRS AWAITING YOU section absent when GitLab not connected (MRs scope)
 *
 * Strategy: mock all useQuery calls to return fixture data synchronously,
 * mock the stores, and mount TodayColumn inside the required providers.
 *
 * Pattern source: YesterdayColumn.tempo-disabled.test.tsx
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
  fetchParticipatedMRs: vi.fn().mockResolvedValue([]),
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
            <TodayColumn onIssueClick={vi.fn()} onMRClick={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // The parent story summary must appear in In Progress
      expect(screen.getByText('In Progress')).toBeInTheDocument();
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
            <TodayColumn onIssueClick={vi.fn()} onMRClick={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // Inline progress caption: "<spent> / <estimate>"
      // 18000s = 5h, 36000s = 10h
      expect(screen.getByText(/5h \/ 10h/)).toBeInTheDocument();
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
            <TodayColumn onIssueClick={vi.fn()} onMRClick={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // No progress caption in DOM when there is no estimate
      expect(screen.queryByText(/logged/)).not.toBeInTheDocument();
    });
  });

  describe('Nested MR under story — phase 70 MR matching', () => {
    it('renders a reviewer MR nested under its matched In Progress story', async () => {
      const { useQuery } = await import('@tanstack/react-query');

      // Parent story assigned to Test User, In Progress
      const parentStory = makeIssue('PROJ-50', 'indeterminate', { isSubtask: false, subtasksLen: 0 });

      // Reviewer MR whose title references PROJ-50
      const reviewerMR = {
        id: 5000,
        iid: 999,
        project_id: 1,
        title: '[PROJ-50] Implement feature',
        source_branch: 'feature/PROJ-50',
        state: 'opened' as const,
        author: { id: 99, name: 'Author', username: 'author', avatar_url: '' },
        reviewers: [],
        updated_at: '2026-05-25T00:00:00Z',
        web_url: 'https://gitlab.example.com/mr/999',
        labels: [],
        milestone: null,
      };

      vi.mocked(useQuery).mockImplementation((opts) => {
        const key = Array.isArray(opts.queryKey) ? opts.queryKey[1] : '';
        if (key === 'sprint-board-today-full') {
          return { data: [parentStory], isLoading: false, isError: false } as ReturnType<typeof useQuery>;
        }
        if (key === 'reviewer-mrs') {
          return { data: [reviewerMR], isLoading: false, isError: false } as ReturnType<typeof useQuery>;
        }
        if (key === 'participating-mrs') {
          return { data: [], isLoading: false, isError: false } as ReturnType<typeof useQuery>;
        }
        return { data: undefined, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
      });

      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { default: TodayColumn } = await import('./TodayColumn');

      render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <TodayColumn onIssueClick={vi.fn()} onMRClick={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // The nested MR iid and title should appear in the document
      expect(screen.getByText('!999')).toBeInTheDocument();
      expect(screen.getByText('[PROJ-50] Implement feature')).toBeInTheDocument();
      // The "review" tag should appear
      expect(screen.getByText('review')).toBeInTheDocument();
      // The MRs Awaiting You section should be absent (all MRs matched)
      expect(screen.queryByText('MRs Awaiting You')).not.toBeInTheDocument();
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
            <TodayColumn onIssueClick={vi.fn()} onMRClick={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // The "MRs Awaiting You" section header must not be in the DOM
      expect(screen.queryByText('MRs Awaiting You')).not.toBeInTheDocument();
    });
  });
});
