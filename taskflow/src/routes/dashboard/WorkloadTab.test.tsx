// PM-02: Workload grouped by assignee
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// Mock jira service
vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  })),
}));

function makeIssue(
  key: string,
  assigneeName: string | null,
  statusCategoryKey: 'new' | 'indeterminate' | 'done',
  pts: number | null,
) {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary ${key}`,
      status: {
        id: '1',
        name: statusCategoryKey === 'done' ? 'Done' : statusCategoryKey === 'indeterminate' ? 'In Progress' : 'To Do',
        statusCategory: { key: statusCategoryKey },
      },
      assignee: assigneeName
        ? { displayName: assigneeName, avatarUrls: { '48x48': '' } }
        : null,
      customfield_10016: pts,
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

describe('WorkloadTab', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-establish readSecret mock implementation after clearAllMocks clears it
    const stronghold = await import('@/services/stronghold');
    vi.mocked(stronghold.readSecret).mockResolvedValue('test-jira-token');
  });

  it('groups open (non-done) sprint issues by assignee displayName, excludes done issues', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'Alice', 'indeterminate', 5),
      makeIssue('P-2', 'Alice', 'done', 3),       // done — excluded
      makeIssue('P-3', null, 'new', 2),            // unassigned
    ]);

    const { default: WorkloadTab } = await import('./WorkloadTab');
    renderWithQuery(<WorkloadTab />);

    await screen.findByText('Alice');
    // Alice: only 1 open task (P-1, not P-2 which is done)
    // Unassigned: 1 open task (P-3)
    expect(screen.getByText('Unassigned')).toBeTruthy();

    // Alice row should show 1 task (P-2 done is excluded)
    const aliceRow = screen.getByText('Alice').closest('[data-testid="workload-row"]');
    expect(aliceRow).not.toBeNull();
    expect(aliceRow?.textContent).toMatch(/1/);
    expect(aliceRow?.textContent).toMatch(/5\s*pts/i);
  });

  it('sums story points per assignee (unresolved only)', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'Bob', 'new', 8),
      makeIssue('P-2', 'Bob', 'indeterminate', 5),
      makeIssue('P-3', 'Bob', 'done', 13),         // done — points excluded
    ]);

    const { default: WorkloadTab } = await import('./WorkloadTab');
    renderWithQuery(<WorkloadTab />);

    await screen.findByText('Bob');
    // Bob open tasks: P-1 (8pts) + P-2 (5pts) = 13 pts, 2 tasks
    const bobRow = screen.getByText('Bob').closest('[data-testid="workload-row"]');
    expect(bobRow?.textContent).toMatch(/13\s*pts/i);
  });

  it('shows Unassigned bucket for issues with null assignee', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', null, 'new', 2),
    ]);

    const { default: WorkloadTab } = await import('./WorkloadTab');
    renderWithQuery(<WorkloadTab />);

    await screen.findByText('Unassigned');
  });

  it('renders empty state message when sprint has no open issues', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([]);

    const { default: WorkloadTab } = await import('./WorkloadTab');
    renderWithQuery(<WorkloadTab />);

    await screen.findByText(/no sprint data available/i);
  });
});
