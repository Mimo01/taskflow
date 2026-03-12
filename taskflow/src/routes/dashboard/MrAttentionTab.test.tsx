/**
 * MrAttentionTab tests — DEV-03, DEV-05, UI-03, LINK-03, LINK-04
 *
 * Tests stale badge logic, no-stale-badge for fresh MRs,
 * and MR-to-task linking behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  })),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    gitlabBaseUrl: 'https://gitlab.example.com',
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  })),
}));

// Mock jira service for sprint issues
vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
}));

// Helper to create an MR with given updated_at
function makeMR(iid: number, updatedAt: string, title = `MR ${iid}`) {
  return {
    id: iid,
    iid,
    project_id: 1,
    title,
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

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
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
    vi.mocked(useAuthStore).mockReturnValue({ gitlabBaseUrl: 'https://gitlab.example.com', jiraBaseUrl: 'https://jira.example.com', activeJiraProject: 'PROJ' } as ReturnType<typeof useAuthStore>);

    const { default: MrAttentionTab } = await import('./MrAttentionTab');
    renderWithQuery(<MrAttentionTab />);

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
    vi.mocked(useAuthStore).mockReturnValue({ gitlabBaseUrl: 'https://gitlab.example.com', jiraBaseUrl: 'https://jira.example.com', activeJiraProject: 'PROJ' } as ReturnType<typeof useAuthStore>);

    const { default: MrAttentionTab } = await import('./MrAttentionTab');
    renderWithQuery(<MrAttentionTab />);

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
    } as ReturnType<typeof useAuthStore>);

    const { default: MrAttentionTab } = await import('./MrAttentionTab');
    renderWithQuery(<MrAttentionTab />);

    // MrRow should render with linked task key badge — identified by font-mono class on the badge span
    // We check for multiple PROJ-7 elements: one in MR title, one in linked task badge
    const allMatches = await screen.findAllByText(/PROJ-7/i);
    expect(allMatches.length).toBeGreaterThanOrEqual(2); // MR title + task badge
  });
});
