// PM-02: Workload grouped by assignee
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// Mock settings store
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
  })),
}));

function makeIssue(
  key: string,
  assigneeName: string | null,
  statusCategoryKey: 'new' | 'indeterminate' | 'done',
  pts: number | null,
  options?: {
    subtask?: boolean;
    timetracking?: {
      originalEstimateSeconds?: number;
      timeSpentSeconds?: number;
      remainingEstimateSeconds?: number;
    } | null;
  },
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
      issuetype: { name: options?.subtask ? 'Sub-task' : 'Story', subtask: options?.subtask ?? false },
      timetracking: options?.timetracking ?? null,
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
    // Re-establish settings store mock
    const settingsStore = await import('@/stores/settings.store');
    vi.mocked(settingsStore.useSettingsStore).mockReturnValue({
      storyPointsFieldKey: 'customfield_10016',
    } as ReturnType<typeof settingsStore.useSettingsStore>);
  });

  it('groups sprint issues by assignee — done excluded from count/pts but visible as sub-rows', async () => {
    const user = userEvent.setup();
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'Alice', 'indeterminate', 5),
      makeIssue('P-2', 'Alice', 'done', 3),       // done — excluded from count/pts
      makeIssue('P-3', null, 'new', 2),            // unassigned
    ]);

    const { default: WorkloadTab } = await import('./WorkloadTab');
    renderWithQuery(<WorkloadTab />);

    await screen.findByText('Alice');
    // Alice: only 1 open task (P-1, not P-2 which is done)
    // Unassigned: 1 open task (P-3)
    expect(screen.getByText('Unassigned')).toBeTruthy();

    // Alice row should show 1 task (P-2 done is excluded from count/pts)
    const aliceRow = screen.getByText('Alice').closest('[data-testid="workload-row"]');
    expect(aliceRow).not.toBeNull();
    expect(aliceRow?.textContent).toMatch(/1/);
    expect(aliceRow?.textContent).toMatch(/5\s*pts/i);

    // Expand Alice row — both P-1 and P-2 (done) should appear as sub-rows
    await user.click(aliceRow!);
    expect(screen.getByText('P-1')).toBeTruthy();
    expect(screen.getByText('P-2')).toBeTruthy();
  });

  it('sums story points per assignee (unresolved only)', async () => {
    const user = userEvent.setup();
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'Bob', 'new', 8),
      makeIssue('P-2', 'Bob', 'indeterminate', 5),
      makeIssue('P-3', 'Bob', 'done', 13),         // done — points excluded from total
    ]);

    const { default: WorkloadTab } = await import('./WorkloadTab');
    renderWithQuery(<WorkloadTab />);

    await screen.findByText('Bob');
    // Bob open tasks: P-1 (8pts) + P-2 (5pts) = 13 pts, 2 tasks
    const bobRow = screen.getByText('Bob').closest('[data-testid="workload-row"]');
    expect(bobRow?.textContent).toMatch(/13\s*pts/i);

    // Expand Bob row — done story P-3 should also appear as a sub-row
    await user.click(bobRow!);
    expect(screen.getByText('P-3')).toBeTruthy();
  });

  it('shows assignee row for person with only done stories', async () => {
    const user = userEvent.setup();
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'Carol', 'done', 5),
    ]);

    const { default: WorkloadTab } = await import('./WorkloadTab');
    renderWithQuery(<WorkloadTab />);

    // Carol should still appear even though her only story is done
    await screen.findByText('Carol');

    const carolRow = screen.getByText('Carol').closest('[data-testid="workload-row"]');
    expect(carolRow).not.toBeNull();
    // Carol row should show 0 tasks and 0 pts
    expect(carolRow?.textContent).toMatch(/0\s*tasks?/i);
    expect(carolRow?.textContent).toMatch(/0\s*pts/i);

    // Expand Carol row — P-1 (done) should appear as a sub-row
    await user.click(carolRow!);
    expect(screen.getByText('P-1')).toBeTruthy();
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

  describe('WORK-01: excludes subtasks from point and task totals', () => {
    it('excludes subtask points from assignee story point total', async () => {
      const { fetchSprintIssues } = await import('@/services/jira');
      vi.mocked(fetchSprintIssues).mockResolvedValue([
        makeIssue('P-1', 'Alice', 'indeterminate', 5),                      // story: 5pts
        makeIssue('P-2', 'Alice', 'indeterminate', 8, { subtask: true }),   // subtask: excluded from pts
      ]);

      const { default: WorkloadTab } = await import('./WorkloadTab');
      renderWithQuery(<WorkloadTab />);

      await screen.findByText('Alice');
      const aliceRow = screen.getByText('Alice').closest('[data-testid="workload-row"]');
      expect(aliceRow).not.toBeNull();
      // Should show 5 pts, not 13 pts
      expect(aliceRow?.textContent).toMatch(/5\s*pts/i);
      expect(aliceRow?.textContent).not.toMatch(/13\s*pts/i);
    });

    it('excludes subtasks from task count', async () => {
      const { fetchSprintIssues } = await import('@/services/jira');
      vi.mocked(fetchSprintIssues).mockResolvedValue([
        makeIssue('P-1', 'Alice', 'indeterminate', 5),                      // story: counts
        makeIssue('P-2', 'Alice', 'indeterminate', 8, { subtask: true }),   // subtask: excluded from count
      ]);

      const { default: WorkloadTab } = await import('./WorkloadTab');
      renderWithQuery(<WorkloadTab />);

      await screen.findByText('Alice');
      const aliceRow = screen.getByText('Alice').closest('[data-testid="workload-row"]');
      // Should show 1 task, not 2 tasks
      expect(aliceRow?.textContent).toMatch(/1\s*task/i);
      expect(aliceRow?.textContent).not.toMatch(/2\s*tasks/i);
    });
  });

  describe('WORK-02: time tracking columns', () => {
    it('shows time columns when sprint has time tracking data', async () => {
      const { fetchSprintIssues } = await import('@/services/jira');
      vi.mocked(fetchSprintIssues).mockResolvedValue([
        makeIssue('P-1', 'Alice', 'indeterminate', 5, {
          timetracking: { originalEstimateSeconds: 14400 }, // 4h
        }),
      ]);

      const { default: WorkloadTab } = await import('./WorkloadTab');
      renderWithQuery(<WorkloadTab />);

      await screen.findByText('Alice');
      // Table header should contain "Est"
      expect(screen.getByText('Est')).toBeTruthy();
      // The assignee row should show "4h" somewhere
      const aliceRow = screen.getByText('Alice').closest('[data-testid="workload-row"]');
      expect(aliceRow?.textContent).toMatch(/4h/i);
    });

    it('hides time columns when all time tracking is null/zero', async () => {
      const { fetchSprintIssues } = await import('@/services/jira');
      vi.mocked(fetchSprintIssues).mockResolvedValue([
        makeIssue('P-1', 'Alice', 'indeterminate', 5, { timetracking: null }),
      ]);

      const { default: WorkloadTab } = await import('./WorkloadTab');
      renderWithQuery(<WorkloadTab />);

      await screen.findByText('Alice');
      // Time columns should NOT appear at all
      expect(screen.queryByText('Est')).toBeNull();
      expect(screen.queryByText('Spent')).toBeNull();
      expect(screen.queryByText('Remaining')).toBeNull();
    });

    it('formats seconds as Xh Ym', async () => {
      const { fetchSprintIssues } = await import('@/services/jira');
      vi.mocked(fetchSprintIssues).mockResolvedValue([
        makeIssue('P-1', 'Alice', 'indeterminate', 5, {
          timetracking: { originalEstimateSeconds: 16200 }, // 4h 30m
        }),
      ]);

      const { default: WorkloadTab } = await import('./WorkloadTab');
      renderWithQuery(<WorkloadTab />);

      await screen.findByText('Alice');
      const aliceRow = screen.getByText('Alice').closest('[data-testid="workload-row"]');
      expect(aliceRow?.textContent).toMatch(/4h 30m/i);
    });
  });

  describe('WORK-03: expand/collapse per-story rows', () => {
    it('assignee rows are collapsed by default — story key not visible', async () => {
      const { fetchSprintIssues } = await import('@/services/jira');
      vi.mocked(fetchSprintIssues).mockResolvedValue([
        makeIssue('P-1', 'Alice', 'indeterminate', 5),
      ]);

      const { default: WorkloadTab } = await import('./WorkloadTab');
      renderWithQuery(<WorkloadTab />);

      await screen.findByText('Alice');
      // Story key P-1 should NOT be visible on initial render (collapsed)
      expect(screen.queryByText('P-1')).toBeNull();
    });

    it('clicking expand toggle reveals per-story rows', async () => {
      const user = userEvent.setup();
      const { fetchSprintIssues } = await import('@/services/jira');
      vi.mocked(fetchSprintIssues).mockResolvedValue([
        makeIssue('P-1', 'Alice', 'indeterminate', 5),
      ]);

      const { default: WorkloadTab } = await import('./WorkloadTab');
      renderWithQuery(<WorkloadTab />);

      await screen.findByText('Alice');
      // Initially collapsed
      expect(screen.queryByText('P-1')).toBeNull();

      // Click the assignee row to expand
      const aliceRow = screen.getByText('Alice').closest('[data-testid="workload-row"]');
      expect(aliceRow).not.toBeNull();
      await user.click(aliceRow!);

      // Story key P-1 should now be visible
      expect(screen.getByText('P-1')).toBeTruthy();
    });
  });
});
