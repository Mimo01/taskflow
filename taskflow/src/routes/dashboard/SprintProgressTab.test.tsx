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
  beforeEach(() => {
    vi.clearAllMocks();
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

    await screen.findByText(/to do/i);
    expect(screen.getByText(/in progress/i)).toBeTruthy();
    expect(screen.getByText(/done/i)).toBeTruthy();
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

    await screen.findByText(/to do/i);
    // Should show "2" for To Do count
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('defaults missing statusCategory.key to todo bucket (does not crash)', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', undefined, null),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    await screen.findByText(/to do/i);
    // Should not crash and should show 1 in To Do
    expect(screen.getByText('1')).toBeTruthy();
  });
});
