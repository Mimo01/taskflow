/**
 * MrAttentionTab tests — DEV-03, DEV-05, UI-03, LINK-03, LINK-04, MRAT-01, MRAT-02
 *
 * Tests stale badge logic, no-stale-badge for fresh MRs,
 * MR-to-task linking behavior, and subtask-linked story MR inclusion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-gitlab-token'),
}));

// Mock GitLab service
vi.mock('@/services/gitlab', () => ({
  validateGitLab: vi.fn().mockResolvedValue({ id: 42, name: 'Test User', username: 'testuser' }),
  fetchAssignedMRs: vi.fn().mockResolvedValue([]),
  fetchReviewerMRs: vi.fn().mockResolvedValue([]),
  fetchProjectMRs: vi.fn().mockResolvedValue([]),
  fetchMRDiscussions: vi.fn().mockResolvedValue([]),
  fetchMRApprovals: vi.fn().mockResolvedValue({ approved_by: [], approved: false }),
}));

// Mock link engine
vi.mock('@/services/linkEngine', () => ({
  linkMRToTask: vi.fn().mockReturnValue(null),
  linkMRToTaskViaCommits: vi.fn().mockReturnValue(null),
  extractTicketKeys: vi.fn().mockReturnValue([]),
  deriveReviewHealth: vi.fn().mockReturnValue('waiting_for_review'),
  isStale: vi.fn().mockReturnValue(false),
}));

// Mock settings store
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    staleMrThresholdDays: 3,
    storyPointsFieldKey: 'customfield_10016',
  })),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    gitlabBaseUrl: 'https://gitlab.example.com',
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabUserId: 42,
  })),
}));

// Mock jira service for sprint issues and my-tasks hierarchy
vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
  fetchMyTasksHierarchy: vi.fn().mockResolvedValue({ issues: [], myIssueKeys: new Set() }),
}));

// Helper to create an MR with given updated_at
function makeMR(iid: number, updatedAt: string, title = `MR ${iid}`, source_branch = `feature/branch-${iid}`) {
  return {
    id: iid,
    iid,
    project_id: 1,
    title,
    source_branch,
    state: 'opened' as const,
    author: { id: 1, name: 'Author', username: 'author', avatar_url: '' },
    reviewers: [],
    updated_at: updatedAt,
    web_url: `https://gitlab.example.com/mr/${iid}`,
  };
}

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

function makeSubtaskIssue(key: string, parentKey: string) {
  return {
    id: key,
    key,
    fields: {
      summary: `Subtask ${key}`,
      status: { id: '3', name: 'In Progress' },
      assignee: null,
      customfield_10016: null,
      issuetype: { name: 'Sub-task', subtask: true },
      parent: { key: parentKey },
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

// Pre-populate the gitlab-current-user cache so userId is available immediately
// (avoids reviewer MRs being skipped on first MR query run before validateGitLab resolves)
function renderWithQueryAndUser(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  queryClient.setQueryData(
    ['gitlab-current-user', 'https://gitlab.example.com'],
    { id: 42, name: 'Test User', username: 'testuser' },
  );
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('MrAttentionTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders stale badge on MR older than threshold', async () => {
    const { fetchAssignedMRs } = await import('@/services/gitlab');
    // MR updated 10 days ago — stale threshold is 3 days
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    vi.mocked(fetchAssignedMRs).mockResolvedValue([makeMR(1, tenDaysAgo)]);

    const { isStale } = await import('@/services/linkEngine');
    vi.mocked(isStale).mockReturnValue(true);

    const { useSettingsStore } = await import('@/stores/settings.store');
    vi.mocked(useSettingsStore).mockReturnValue({ staleMrThresholdDays: 3 } as ReturnType<typeof useSettingsStore>);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({ gitlabBaseUrl: 'https://gitlab.example.com', jiraBaseUrl: 'https://jira.example.com', activeJiraProject: 'PROJ', gitlabUserId: 42 } as ReturnType<typeof useAuthStore>);

    const { default: MrAttentionTab } = await import('./MrAttentionTab');
    renderWithQueryAndUser(<MrAttentionTab />);

    await screen.findByText(/stale/i);
  });

  it('does not render stale badge on fresh MR', async () => {
    const { fetchAssignedMRs } = await import('@/services/gitlab');
    // MR updated 1 hour ago — stale threshold is 3 days
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    vi.mocked(fetchAssignedMRs).mockResolvedValue([makeMR(2, oneHourAgo)]);

    const { isStale } = await import('@/services/linkEngine');
    vi.mocked(isStale).mockReturnValue(false);

    const { useSettingsStore } = await import('@/stores/settings.store');
    vi.mocked(useSettingsStore).mockReturnValue({ staleMrThresholdDays: 3 } as ReturnType<typeof useSettingsStore>);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({ gitlabBaseUrl: 'https://gitlab.example.com', jiraBaseUrl: 'https://jira.example.com', activeJiraProject: 'PROJ', gitlabUserId: 42 } as ReturnType<typeof useAuthStore>);

    const { default: MrAttentionTab } = await import('./MrAttentionTab');
    renderWithQueryAndUser(<MrAttentionTab />);

    // Wait for data to load
    await screen.findByText(/MR 2/i);

    // Should not have stale badge
    const staleBadge = screen.queryByText(/stale/i);
    expect(staleBadge).toBeNull();
  });

  it('MrRow receives linkedTask when MR title contains sprint issue key', async () => {
    const { fetchAssignedMRs } = await import('@/services/gitlab');
    const now = new Date().toISOString();
    vi.mocked(fetchAssignedMRs).mockResolvedValue([makeMR(10, now, 'PROJ-7 fix something')]);

    const { linkMRToTask } = await import('@/services/linkEngine');
    vi.mocked(linkMRToTask).mockImplementation((mr, keys) =>
      keys.has('PROJ-7') && mr.title.includes('PROJ-7') ? 'PROJ-7' : null,
    );

    // Provide sprint issues via jira service
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([makeIssue('PROJ-7')]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      gitlabBaseUrl: 'https://gitlab.example.com',
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabUserId: 42,
    } as ReturnType<typeof useAuthStore>);

    const { default: MrAttentionTab } = await import('./MrAttentionTab');
    renderWithQueryAndUser(<MrAttentionTab />);

    // MrRow should render with linked task key badge — identified by font-mono class on the badge span
    // We check for multiple PROJ-7 elements: one in MR title, one in linked task badge
    const allMatches = await screen.findAllByText(/PROJ-7/i);
    expect(allMatches.length).toBeGreaterThanOrEqual(2); // MR title + task badge
  });

  // MRAT-03: project-level MR sprint-linked inclusion
  describe('MRAT-03: project-level sprint-linked MRs', () => {
    it('includes project MR linked to sprint issue key even without GitLab assignment', async () => {
      // User is not assignee/reviewer. MR only appears via fetchProjectMRs.
      // MR title contains sprint issue key PROJ-99.
      const now = new Date().toISOString();
      const { fetchAssignedMRs, fetchReviewerMRs, fetchProjectMRs, fetchMRDiscussions } = await import('@/services/gitlab');
      vi.mocked(fetchAssignedMRs).mockResolvedValue([]);
      vi.mocked(fetchReviewerMRs).mockResolvedValue([]);
      vi.mocked(fetchProjectMRs).mockResolvedValue([makeMR(88, now, 'PROJ-99 feature from project pool')]);
      vi.mocked(fetchMRDiscussions).mockResolvedValue([]);

      const { linkMRToTask } = await import('@/services/linkEngine');
      vi.mocked(linkMRToTask).mockImplementation((mr, keys) =>
        keys.has('PROJ-99') && mr.title.includes('PROJ-99') ? 'PROJ-99' : null,
      );

      const { fetchSprintIssues } = await import('@/services/jira');
      vi.mocked(fetchSprintIssues).mockResolvedValue([makeIssue('PROJ-99')]);

      const { useAuthStore } = await import('@/stores/auth.store');
      vi.mocked(useAuthStore).mockReturnValue({
        gitlabBaseUrl: 'https://gitlab.example.com',
        jiraBaseUrl: 'https://jira.example.com',
        activeJiraProject: 'PROJ',
        activeGitlabProject: 5,
        gitlabUserId: 42,
      } as ReturnType<typeof useAuthStore>);

      const { default: MrAttentionTab } = await import('./MrAttentionTab');
      renderWithQueryAndUser(<MrAttentionTab />);

      // MR 88 should appear in the attention tab because its title links to PROJ-99
      await screen.findByText(/PROJ-99 feature from project pool/i, {}, { timeout: 3000 });
    });
  });

  // MRAT-02: subtask-linked story MRs
  describe('MRAT-02: subtask-linked story MRs', () => {
    it('includes reviewer MR linked to a story where user has subtask (bypasses discussion filter)', async () => {
      // MR is a reviewer MR linked to STORY-1. User has subtask SUB-1 under STORY-1.
      // Without subtask path: this MR would be excluded (no unresolved discussions).
      // With subtask path: should be included unconditionally.
      const now = new Date().toISOString();
      const { fetchAssignedMRs, fetchReviewerMRs, fetchMRDiscussions } = await import('@/services/gitlab');
      vi.mocked(fetchAssignedMRs).mockResolvedValue([]);
      vi.mocked(fetchReviewerMRs).mockResolvedValue([makeMR(20, now, 'STORY-1 some fix')]);
      // No unresolved discussions — would normally exclude this reviewer MR
      vi.mocked(fetchMRDiscussions).mockResolvedValue([]);

      // linkMRToTask: returns STORY-1 when keys contains STORY-1
      const { linkMRToTask } = await import('@/services/linkEngine');
      vi.mocked(linkMRToTask).mockImplementation((mr, keys) =>
        keys.has('STORY-1') && mr.title.includes('STORY-1') ? 'STORY-1' : null,
      );

      // my-tasks: user has subtask SUB-1 whose parent is STORY-1
      const { fetchMyTasksHierarchy } = await import('@/services/jira');
      vi.mocked(fetchMyTasksHierarchy).mockResolvedValue({
        issues: [makeSubtaskIssue('SUB-1', 'STORY-1') as any],
        myIssueKeys: new Set(['SUB-1']),
      });

      const { useAuthStore } = await import('@/stores/auth.store');
      vi.mocked(useAuthStore).mockReturnValue({
        gitlabBaseUrl: 'https://gitlab.example.com',
        jiraBaseUrl: 'https://jira.example.com',
        activeJiraProject: 'PROJ',
        gitlabUserId: 42,
      } as ReturnType<typeof useAuthStore>);

      const { default: MrAttentionTab } = await import('./MrAttentionTab');
      renderWithQueryAndUser(<MrAttentionTab />);

      // MR 20 should appear because it's linked to STORY-1 (subtask path)
      await screen.findByText(/STORY-1/i, {}, { timeout: 3000 });
    });

    it('shows "via [subtask-key]" label on subtask-path-only MRs', async () => {
      // MR is only in list because of subtask path — should show "via SUB-1"
      const now = new Date().toISOString();
      const { fetchAssignedMRs, fetchReviewerMRs, fetchMRDiscussions } = await import('@/services/gitlab');
      vi.mocked(fetchAssignedMRs).mockResolvedValue([]);
      vi.mocked(fetchReviewerMRs).mockResolvedValue([makeMR(21, now, 'STORY-2 feature branch')]);
      vi.mocked(fetchMRDiscussions).mockResolvedValue([]);

      const { linkMRToTask } = await import('@/services/linkEngine');
      // Returns STORY-2 only when keys contains STORY-2 (subtask story key)
      vi.mocked(linkMRToTask).mockImplementation((mr, keys) =>
        keys.has('STORY-2') && mr.title.includes('STORY-2') ? 'STORY-2' : null,
      );

      const { fetchMyTasksHierarchy } = await import('@/services/jira');
      vi.mocked(fetchMyTasksHierarchy).mockResolvedValue({
        issues: [makeSubtaskIssue('SUB-2', 'STORY-2') as any],
        myIssueKeys: new Set(['SUB-2']),
      });

      const { useAuthStore } = await import('@/stores/auth.store');
      vi.mocked(useAuthStore).mockReturnValue({
        gitlabBaseUrl: 'https://gitlab.example.com',
        jiraBaseUrl: 'https://jira.example.com',
        activeJiraProject: 'PROJ',
        gitlabUserId: 42,
      } as ReturnType<typeof useAuthStore>);

      const { default: MrAttentionTab } = await import('./MrAttentionTab');
      renderWithQueryAndUser(<MrAttentionTab />);

      // "via SUB-2" should appear as the label for the subtask-only MR
      await screen.findByText(/via SUB-2/i, {}, { timeout: 3000 });
    });

    it('does not show "via" label on MRs already included via sprint/assigned path', async () => {
      // MR is assigned to user AND linked to a story where user has subtask
      // → already in list via assignment, no "via" label
      const now = new Date().toISOString();
      const { fetchAssignedMRs, fetchReviewerMRs } = await import('@/services/gitlab');
      vi.mocked(fetchAssignedMRs).mockResolvedValue([makeMR(22, now, 'STORY-3 assigned mr')]);
      vi.mocked(fetchReviewerMRs).mockResolvedValue([]);

      const { linkMRToTask } = await import('@/services/linkEngine');
      // Returns STORY-3 for sprint key set (meaning it's already sprint-linked)
      vi.mocked(linkMRToTask).mockImplementation((mr, keys) =>
        keys.has('STORY-3') && mr.title.includes('STORY-3') ? 'STORY-3' : null,
      );

      // Sprint issues include STORY-3 so MR is sprint-linked
      const { fetchSprintIssues } = await import('@/services/jira');
      vi.mocked(fetchSprintIssues).mockResolvedValue([makeIssue('STORY-3')]);

      const { fetchMyTasksHierarchy } = await import('@/services/jira');
      vi.mocked(fetchMyTasksHierarchy).mockResolvedValue({
        issues: [makeSubtaskIssue('SUB-3', 'STORY-3') as any],
        myIssueKeys: new Set(['SUB-3']),
      });

      const { useAuthStore } = await import('@/stores/auth.store');
      vi.mocked(useAuthStore).mockReturnValue({
        gitlabBaseUrl: 'https://gitlab.example.com',
        jiraBaseUrl: 'https://jira.example.com',
        activeJiraProject: 'PROJ',
        gitlabUserId: 42,
      } as ReturnType<typeof useAuthStore>);

      const { default: MrAttentionTab } = await import('./MrAttentionTab');
      renderWithQuery(<MrAttentionTab />);

      // MR 22 appears (assigned path)
      await screen.findByText(/STORY-3 assigned mr/i, {}, { timeout: 3000 });

      // No "via" label since it's already included via assignment/sprint
      await waitFor(() => {
        expect(screen.queryByText(/via SUB-3/i)).toBeNull();
      }, { timeout: 3000 });
    });

    it('gracefully shows base MR list when subtask data is unavailable', async () => {
      // fetchMyTasksHierarchy rejects — base list still shown, no crash
      const now = new Date().toISOString();
      const { fetchAssignedMRs, fetchReviewerMRs } = await import('@/services/gitlab');
      vi.mocked(fetchAssignedMRs).mockResolvedValue([makeMR(30, now, 'Base MR')]);
      vi.mocked(fetchReviewerMRs).mockResolvedValue([]);

      const { fetchMyTasksHierarchy } = await import('@/services/jira');
      vi.mocked(fetchMyTasksHierarchy).mockRejectedValue(new Error('unavailable'));

      const { useAuthStore } = await import('@/stores/auth.store');
      vi.mocked(useAuthStore).mockReturnValue({
        gitlabBaseUrl: 'https://gitlab.example.com',
        jiraBaseUrl: 'https://jira.example.com',
        activeJiraProject: 'PROJ',
        gitlabUserId: 42,
      } as ReturnType<typeof useAuthStore>);

      const { default: MrAttentionTab } = await import('./MrAttentionTab');
      renderWithQuery(<MrAttentionTab />);

      // Base MR still rendered
      await screen.findByText(/Base MR/i);
      // No crash — no error boundary triggered
      expect(screen.queryByText(/failed/i)).toBeNull();
    });
  });
});
