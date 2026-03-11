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

// Mock stronghold — avoid real Tauri vault calls
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// Mock jira service — controlled from each test
vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: 'https://gitlab.example.com',
  })),
}));

// Mock gitlab service
vi.mock('@/services/gitlab', () => ({
  validateGitLab: vi.fn().mockResolvedValue({ id: 42, name: 'Test User', username: 'testuser' }),
  fetchAssignedMRs: vi.fn().mockResolvedValue([]),
  fetchReviewerMRs: vi.fn().mockResolvedValue([]),
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
      issuetype: { name: 'Story' },
    },
  };
}

function makeMR(iid: number, title: string) {
  return {
    id: iid,
    iid,
    project_id: 1,
    title,
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
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([]);

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
    const { fetchSprintIssues } = await import('@/services/jira');
    // Never resolve — keep loading state
    vi.mocked(fetchSprintIssues).mockReturnValue(new Promise(() => {}));

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: MyTasksTab } = await import('./MyTasksTab');
    renderWithQuery(<MyTasksTab />);

    // Skeleton divs should be visible immediately before data resolves
    const skeletons = document.querySelectorAll('[data-testid="skeleton-row"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders error message when fetch fails', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockRejectedValue(new Error('Failed to fetch tasks'));

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
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([]);

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
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([makeIssue('PROJ-1')]);

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
    } as ReturnType<typeof useAuthStore>);

    const { default: MyTasksTab } = await import('./MyTasksTab');
    renderWithQuery(<MyTasksTab />);

    // TaskRow should render with the MR chip "MR !42"
    await screen.findByText(/MR !42/i);
  });

  it('TaskRow shows "— no MR" when no MR links to the task', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([makeIssue('PROJ-2')]);

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
    render(
      <TaskRow
        issue={issue}
        linkedMrResults={[{ mr, health: 'approved' }]}
        onStatusClick={() => {}}
        onCommentClick={() => {}}
      />,
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
    render(
      <TaskRow
        issue={issue}
        linkedMrResults={[{ mr, health: 'changes_requested' }]}
        onStatusClick={() => {}}
        onCommentClick={() => {}}
      />,
    );
    expect(screen.getByText(/MR !6/i)).toBeTruthy();
    const dot = document.querySelector('.bg-red-500');
    expect(dot).not.toBeNull();
  });

  it('renders "— no MR" when linkedMrResults is empty', async () => {
    const { default: TaskRow } = await import('./TaskRow');
    const issue = makeIssue('PROJ-5');
    render(
      <TaskRow
        issue={issue}
        linkedMrResults={[]}
        onStatusClick={() => {}}
        onCommentClick={() => {}}
      />,
    );
    expect(screen.getByText(/— no MR/i)).toBeTruthy();
  });
});
