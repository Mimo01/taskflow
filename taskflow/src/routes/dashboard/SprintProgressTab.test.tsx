// PM-01: Sprint progress buckets from statusCategory
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
  statusCategoryKey: 'new' | 'indeterminate' | 'done' | undefined,
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
        statusCategory: statusCategoryKey ? { key: statusCategoryKey } : undefined,
      },
      assignee: null,
      customfield_10016: pts,
      issuetype: { name: 'Story' },
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

describe('SprintProgressTab', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-establish readSecret mock implementation after clearAllMocks clears it
    const stronghold = await import('@/services/stronghold');
    vi.mocked(stronghold.readSecret).mockResolvedValue('test-jira-token');
  });

  it('groups issues into To Do / In Progress / Done buckets using statusCategory.key', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', 5),
      makeIssue('P-2', 'indeterminate', 3),
      makeIssue('P-3', 'done', 8),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    // Wait for data to load — findByText waits for the progress summary which only appears after fetch
    await screen.findByText(/8\s*\/\s*16\s*pts/i);
    // All three bucket labels should be visible
    expect(screen.getByText(/to do/i)).toBeTruthy();
    expect(screen.getByText(/in progress/i)).toBeTruthy();
    expect(screen.getAllByText(/done/i).length).toBeGreaterThan(0);
    // Each bucket should show "1" count
    const counts = screen.getAllByText('1');
    expect(counts.length).toBeGreaterThanOrEqual(3);
  });

  it('sums story points done vs remaining and shows progress bar when points present', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', 5),
      makeIssue('P-2', 'indeterminate', 3),
      makeIssue('P-3', 'done', 8),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    // Should show "8 / 16 pts" (done=8, total=16)
    await screen.findByText(/8\s*\/\s*16\s*pts/i);
    // Progress bar should be visible
    const progressBar = document.querySelector('[data-testid="progress-bar"]');
    expect(progressBar).not.toBeNull();
  });

  it('hides progress bar when all issues have null story points', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', null),
      makeIssue('P-2', 'indeterminate', null),
      makeIssue('P-3', 'done', null),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    await screen.findByText(/to do/i);
    // Progress bar should be hidden
    const progressBar = document.querySelector('[data-testid="progress-bar"]');
    expect(progressBar).toBeNull();
  });

  it('shows task count even when story points are hidden', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', null),
      makeIssue('P-2', 'new', null),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    // Wait for data to load — "2" appears as the To Do count only after fetch resolves
    await screen.findByText('2');
    // Progress bar should not be shown
    const progressBar = document.querySelector('[data-testid="progress-bar"]');
    expect(progressBar).toBeNull();
  });

  it('defaults missing statusCategory.key to todo bucket (does not crash)', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', undefined, null),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    // Wait for data to load — "1" appears as the To Do count only after fetch resolves
    await screen.findByText('1');
    // Should show "to do" bucket label
    expect(screen.getByText(/to do/i)).toBeTruthy();
  });
});
