/**
 * DashboardInProgressCard tests — DASH-03
 *
 * Tests:
 * 1. Filter logic (happy path) — subtask + indeterminate + assignee match
 * 2. Cap at 3 + overflow caption
 * 3. Click navigation to /issue/:key
 * 4. Empty state copy when no matching subtasks
 * 5. No readSecret / no useAuthStore access
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Top-of-file mocks

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false, isError: false }),
    useQueryClient: vi.fn().mockReturnValue({ getQueryData: vi.fn() }),
  };
});

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  })),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
  })),
}));

vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
  fetchActiveSprint: vi.fn().mockResolvedValue(null),
  fetchFixVersions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(() => mockNavigate),
  };
});

// Fixture builder
function makeSprintIssue(
  key: string,
  statusCategoryKey: 'done' | 'indeterminate' | 'new',
  isSubtask = false,
  displayName: string | null = null,
  storyPoints: number | null = null,
) {
  return {
    id: key,
    key,
    fields: {
      summary: `Sub-task summary ${key.split('-')[1] ?? '1'}`,
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
      assignee: displayName ? { displayName, avatarUrls: {} } : null,
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

// Default props used across all tests
const defaultProps = {
  jiraBaseUrl: 'https://jira.example.com',
  jiraToken: 'token',
  activeJiraProject: 'PROJ',
  jiraUserDisplayName: 'Alice Doe',
  storyPointsFieldKey: 'customfield_10016',
};

describe('DashboardInProgressCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it('test 1: filter logic — renders only matching subtask+indeterminate+assignee rows', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    // 5 issues:
    // (a) subtask + indeterminate + Alice Doe → MATCH
    // (b) subtask + indeterminate + Alice Doe → MATCH
    // (c) story (not subtask) + indeterminate + Alice Doe → NO MATCH
    // (d) subtask + done + Alice Doe → NO MATCH
    // (e) subtask + indeterminate + Bob Smith → NO MATCH
    const issues = [
      makeSprintIssue('PROJ-1', 'indeterminate', true, 'Alice Doe'),   // a: match
      makeSprintIssue('PROJ-2', 'indeterminate', true, 'Alice Doe'),   // b: match
      makeSprintIssue('PROJ-3', 'indeterminate', false, 'Alice Doe'),  // c: not subtask
      makeSprintIssue('PROJ-4', 'done', true, 'Alice Doe'),            // d: done status
      makeSprintIssue('PROJ-5', 'indeterminate', true, 'Bob Smith'),   // e: wrong assignee
    ];

    vi.mocked(useQuery).mockReturnValue({
      data: issues,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    const { default: DashboardInProgressCard } = await import('./DashboardInProgressCard');
    renderWithQuery(<DashboardInProgressCard {...defaultProps} />);

    // PROJ-1 and PROJ-2 should be in the DOM
    expect(screen.getByText('PROJ-1')).toBeDefined();
    expect(screen.getByText('PROJ-2')).toBeDefined();
    // PROJ-3, PROJ-4, PROJ-5 should NOT be in the DOM as subtask rows
    expect(screen.queryByText('PROJ-3')).toBeNull();
    expect(screen.queryByText('PROJ-4')).toBeNull();
    expect(screen.queryByText('PROJ-5')).toBeNull();
  });

  it('test 2: cap at 3 + overflow caption — shows 3 rows and "and 2 more" text', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    // 5 matching subtasks
    const issues = [
      makeSprintIssue('PROJ-1', 'indeterminate', true, 'Alice Doe'),
      makeSprintIssue('PROJ-2', 'indeterminate', true, 'Alice Doe'),
      makeSprintIssue('PROJ-3', 'indeterminate', true, 'Alice Doe'),
      makeSprintIssue('PROJ-4', 'indeterminate', true, 'Alice Doe'),
      makeSprintIssue('PROJ-5', 'indeterminate', true, 'Alice Doe'),
    ];

    vi.mocked(useQuery).mockReturnValue({
      data: issues,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    const { default: DashboardInProgressCard } = await import('./DashboardInProgressCard');
    renderWithQuery(<DashboardInProgressCard {...defaultProps} />);

    // Exactly 3 keys rendered (PROJ-1, PROJ-2, PROJ-3)
    expect(screen.getByText('PROJ-1')).toBeDefined();
    expect(screen.getByText('PROJ-2')).toBeDefined();
    expect(screen.getByText('PROJ-3')).toBeDefined();
    // PROJ-4 and PROJ-5 are in overflow, not rendered as rows
    expect(screen.queryByText('PROJ-4')).toBeNull();
    expect(screen.queryByText('PROJ-5')).toBeNull();

    // Overflow caption appears as plain text
    expect(screen.getByText('and 2 more')).toBeDefined();

    // The overflow caption is NOT inside a button or anchor
    const caption = screen.getByText('and 2 more');
    expect(caption.closest('button')).toBeNull();
    expect(caption.closest('a')).toBeNull();
  });

  it('test 3: click navigation — clicking a row calls navigate with /issue/:key', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const issues = [
      makeSprintIssue('PROJ-101', 'indeterminate', true, 'Alice Doe'),
    ];

    vi.mocked(useQuery).mockReturnValue({
      data: issues,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    const { default: DashboardInProgressCard } = await import('./DashboardInProgressCard');
    renderWithQuery(<DashboardInProgressCard {...defaultProps} />);

    // Click the row button
    const rowButton = screen.getByRole('button', { name: /PROJ-101/ });
    await userEvent.click(rowButton);

    expect(mockNavigate).toHaveBeenCalledWith('/issue/PROJ-101');
  });

  it('test 4: empty state — shows "No subtasks in progress — nice work!" when no matches', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    const { default: DashboardInProgressCard } = await import('./DashboardInProgressCard');
    renderWithQuery(<DashboardInProgressCard {...defaultProps} />);

    expect(screen.getByText('No subtasks in progress — nice work!')).toBeDefined();
  });

  it('test 5: no readSecret / no useAuthStore — component does not call stronghold or auth store', async () => {
    const { useQuery } = await import('@tanstack/react-query');
    const { readSecret } = await import('@/services/stronghold');
    const { useAuthStore } = await import('@/stores/auth.store');

    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    const { default: DashboardInProgressCard } = await import('./DashboardInProgressCard');
    renderWithQuery(<DashboardInProgressCard {...defaultProps} />);

    expect(readSecret).not.toHaveBeenCalled();
    expect(useAuthStore).not.toHaveBeenCalled();
  });
});
