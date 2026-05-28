/**
 * SubtasksPanel tests — DASH-01
 *
 * Tests subtask display, orphan filtering, empty state,
 * display limit, and Jira deep-link click behavior.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// We keep the actual react-query but mock useQuery to control data
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useQueryClient: vi.fn().mockReturnValue({ getQueryData: vi.fn() }),
  };
});

// Mock auth store — SubtasksPanel receives props, auth store not used inside it
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

// Mock Tauri opener — reject so window.open fallback is exercised
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockRejectedValue(new Error('tauri unavailable')),
}));

import { useQuery } from '@tanstack/react-query';
import SubtasksPanel from './SubtasksPanel';

const mockedUseQuery = vi.mocked(useQuery);

// Helper: build a subtask issue fixture
function makeSubtask(
  key: string,
  parentKey: string,
  parentSummary: string,
  status = 'In Progress',
) {
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
        id: parentKey,
        key: parentKey,
        fields: { summary: parentSummary },
      },
      timetracking: { timeSpentSeconds: 0 },
    },
  };
}

// Helper: build a sprint-board issue fixture (parent story)
function makeStory(key: string) {
  return {
    id: key,
    key,
    fields: {
      summary: `Story ${key}`,
      status: { id: '1', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      assignee: null,
      customfield_10016: 3,
      issuetype: { name: 'Story', subtask: false },
    },
  };
}

const DEFAULT_PROPS = {
  jiraBaseUrl: 'https://jira.example.com',
  jiraToken: 'test-jira-token',
  activeJiraProject: 'PROJ',
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('SubtasksPanel (DASH-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: both queries return empty
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);
  });

  describe('subtask row display', () => {
    it('renders subtask row with key, title, status badge, and parent story name', () => {
      const subtask = makeSubtask('PROJ-10', 'PROJ-1', 'Parent Story Name');
      // First useQuery call = my-tasks, second = sprint-board
      mockedUseQuery
        .mockReturnValueOnce({
          data: { issues: [subtask], myIssueKeys: new Set(['PROJ-10']) },
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>)
        .mockReturnValueOnce({
          data: [makeStory('PROJ-1')],
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>);

      renderWithQuery(<SubtasksPanel {...DEFAULT_PROPS} />);

      expect(screen.getByText('PROJ-10')).toBeInTheDocument();
      expect(screen.getByText('Subtask PROJ-10 title')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText(/Parent Story Name/)).toBeInTheDocument();
    });
  });

  describe('orphan subtask filtering', () => {
    it('hides orphan subtasks whose parent.key is not in the sprint issue set', () => {
      // Subtask whose parent is NOT in the sprint board
      const orphan = makeSubtask('PROJ-20', 'PROJ-999', 'Old Story');
      const validSubtask = makeSubtask('PROJ-21', 'PROJ-1', 'Current Story');

      mockedUseQuery
        .mockReturnValueOnce({
          data: {
            issues: [orphan, validSubtask],
            myIssueKeys: new Set(['PROJ-20', 'PROJ-21']),
          },
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>)
        .mockReturnValueOnce({
          data: [makeStory('PROJ-1')], // Only PROJ-1 is in sprint
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>);

      renderWithQuery(<SubtasksPanel {...DEFAULT_PROPS} />);

      // Valid subtask should appear
      expect(screen.getByText('PROJ-21')).toBeInTheDocument();
      // Orphan should NOT appear
      expect(screen.queryByText('PROJ-20')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows "No open subtasks in the current sprint" when no subtasks are present', () => {
      mockedUseQuery
        .mockReturnValueOnce({
          data: { issues: [], myIssueKeys: new Set() },
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>)
        .mockReturnValueOnce({
          data: { issues: [] },
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>);

      renderWithQuery(<SubtasksPanel {...DEFAULT_PROPS} />);

      expect(screen.getByText('No open subtasks in the current sprint')).toBeInTheDocument();
    });
  });

  describe('display limit', () => {
    it('limits display to 5 subtasks when more exist', () => {
      // Create 7 subtasks all with parent PROJ-1 (which is in sprint)
      const subtasks = Array.from({ length: 7 }, (_, i) =>
        makeSubtask(`PROJ-${30 + i}`, 'PROJ-1', 'Parent Story'),
      );
      const myKeys = new Set(subtasks.map((s) => s.key));

      mockedUseQuery
        .mockReturnValueOnce({
          data: { issues: subtasks, myIssueKeys: myKeys },
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>)
        .mockReturnValueOnce({
          data: [makeStory('PROJ-1')],
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>);

      renderWithQuery(<SubtasksPanel {...DEFAULT_PROPS} />);

      // Only 5 subtask keys should appear (PROJ-30 through PROJ-34)
      expect(screen.getByText('PROJ-30')).toBeInTheDocument();
      expect(screen.getByText('PROJ-34')).toBeInTheDocument();
      expect(screen.queryByText('PROJ-35')).not.toBeInTheDocument();
    });
  });

  describe('Jira deep-link', () => {
    it('clicking a subtask row calls window.open with the Jira browse URL', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const subtask = makeSubtask('PROJ-40', 'PROJ-1', 'Parent Story');

      mockedUseQuery
        .mockReturnValueOnce({
          data: { issues: [subtask], myIssueKeys: new Set(['PROJ-40']) },
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>)
        .mockReturnValueOnce({
          data: [makeStory('PROJ-1')],
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>);

      renderWithQuery(<SubtasksPanel {...DEFAULT_PROPS} />);

      const rowButton = screen.getByText('PROJ-40').closest('button') as HTMLButtonElement;
      expect(rowButton).not.toBeNull();
      await userEvent.click(rowButton);

      expect(openSpy).toHaveBeenCalledWith(
        'https://jira.example.com/browse/PROJ-40',
        '_blank',
        'noopener,noreferrer',
      );
      openSpy.mockRestore();
    });
  });
});
