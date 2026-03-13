/**
 * SprintHealthPanel tests — DASH-03
 *
 * Tests % points done computation, days-left display,
 * graceful hiding when endDate is absent, at-risk items list,
 * and no-at-risk state.
 *
 * RED state: SprintHealthPanel component does not exist yet.
 * These tests will fail at import resolution — that is expected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

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
        name: statusCategoryKey === 'done' ? 'Done' : statusCategoryKey === 'indeterminate' ? 'In Progress' : 'To Do',
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
    it.todo('shows correct "% done" computed from done-points / total-points');
    it.todo('shows 0% done when sprint has no story points (guard: no division by zero)');
  });

  describe('days remaining', () => {
    it.todo('shows "N days left" when activeSprint.endDate is present');
    it.todo('hides "days left" segment gracefully when activeSprint is null or endDate is absent');
  });

  describe('at-risk items', () => {
    it.todo('lists at-risk items (in-progress stories with timeSpentSeconds == 0) by title below summary');
    it.todo('shows no at-risk list when all in-progress items have time logged');
  });
});
