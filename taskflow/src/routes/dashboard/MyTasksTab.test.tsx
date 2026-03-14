/**
 * MyTasksTab tests — DEV-01, DEV-02, UI-02, LINK-01, LINK-02
 *
 * Tests loading/error/empty/success states, last-refreshed display,
 * and MR linking behavior via linkEngine.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({ onIssueClick: vi.fn() }),
}));

// Mock stronghold — avoid real Tauri vault calls
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// Mock jira service — controlled from each test
vi.mock('@/services/jira', () => ({
  fetchMyTasksHierarchy: vi.fn().mockResolvedValue({ issues: [], myIssueKeys: new Set() }),
  postTransition: vi.fn().mockResolvedValue(undefined),
  postComment: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: 'https://gitlab.example.com',
  })),
}));

// Mock settings store — TaskRow reads storyPointsFieldKey
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
  })),
}));

// Mock gitlab service
vi.mock('@/services/gitlab', () => ({
  validateGitLab: vi.fn().mockResolvedValue({ id: 42, name: 'Test User', username: 'testuser' }),
  fetchAssignedMRs: vi.fn().mockResolvedValue([]),
  fetchReviewerMRs: vi.fn().mockResolvedValue([]),
  fetchProjectMRs: vi.fn().mockResolvedValue([]),
  fetchMRCommits: vi.fn().mockResolvedValue([]),
  fetchMRApprovals: vi.fn().mockResolvedValue({ approved_by: [], approved: false }),
  fetchMRDiscussions: vi.fn().mockResolvedValue([]),
}));

// Mock link engine
vi.mock('@/services/linkEngine', () => ({
  linkMRToTask: vi.fn().mockReturnValue(null),
  linkMRToTaskViaCommits: vi.fn().mockReturnValue(null),
  extractTicketKeys: vi.fn().mockReturnValue([]),
  deriveReviewHealth: vi.fn().mockReturnValue('waiting_for_review'),
  isStale: vi.fn().mockReturnValue(false),
}));

// Mock StatusPopover and InlineComment to avoid TanStack Query dependency in unit tests
vi.mock('./StatusPopover', () => ({
  default: ({ currentStatus }: { currentStatus: string }) => (
    <button type="button" aria-label={currentStatus}>{currentStatus}</button>
  ),
}));

vi.mock('./InlineComment', () => ({
  default: () => null,
}));

// Helper builders
function makeIssue(key: string) {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary for ${key}`,
      status: { id: '3', name: 'In Progress' },
      assignee: null,
      customfield_10016: null,
      issuetype: { name: 'Story', subtask: false },
    },
  };
}

function makeMR(iid: number, title: string, source_branch = `feature/branch-${iid}`) {
  return {
    id: iid,
    iid,
    project_id: 1,
    title,
    source_branch,
    state: 'opened' as const,
    author: { id: 1, name: 'Author', username: 'author', avatar_url: '' },
    reviewers: [],
    updated_at: new Date().toISOString(),
    web_url: `https://gitlab.example.com/mr/${iid}`,
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

describe('MyTasksTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "No tasks" when data is empty array', async () => {
    const { fetchMyTasksHierarchy } = await import('@/services/jira');
    vi.mocked(fetchMyTasksHierarchy).mockResolvedValue({ issues: [], myIssueKeys: new Set() });

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: MyTasksTab } = await import('./MyTasksTab');
    renderWithQuery(<MyTasksTab />);

    // Wait for data to load
    await screen.findByText(/no tasks/i);
  });

  it('renders skeleton when isLoading (activeJiraProject present, fetch delayed)', async () => {
    const { fetchMyTasksHierarchy } = await import('@/services/jira');
    // Never resolve — keep loading state
    vi.mocked(fetchMyTasksHierarchy).mockReturnValue(new Promise(() => {}));

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
      gitlabUserId: 42,
    } as ReturnType<typeof useAuthStore>);

    const { default: MyTasksTab } = await import('./MyTasksTab');
    renderWithQuery(<MyTasksTab />);

    // Skeleton divs should be visible after token loads but before data resolves
    const skeletons = await screen.findAllByTestId('skeleton-row');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders error message when fetch fails', async () => {
    const { fetchMyTasksHierarchy } = await import('@/services/jira');
    vi.mocked(fetchMyTasksHierarchy).mockRejectedValue(new Error('Failed to fetch tasks'));

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: MyTasksTab } = await import('./MyTasksTab');
    renderWithQuery(<MyTasksTab />);

    await screen.findByText(/Failed to fetch tasks/i);
  });

  it('renders last-refreshed time when data loads', async () => {
    const { fetchMyTasksHierarchy } = await import('@/services/jira');
    vi.mocked(fetchMyTasksHierarchy).mockResolvedValue({ issues: [], myIssueKeys: new Set() });

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: MyTasksTab } = await import('./MyTasksTab');
    renderWithQuery(<MyTasksTab />);

    // Wait for data to finish loading, then last-refreshed should appear
    await screen.findByText(/no tasks/i);
    // Should show a time, not "Never" since data loaded successfully
    const refreshedEl = screen.getByText(/refreshed:/i);
    expect(refreshedEl).toBeTruthy();
  });

  it('passes linkedMrResults with matched MR to TaskRow when MR title contains sprint issue key', async () => {
    const { fetchMyTasksHierarchy } = await import('@/services/jira');
    vi.mocked(fetchMyTasksHierarchy).mockResolvedValue({ issues: [makeIssue('PROJ-1')], myIssueKeys: new Set(['PROJ-1']) });

    const { fetchAssignedMRs, fetchMRApprovals, fetchMRDiscussions } = await import('@/services/gitlab');
    const mr = makeMR(42, 'PROJ-1 fix the thing');
    vi.mocked(fetchAssignedMRs).mockResolvedValue([mr]);
    vi.mocked(fetchMRApprovals).mockResolvedValue({ approved_by: [{ user: { id: 1, name: 'Reviewer' } }], approved: true });
    vi.mocked(fetchMRDiscussions).mockResolvedValue([]);

    const { linkMRToTask, deriveReviewHealth } = await import('@/services/linkEngine');
    vi.mocked(linkMRToTask).mockImplementation((m, keys) =>
      keys.has('PROJ-1') && m.title.includes('PROJ-1') ? 'PROJ-1' : null,
    );
    vi.mocked(deriveReviewHealth).mockReturnValue('approved');

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
      gitlabUserId: 42,
    } as ReturnType<typeof useAuthStore>);

    const { default: MyTasksTab } = await import('./MyTasksTab');
    renderWithQuery(<MyTasksTab />);

    // TaskRow should render with the MR chip "MR !42"
    await screen.findByText(/MR !42/i);
  });

  it('includes project-level MR in link map when MR title references a sprint task', async () => {
    const { fetchMyTasksHierarchy } = await import('@/services/jira');
    vi.mocked(fetchMyTasksHierarchy).mockResolvedValue({ issues: [makeIssue('PROJ-1')], myIssueKeys: new Set(['PROJ-1']) });

    const { fetchAssignedMRs, fetchReviewerMRs, fetchProjectMRs, fetchMRApprovals, fetchMRDiscussions } = await import('@/services/gitlab');
    const projectMr = makeMR(99, 'PROJ-1 fix via project fetch');
    vi.mocked(fetchAssignedMRs).mockResolvedValue([]);
    vi.mocked(fetchReviewerMRs).mockResolvedValue([]);
    vi.mocked(fetchProjectMRs).mockResolvedValue([projectMr]);
    vi.mocked(fetchMRApprovals).mockResolvedValue({ approved_by: [], approved: false });
    vi.mocked(fetchMRDiscussions).mockResolvedValue([]);

    const { linkMRToTask, deriveReviewHealth } = await import('@/services/linkEngine');
    vi.mocked(linkMRToTask).mockImplementation((m, keys) =>
      keys.has('PROJ-1') && m.title.includes('PROJ-1') ? 'PROJ-1' : null,
    );
    vi.mocked(deriveReviewHealth).mockReturnValue('waiting_for_review');

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
      activeGitlabProject: 5,
      gitlabUserId: 42,
    } as ReturnType<typeof useAuthStore>);

    const { default: MyTasksTab } = await import('./MyTasksTab');
    renderWithQuery(<MyTasksTab />);

    // Project-level MR should appear as linked MR chip "MR !99"
    await screen.findByText(/MR !99/i);
  });

  it('TaskRow shows "— no MR" when no MR links to the task', async () => {
    const { fetchMyTasksHierarchy } = await import('@/services/jira');
    vi.mocked(fetchMyTasksHierarchy).mockResolvedValue({ issues: [makeIssue('PROJ-2')], myIssueKeys: new Set(['PROJ-2']) });

    const { fetchAssignedMRs } = await import('@/services/gitlab');
    vi.mocked(fetchAssignedMRs).mockResolvedValue([]);

    const { linkMRToTask } = await import('@/services/linkEngine');
    vi.mocked(linkMRToTask).mockReturnValue(null);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: MyTasksTab } = await import('./MyTasksTab');
    renderWithQuery(<MyTasksTab />);

    await screen.findByText(/— no MR/i);
  });
});

describe('TaskRow rendering', () => {
  it('renders green chip for approved health', async () => {
    const { default: TaskRow } = await import('./TaskRow');
    const issue = makeIssue('PROJ-3');
    const mr = makeMR(5, 'PROJ-3 feature');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TaskRow
          issue={issue}
          linkedMrResults={[{ mr, health: 'approved' }]}
          jiraBaseUrl="https://jira.example.com"
          jiraToken="test-token"
          onTransitionSelect={() => {}}
          onCommentSubmit={() => {}}
        />
      </QueryClientProvider>,
    );
    // Should render "MR !5"
    expect(screen.getByText(/MR !5/i)).toBeTruthy();
    // Should have a green dot (bg-green-500)
    const dot = document.querySelector('.bg-green-500');
    expect(dot).not.toBeNull();
  });

  it('renders red chip for changes_requested health', async () => {
    const { default: TaskRow } = await import('./TaskRow');
    const issue = makeIssue('PROJ-4');
    const mr = makeMR(6, 'PROJ-4 feature');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TaskRow
          issue={issue}
          linkedMrResults={[{ mr, health: 'changes_requested' }]}
          jiraBaseUrl="https://jira.example.com"
          jiraToken="test-token"
          onTransitionSelect={() => {}}
          onCommentSubmit={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/MR !6/i)).toBeTruthy();
    const dot = document.querySelector('.bg-red-500');
    expect(dot).not.toBeNull();
  });

  it('renders "— no MR" when linkedMrResults is empty', async () => {
    const { default: TaskRow } = await import('./TaskRow');
    const issue = makeIssue('PROJ-5');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TaskRow
          issue={issue}
          linkedMrResults={[]}
          jiraBaseUrl="https://jira.example.com"
          jiraToken="test-token"
          onTransitionSelect={() => {}}
          onCommentSubmit={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/— no MR/i)).toBeTruthy();
  });
});
