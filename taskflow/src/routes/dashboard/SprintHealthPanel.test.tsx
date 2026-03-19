/**
 * SprintHealthPanel tests — DASH-03
 *
 * Tests % points done computation, days-left display,
 * graceful hiding when endDate is absent, at-risk items list,
 * and no-at-risk state.
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
    gitlabBaseUrl: 'https://gitlab.example.com',
  })),
}));

// Mock settings store — SprintHealthPanel reads storyPointsFieldKey
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
  })),
}));

// Mock jira service
vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
  fetchActiveSprint: vi.fn().mockResolvedValue(null),
}));

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// Helper: build a sprint issue fixture
function makeSprintIssue(
  key: string,
  statusCategoryKey: 'done' | 'indeterminate' | 'new',
  storyPoints: number | null = null,
  timeSpentSeconds = 0,
) {
  return {
    id: key,
    key,
    fields: {
      summary: `Story ${key}`,
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
      assignee: null,
      customfield_10016: storyPoints,
      issuetype: { name: 'Story', subtask: false },
      timetracking: { timeSpentSeconds },
    },
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('SprintHealthPanel (DASH-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('% done computation', () => {
    it('shows correct "% done" computed from done-points / total-points', async () => {
      const { useQuery } = await import('@tanstack/react-query');

      const issues = [
        makeSprintIssue('PROJ-1', 'done', 3),
        makeSprintIssue('PROJ-2', 'done', 3),
        makeSprintIssue('PROJ-3', 'indeterminate', 4),
      ];

      // Sprint-board query returns issues; active-sprint returns null
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: issues,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>)
        .mockReturnValueOnce({
          data: null,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>);

      const { default: SprintHealthPanel } = await import('./SprintHealthPanel');
      renderWithQuery(
        <SprintHealthPanel
          jiraBaseUrl="https://jira.example.com"
          jiraToken="token"
          activeJiraProject="PROJ"
        />,
      );

      // 6 done out of 10 total = 60%
      expect(screen.getByText(/60%\s*done/)).toBeDefined();
    });

    it('shows 0% done when sprint has no story points (guard: no division by zero)', async () => {
      const { useQuery } = await import('@tanstack/react-query');

      const issues = [
        makeSprintIssue('PROJ-1', 'done', null),
        makeSprintIssue('PROJ-2', 'indeterminate', null),
      ];

      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: issues,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>)
        .mockReturnValueOnce({
          data: null,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>);

      const { default: SprintHealthPanel } = await import('./SprintHealthPanel');
      renderWithQuery(
        <SprintHealthPanel
          jiraBaseUrl="https://jira.example.com"
          jiraToken="token"
          activeJiraProject="PROJ"
        />,
      );

      expect(screen.getByText(/0%\s*done/)).toBeDefined();
    });
  });

  describe('days remaining', () => {
    it('shows "N days left" when activeSprint.endDate is present', async () => {
      const { useQuery } = await import('@tanstack/react-query');

      const issues = [makeSprintIssue('PROJ-1', 'done', 5)];
      // endDate 10 days from now
      const endDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: issues,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>)
        .mockReturnValueOnce({
          data: { id: 1, name: 'Sprint 1', state: 'active', endDate },
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>);

      const { default: SprintHealthPanel } = await import('./SprintHealthPanel');
      renderWithQuery(
        <SprintHealthPanel
          jiraBaseUrl="https://jira.example.com"
          jiraToken="token"
          activeJiraProject="PROJ"
        />,
      );

      expect(screen.getByText(/days left/)).toBeDefined();
    });

    it('hides "days left" segment gracefully when activeSprint is null or endDate is absent', async () => {
      const { useQuery } = await import('@tanstack/react-query');

      const issues = [makeSprintIssue('PROJ-1', 'done', 5)];

      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: issues,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>)
        .mockReturnValueOnce({
          data: null,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>);

      const { default: SprintHealthPanel } = await import('./SprintHealthPanel');
      renderWithQuery(
        <SprintHealthPanel
          jiraBaseUrl="https://jira.example.com"
          jiraToken="token"
          activeJiraProject="PROJ"
        />,
      );

      expect(screen.queryByText(/days left/)).toBeNull();
    });
  });

  describe('at-risk items', () => {
    it('lists at-risk items (in-progress stories with timeSpentSeconds == 0) by title below summary', async () => {
      const { useQuery } = await import('@tanstack/react-query');

      const issues = [
        makeSprintIssue('PROJ-1', 'indeterminate', 3, 0), // at-risk: in-progress, no time
        makeSprintIssue('PROJ-2', 'indeterminate', 3, 3600), // not at-risk: has time logged
        makeSprintIssue('PROJ-3', 'done', 5),
      ];

      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: issues,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>)
        .mockReturnValueOnce({
          data: null,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>);

      const { default: SprintHealthPanel } = await import('./SprintHealthPanel');
      renderWithQuery(
        <SprintHealthPanel
          jiraBaseUrl="https://jira.example.com"
          jiraToken="token"
          activeJiraProject="PROJ"
        />,
      );

      // Summary shows 1 at-risk
      expect(screen.getByText(/1 at-risk/)).toBeDefined();
      // PROJ-1 title appears in at-risk list
      expect(screen.getByText(/PROJ-1/)).toBeDefined();
      // PROJ-2 does NOT appear in at-risk list
      expect(screen.queryByText(/Story PROJ-2/)).toBeNull();
    });

    it('shows no at-risk list when all in-progress items have time logged', async () => {
      const { useQuery } = await import('@tanstack/react-query');

      const issues = [
        makeSprintIssue('PROJ-1', 'indeterminate', 3, 7200), // has time logged
        makeSprintIssue('PROJ-2', 'done', 5),
      ];

      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: issues,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>)
        .mockReturnValueOnce({
          data: null,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>);

      const { default: SprintHealthPanel } = await import('./SprintHealthPanel');
      renderWithQuery(
        <SprintHealthPanel
          jiraBaseUrl="https://jira.example.com"
          jiraToken="token"
          activeJiraProject="PROJ"
        />,
      );

      expect(screen.getByText(/0 at-risk/)).toBeDefined();
      // No at-risk list items
      expect(screen.queryByRole('list')).toBeNull();
    });
  });
});
