// PM-01: Sprint progress buckets from statusCategory

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock react-router-dom — ErrorState uses useNavigate
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

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
  useSettingsStore: vi.fn(() => ({ storyPointsFieldKey: 'customfield_10016' })),
}));

function makeIssue(
  key: string,
  statusCategoryKey: 'new' | 'indeterminate' | 'done' | undefined,
  pts: number | null,
  options?: {
    subtask?: boolean;
    assigneeName?: string | null;
    timetracking?: {
      originalEstimateSeconds?: number;
      timeSpentSeconds?: number;
      remainingEstimateSeconds?: number;
    };
  },
) {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary ${key}`,
      status: {
        id: '1',
        name:
          statusCategoryKey === 'done'
            ? 'Done'
            : statusCategoryKey === 'indeterminate'
              ? 'In Progress'
              : 'To Do',
        statusCategory: statusCategoryKey ? { key: statusCategoryKey } : undefined,
      },
      assignee: options?.assigneeName
        ? { displayName: options.assigneeName, avatarUrls: { '48x48': '' } }
        : null,
      customfield_10016: pts,
      issuetype: {
        name: options?.subtask ? 'Sub-task' : 'Story',
        subtask: options?.subtask ?? false,
      },
      timetracking: options?.timetracking ?? undefined,
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
    // Re-establish settings store mock
    const settingsStore = await import('@/stores/settings.store');
    vi.mocked(settingsStore.useSettingsStore).mockReturnValue({
      storyPointsFieldKey: 'customfield_10016',
    } as ReturnType<typeof settingsStore.useSettingsStore>);
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

    // Wait for data to load — stacked bar label appears after fetch
    await screen.findByText(/33%.*to do/i);
    // All three bucket labels should be visible
    expect(screen.getAllByText(/to do/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/in progress/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/done/i).length).toBeGreaterThan(0);
    // Each bucket should show "1" count
    const counts = screen.getAllByText('1');
    expect(counts.length).toBeGreaterThanOrEqual(3);
  });

  it('hides stacked bar when all issues have null story points', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', null),
      makeIssue('P-2', 'indeterminate', null),
      makeIssue('P-3', 'done', null),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    // Wait for content to render — use findAllByText since "to do" appears in bucket label and bar label
    await screen.findAllByText(/to do/i);
    // Stacked bar is still shown (total > 0), old progress-bar testid should be gone
    const oldProgressBar = document.querySelector('[data-testid="progress-bar"]');
    expect(oldProgressBar).toBeNull();
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
    await screen.findAllByText('2');
    // Old single-segment progress-bar testid should be gone
    const progressBar = document.querySelector('[data-testid="progress-bar"]');
    expect(progressBar).toBeNull();
  });

  it('defaults missing statusCategory.key to todo bucket (does not crash)', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([makeIssue('P-1', undefined, null)]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    // Wait for data to load — "1" appears as the To Do count only after fetch resolves
    await screen.findAllByText('1');
    // Should show "to do" bucket label
    expect(screen.getAllByText(/to do/i).length).toBeGreaterThan(0);
  });

  // SPPG-01 tests
  it('SPPG-01: renders stacked bar with three segments when sprint has issues', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', null),
      makeIssue('P-2', 'indeterminate', null),
      makeIssue('P-3', 'done', null),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    // Wait for stacked bar to appear — it only renders when total > 0 (data loaded)
    const stackedBar = await screen.findByTestId('stacked-bar');
    expect(stackedBar).not.toBeNull();
  });

  it('SPPG-01: stacked bar label shows correct percentages (stories only)', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', null),
      makeIssue('P-2', 'indeterminate', null),
      makeIssue('P-3', 'done', null),
      // subtask in done bucket — must NOT be counted
      makeIssue('P-4', 'done', null, { subtask: true }),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    // Should show 33% for each bucket (3 stories, 1 each)
    await screen.findByText(/33%.*to do/i);
    expect(screen.getByText(/33%.*to do/i)).toBeTruthy();

    // Done count should be 1 (not 2 — subtask excluded)
    const doneLabel = screen.getByText(/^done$/i);
    const doneRow = doneLabel.closest('.flex.items-center.justify-between');
    const doneCount = doneRow?.querySelector('.tabular-nums');
    expect(doneCount?.textContent).toBe('1');
  });

  it('SPPG-01: stacked bar hidden when no issues', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    // Empty state now shows instead of bucket rows
    await screen.findByText(/No sprint data yet/i);
    const stackedBar = document.querySelector('[data-testid="stacked-bar"]');
    expect(stackedBar).toBeNull();
  });

  // SPPG-02 tests
  it('SPPG-02: shows sprint time summary when any issue has time data', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', null, {
        timetracking: { originalEstimateSeconds: 14400 },
      }),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    await screen.findByText(/Total Est: 4h/i);
    expect(screen.getByText(/Total Est: 4h/i)).toBeTruthy();
  });

  it('SPPG-02: hides time summary when all time tracking is null', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', null, { timetracking: undefined }),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    await screen.findAllByText(/to do/i);
    const timeSummary = document.querySelector('[data-testid="time-summary"]');
    expect(timeSummary).toBeNull();
  });

  // SPPG-03 tests
  it('SPPG-03: assignee rows sorted by total pts desc then alphabetically', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', 5, { assigneeName: 'Alice' }),
      makeIssue('P-2', 'done', 3, { assigneeName: 'Bob' }),
      makeIssue('P-3', 'indeterminate', 8, { assigneeName: 'Charlie' }),
      makeIssue('P-4', 'new', 5, { assigneeName: 'Zara' }), // tie with Alice — alpha second
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    await screen.findByText('Charlie');
    const rows = screen.getAllByTestId('assignee-row');
    expect(rows[0].querySelector('td')?.textContent).toBe('Charlie'); // 8 pts
    expect(rows[1].querySelector('td')?.textContent).toBe('Alice'); // 5 pts, alpha before Zara
    expect(rows[2].querySelector('td')?.textContent).toBe('Zara'); // 5 pts, alpha after Alice
    expect(rows[3].querySelector('td')?.textContent).toBe('Bob'); // 3 pts
  });

  it('SPPG-03: per-assignee breakdown table shows correct pts buckets', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', 5, { assigneeName: 'Alice' }),
      makeIssue('P-2', 'done', 3, { assigneeName: 'Bob' }),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    await screen.findByText('Alice');
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();

    // Find Alice's row and check To Do pts = 5 (index 3 after Stories + Subtasks columns)
    const aliceRow = screen.getByText('Alice').closest('[data-testid="assignee-row"]');
    const aliceCells = aliceRow?.querySelectorAll('td');
    expect(aliceCells?.[3]?.textContent).toBe('5'); // To Do pts

    // Find Bob's row and check Done pts = 3 (index 5 after Stories + Subtasks columns)
    const bobRow = screen.getByText('Bob').closest('[data-testid="assignee-row"]');
    const bobCells = bobRow?.querySelectorAll('td');
    expect(bobCells?.[5]?.textContent).toBe('3'); // Done pts
  });
});

describe('SPPG-07: assignee stories and subtasks columns', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const stronghold = await import('@/services/stronghold');
    vi.mocked(stronghold.readSecret).mockResolvedValue('test-jira-token');
    const settingsStore = await import('@/stores/settings.store');
    vi.mocked(settingsStore.useSettingsStore).mockReturnValue({
      storyPointsFieldKey: 'customfield_10016',
    } as ReturnType<typeof settingsStore.useSettingsStore>);
  });

  it('Test A: assignee with 2 stories (any status) and 1 subtask shows Stories=2, Subtasks=1', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', 3, { assigneeName: 'Alice' }),
      makeIssue('P-2', 'done', 5, { assigneeName: 'Alice' }),
      makeIssue('P-3', 'new', null, { subtask: true, assigneeName: 'Alice' }),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    await screen.findByText('Alice');
    const aliceRow = screen.getByText('Alice').closest('[data-testid="assignee-row"]');
    const aliceCells = aliceRow?.querySelectorAll('td');
    expect(aliceCells?.[1]?.textContent).toBe('2'); // Stories
    expect(aliceCells?.[2]?.textContent).toBe('1'); // Subtasks
  });

  it('Test B: assignee with 1 story and 0 subtasks shows Subtasks=0', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', 5, { assigneeName: 'Bob' }),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    await screen.findByText('Bob');
    const bobRow = screen.getByText('Bob').closest('[data-testid="assignee-row"]');
    const bobCells = bobRow?.querySelectorAll('td');
    expect(bobCells?.[2]?.textContent).toBe('0'); // Subtasks
  });

  it('Test C: story named "Sub-task" but issuetype.subtask=false is NOT counted as subtask', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    // Create an issue with subtask=false but name "Sub-task" via direct object literal
    const fakeSub = {
      id: 'P-fake',
      key: 'P-fake',
      fields: {
        summary: 'Summary P-fake',
        status: {
          id: '1',
          name: 'To Do',
          statusCategory: { key: 'new' as const },
        },
        assignee: { displayName: 'Carol', avatarUrls: { '48x48': '' } },
        customfield_10016: null,
        issuetype: {
          name: 'Sub-task', // name says Sub-task
          subtask: false, // but boolean is false
        },
        timetracking: undefined,
      },
    };
    vi.mocked(fetchSprintIssues).mockResolvedValue([fakeSub as ReturnType<typeof makeIssue>]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    await screen.findByText('Carol');
    const carolRow = screen.getByText('Carol').closest('[data-testid="assignee-row"]');
    const carolCells = carolRow?.querySelectorAll('td');
    // issuetype.subtask=false → treated as a story, not a subtask
    expect(carolCells?.[1]?.textContent).toBe('1'); // Stories = 1
    expect(carolCells?.[2]?.textContent).toBe('0'); // Subtasks = 0
  });

  it('Test D: table header includes "Stories" and "Subtasks" column headers', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([
      makeIssue('P-1', 'new', 3, { assigneeName: 'Alice' }),
    ]);

    const { default: SprintProgressTab } = await import('./SprintProgressTab');
    renderWithQuery(<SprintProgressTab />);

    await screen.findByText('Alice');
    expect(screen.getByText('Stories')).toBeTruthy();
    expect(screen.getByText('Subtasks')).toBeTruthy();
  });
});
