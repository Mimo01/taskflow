/**
 * DashboardSprintCard tests — DASH-02
 *
 * Tests sprint name display, days remaining, % complete progress bar,
 * zero-denominator guard, empty state (no active sprint), and loading skeleton.
 *
 * Fixture builder accepts displayName | null so it can be reused in plan 02.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @tanstack/react-query (useQuery, useQueryClient)
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false, isError: false }),
    useQueryClient: vi.fn().mockReturnValue({ getQueryData: vi.fn() }),
  };
});

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

// Mock jira service
vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
  fetchActiveSprint: vi.fn().mockResolvedValue(null),
  fetchFixVersions: vi.fn().mockResolvedValue([]),
}));

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

/**
 * Fixture builder — accepts displayName | null so plan 02 can reuse this builder.
 * storyPoints: number | null — defaults to null (no points).
 */
function makeSprintIssue(
  key: string,
  statusCategoryKey: 'done' | 'indeterminate' | 'new',
  storyPoints: number | null = null,
  isSubtask = false,
  displayName: string | null = null,
) {
  return {
    id: key,
    key,
    fields: {
      summary: `Task ${key}`,
      status: {
        id: '3',
        name:
          statusCategoryKey === 'done'
            ? 'Done'
            : statusCategoryKey === 'indeterminate'
              ? 'In Progress'
              : 'To Do',
        statusCategory: { key: statusCategoryKey },
      },
      assignee: displayName ? { displayName, avatarUrls: { '48x48': '' } } : null,
      issuetype: { name: isSubtask ? 'Sub-task' : 'Story', subtask: isSubtask },
      customfield_10016: storyPoints,
      timetracking: { timeSpentSeconds: 0 },
    },
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('DashboardSprintCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sprint name and days remaining when activeSprint is returned', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const issues: ReturnType<typeof makeSprintIssue>[] = [];

    // 3 days from now
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const activeSprint = { id: 1, name: 'Sprint 42', state: 'active', endDate: futureDate };

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: issues,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: activeSprint,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardSprintCard } = await import('./DashboardSprintCard');
    renderWithQuery(
      <DashboardSprintCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
        storyPointsFieldKey="customfield_10016"
      />,
    );

    // Sprint name should be visible
    expect(screen.getByText('Sprint 42')).toBeDefined();
    // Days remaining should appear (3 days)
    expect(screen.getByText(/3.*day/)).toBeDefined();
  });

  it('renders progressbar with aria-valuenow equal to done percentage (60%)', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const issues = [
      makeSprintIssue('PROJ-1', 'done', 3),
      makeSprintIssue('PROJ-2', 'done', 3),
      makeSprintIssue('PROJ-3', 'indeterminate', 4),
    ];
    const activeSprint = {
      id: 1,
      name: 'Sprint 42',
      state: 'active',
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: issues,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: activeSprint,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardSprintCard } = await import('./DashboardSprintCard');
    renderWithQuery(
      <DashboardSprintCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
        storyPointsFieldKey="customfield_10016"
      />,
    );

    // 6 done out of 10 total = 60%
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeDefined();
    const valuenow = progressbar.getAttribute('aria-valuenow');
    expect(Number(valuenow)).toBe(60);
  });

  it('renders progressbar with aria-valuenow of 0 when all story points are null (zero-denominator guard)', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const issues = [
      makeSprintIssue('PROJ-1', 'done', null),
      makeSprintIssue('PROJ-2', 'indeterminate', null),
    ];
    const activeSprint = {
      id: 1,
      name: 'Sprint 42',
      state: 'active',
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: issues,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: activeSprint,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardSprintCard } = await import('./DashboardSprintCard');
    renderWithQuery(
      <DashboardSprintCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
        storyPointsFieldKey="customfield_10016"
      />,
    );

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeDefined();
    const valuenow = progressbar.getAttribute('aria-valuenow');
    expect(Number(valuenow)).toBe(0);
  });

  it('renders "No active sprint" empty state when activeSprint is null', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: null,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardSprintCard } = await import('./DashboardSprintCard');
    renderWithQuery(
      <DashboardSprintCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
        storyPointsFieldKey="customfield_10016"
      />,
    );

    expect(screen.getByText('No active sprint')).toBeDefined();
  });

  it('does not throw during loading skeleton state and renders normally once loaded', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    // First render: loading
    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: true,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: true,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardSprintCard } = await import('./DashboardSprintCard');

    // Should not throw
    expect(() =>
      renderWithQuery(
        <DashboardSprintCard
          jiraBaseUrl="https://jira.example.com"
          jiraToken="token"
          activeJiraProject="PROJ"
          storyPointsFieldKey="customfield_10016"
        />,
      ),
    ).not.toThrow();

    // Once loaded (not loading, no sprint), should show empty state
    vi.clearAllMocks();
    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: null,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    renderWithQuery(
      <DashboardSprintCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
        storyPointsFieldKey="customfield_10016"
      />,
    );

    expect(screen.getAllByText('No active sprint').length).toBeGreaterThan(0);
  });
});
