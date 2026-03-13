/**
 * SubtasksPanel tests — DASH-01
 *
 * Tests subtask display, orphan filtering, empty state,
 * display limit, and Jira deep-link click behavior.
 *
 * RED state: SubtasksPanel component does not exist yet.
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

// Mock settings store
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
  })),
}));

// Mock jira service
vi.mock('@/services/jira', () => ({
  fetchMyTasksHierarchy: vi.fn().mockResolvedValue({ issues: [], myIssueKeys: new Set() }),
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
}));

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// Helper: build a subtask issue fixture
function makeSubtask(key: string, parentKey: string, parentSummary: string, status = 'In Progress') {
  return {
    id: key,
    key,
    fields: {
      summary: `Subtask ${key} title`,
      status: { id: '3', name: status, statusCategory: { key: 'indeterminate' } },
      assignee: null,
      customfield_10016: null,
      issuetype: { name: 'Sub-task', subtask: true },
      parent: {
        key: parentKey,
        fields: { summary: parentSummary },
      },
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

describe('SubtasksPanel (DASH-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('subtask row display', () => {
    it.todo('renders subtask row with key, title, status badge, and parent story name');
  });

  describe('orphan subtask filtering', () => {
    it.todo('hides orphan subtasks whose parent.key is not in the sprint issue set');
  });

  describe('empty state', () => {
    it.todo('shows "No open subtasks in the current sprint" when no subtasks are present');
  });

  describe('display limit', () => {
    it.todo('limits display to 5 subtasks and shows "View all in My Tasks" link when more exist');
  });

  describe('Jira deep-link', () => {
    it.todo('clicking a subtask row calls window.open with the Jira browse URL');
  });
});
