/**
 * MyIssuesCard.test.tsx — Phase 86 D-03/D-05
 *
 * Tests for MyIssuesCard — personal sprint progress with segmented bar.
 * Uses warm-cache seed via queryClient.setQueryData (same pattern as SprintHealthSection.test.tsx).
 *
 * Guards:
 * - D-03: toDo + inProgress + done === total for any fixture
 * - D-05: 0 assigned issues → EmptyState "No issues assigned" (never an ErrorState)
 * - Render: big "{done}" number and "of {total} done" annotation
 * - Render: role="region" accessibility
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import { filterNonSubtasks } from './dashboardMetrics';

// Mock jira service — MyIssuesCard uses useQuery, not direct calls in tests
vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
}));

const SP_KEY = 'customfield_10016';
const SPRINT_BOARD_KEY = ['jira-issues', 'sprint-board', 'PROJ', SP_KEY];

/**
 * Minimal JiraIssue factory — adapted from SprintHealthSection.test.tsx pattern.
 */
function makeIssue(overrides: {
  subtask: boolean;
  assignee: string | null;
  statusCategory: 'new' | 'indeterminate' | 'done';
}): JiraIssue {
  return {
    id: `${Math.random()}`,
    key: 'TEST-1',
    fields: {
      summary: 'Test issue',
      status: {
        id: '1',
        name: overrides.statusCategory === 'done' ? 'Done' : 'In Progress',
        statusCategory: { key: overrides.statusCategory },
      },
      assignee: overrides.assignee ? { displayName: overrides.assignee } : null,
      issuetype: {
        name: overrides.subtask ? 'Sub-task' : 'Story',
        subtask: overrides.subtask,
      },
      duedate: null,
      [SP_KEY]: 3,
      timetracking: { timeSpentSeconds: 0 },
    },
  } as unknown as JiraIssue;
}

/**
 * Warm-cache seed pattern (SprintHealthSection.test.tsx lines 69–95).
 */
function renderWithQuery(
  ui: React.ReactElement,
  { sprintIssues }: { sprintIssues?: JiraIssue[] } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  // Pre-seed the sprint-board cache (warm cache read)
  if (sprintIssues !== undefined) {
    queryClient.setQueryData(SPRINT_BOARD_KEY, sprintIssues);
  }

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

async function importComponent() {
  const { default: MyIssuesCard } = await import('./MyIssuesCard');
  return MyIssuesCard;
}

const defaultProps = {
  jiraBaseUrl: 'https://jira.example.com',
  jiraToken: 'test-token',
  activeJiraProject: 'PROJ',
  storyPointsFieldKey: SP_KEY,
  jiraUserDisplayName: 'Alice',
};

describe('MyIssuesCard — D-03 sum invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('D-03: toDo + inProgress + done === total for any mixed fixture (pure derivation)', () => {
    // Pure unit test on the derivation logic — no render needed
    const issues: JiraIssue[] = [
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'new' }),
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'new' }),
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'indeterminate' }),
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'done' }),
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'done' }),
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'done' }),
      // Subtasks should be excluded
      makeIssue({ subtask: true, assignee: 'Alice', statusCategory: 'done' }),
      // Other user's issue — should be excluded
      makeIssue({ subtask: false, assignee: 'Bob', statusCategory: 'new' }),
    ];

    const myNonSubtasks = filterNonSubtasks(issues).filter(
      (i) => i.fields.assignee?.displayName === 'Alice',
    );

    const toDo = myNonSubtasks.filter((i) => i.fields.status.statusCategory?.key === 'new').length;
    const inProgress = myNonSubtasks.filter(
      (i) => i.fields.status.statusCategory?.key === 'indeterminate',
    ).length;
    const done = myNonSubtasks.filter((i) => i.fields.status.statusCategory?.key === 'done').length;

    // D-03 invariant: segments sum to total
    expect(toDo + inProgress + done).toBe(myNonSubtasks.length);
    // Verify exact counts from the fixture
    expect(toDo).toBe(2);
    expect(inProgress).toBe(1);
    expect(done).toBe(3);
    expect(myNonSubtasks.length).toBe(6);
  });

  it('D-03: invariant holds when all issues belong to one category', () => {
    const issues: JiraIssue[] = [
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'done' }),
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'done' }),
    ];

    const myNonSubtasks = filterNonSubtasks(issues).filter(
      (i) => i.fields.assignee?.displayName === 'Alice',
    );

    const toDo = myNonSubtasks.filter((i) => i.fields.status.statusCategory?.key === 'new').length;
    const inProgress = myNonSubtasks.filter(
      (i) => i.fields.status.statusCategory?.key === 'indeterminate',
    ).length;
    const done = myNonSubtasks.filter((i) => i.fields.status.statusCategory?.key === 'done').length;

    expect(toDo + inProgress + done).toBe(myNonSubtasks.length);
  });
});

describe('MyIssuesCard — D-05 empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('D-05: renders "No issues assigned" empty state when no issues match my displayName', async () => {
    const MyIssuesCard = await importComponent();
    // Issue assigned to a DIFFERENT user — myNonSubtasks will be empty
    const issues = [makeIssue({ subtask: false, assignee: 'Other User', statusCategory: 'done' })];

    renderWithQuery(<MyIssuesCard {...defaultProps} />, { sprintIssues: issues });

    expect(screen.getByText('No issues assigned')).toBeTruthy();
  });

  it('D-05: empty state is NEVER an error when 0 issues assigned (not an ErrorState)', async () => {
    const MyIssuesCard = await importComponent();
    const issues = [makeIssue({ subtask: false, assignee: 'Other User', statusCategory: 'done' })];

    renderWithQuery(<MyIssuesCard {...defaultProps} />, { sprintIssues: issues });

    // Empty state heading present
    expect(screen.getByText('No issues assigned')).toBeTruthy();
    // ErrorState uses role="alert" — must NOT be present
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('D-05: renders empty state subtitle copy', async () => {
    const MyIssuesCard = await importComponent();

    renderWithQuery(<MyIssuesCard {...defaultProps} />, { sprintIssues: [] });

    expect(screen.getByText('You have no issues assigned in the current sprint.')).toBeTruthy();
  });
});

describe('MyIssuesCard — data rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders big done number and "of {total} done" annotation from warm cache', async () => {
    const MyIssuesCard = await importComponent();
    const issues = [
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'done' }),
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'done' }),
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'new' }),
    ];

    renderWithQuery(<MyIssuesCard {...defaultProps} />, { sprintIssues: issues });

    // Big number "2"
    expect(screen.getByText('2')).toBeTruthy();
    // "of 3 done" annotation
    expect(screen.getByText(/of 3 done/)).toBeTruthy();
  });

  it('renders segmented bar with role="img" and correct aria-label', async () => {
    const MyIssuesCard = await importComponent();
    const issues = [
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'new' }),
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'indeterminate' }),
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'done' }),
    ];

    renderWithQuery(<MyIssuesCard {...defaultProps} />, { sprintIssues: issues });

    const bar = screen.getByRole('img');
    expect(bar).toBeTruthy();
    const label = bar.getAttribute('aria-label') ?? '';
    expect(label).toContain('to do');
    expect(label).toContain('in progress');
    expect(label).toContain('done');
  });

  it('renders legend items for all three categories', async () => {
    const MyIssuesCard = await importComponent();
    const issues = [
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'new' }),
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'done' }),
    ];

    renderWithQuery(<MyIssuesCard {...defaultProps} />, { sprintIssues: issues });

    expect(screen.getByText(/To Do/)).toBeTruthy();
    expect(screen.getByText(/In Progress/)).toBeTruthy();
    expect(screen.getByText(/Done/)).toBeTruthy();
  });

  it('excludes subtasks from counts', async () => {
    const MyIssuesCard = await importComponent();
    const issues = [
      makeIssue({ subtask: false, assignee: 'Alice', statusCategory: 'done' }),
      // Subtask — must NOT be counted
      makeIssue({ subtask: true, assignee: 'Alice', statusCategory: 'done' }),
    ];

    renderWithQuery(<MyIssuesCard {...defaultProps} />, { sprintIssues: issues });

    // total=1 (1 non-subtask), done=1 → "1 of 1 done"
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText(/of 1 done/)).toBeTruthy();
  });
});

describe('MyIssuesCard — region accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has role="region" with aria-label="My issues this sprint"', async () => {
    const MyIssuesCard = await importComponent();

    renderWithQuery(<MyIssuesCard {...defaultProps} />, { sprintIssues: [] });

    const region = screen.getByRole('region', { name: /my issues this sprint/i });
    expect(region).toBeTruthy();
  });
});
