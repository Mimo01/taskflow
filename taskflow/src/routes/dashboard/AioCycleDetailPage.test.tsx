import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    storyPointsFieldKey: 'customfield_10016',
  }),
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
  }),
}));
vi.mock('@/services/aio', () => ({
  fetchAioCycles: vi.fn(),
  fetchAioCycleTestCasesWithRuns: vi.fn(),
  fetchAioCycleDetail: vi.fn(),
  fetchAioCycleSummaries: vi.fn(),
  fetchAioCyclesWithDetail: vi.fn(),
}));
// Mock the cycles module so initializeAioStatusMap can populate the runtime map in tests
vi.mock('@/services/aio/cycles', () => ({
  fetchAioProjectConfig: vi.fn().mockResolvedValue([
    { ID: 51, statusType: 'NOT_RUN', name: 'Not Run', color: '#CCCCCC' },
    { ID: 52, statusType: 'IN_PROGRESS', name: 'In Progress', color: '#0000FF' },
    { ID: 53, statusType: 'PASSED', name: 'Pass', color: '#00FF00' },
    { ID: 54, statusType: 'FAILED', name: 'Fail', color: '#FF0000' },
    { ID: 55, statusType: 'BLOCKED', name: 'Blocked', color: '#FFA500' },
    { ID: 901, statusType: 'PASSED', name: 'N/A', color: '#00FF00' },
  ]),
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('fake-token'),
}));
vi.mock('@/services/jira', () => ({
  fetchJiraIssueByKey: vi.fn(),
}));
vi.mock('@/services/jira/projects', () => ({
  fetchJiraProjectNumericId: vi.fn(),
}));
vi.mock('@/services/jira/users', () => ({
  fetchJiraUserByUsername: vi.fn().mockResolvedValue(null),
}));

let mockPinnedKeys: string[] = [];
const mockTogglePin = vi.fn();
const mockSetPinnedCycleMeta = vi.fn();
const mockRemovePin = vi.fn();
const mockClearCycleMeta = vi.fn();

vi.mock('@/stores/pinned-tabs.store', () => ({
  usePinnedTabsStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      pinnedKeys: mockPinnedKeys,
      togglePin: mockTogglePin,
      setPinnedCycleMeta: mockSetPinnedCycleMeta,
      removePin: mockRemovePin,
      clearCycleMeta: mockClearCycleMeta,
    };
    return selector ? selector(state) : state;
  },
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockCycle = {
  key: 'PROJ-CY-2',
  name: 'Sprint 2',
  status: 'IN_PROGRESS',
  projectKey: 'PROJ',
  // ID field from live detail response (P4 confirmed) — cast locally in component
  ID: 10134,
};

const mockSummary = [
  {
    ID: 10134,
    jiraProjectID: 10134,
    detail: null,
    summary: { totalTests: 3, testRunDistribution: { '901': 1, '54': 1, '51': 1 } },
  },
];

const mockRuns = [
  {
    id: 'run-1',
    status: 'PASS',
    testCaseKey: 'PROJ-TC-1',
    cycleKey: 'PROJ-CY-2',
    testCase: { title: 'Login test', updatedDate: '2024-01-01' },
    defects: [],
    jiraDefectIDs: [],
  },
  {
    id: 'run-2',
    status: 'FAIL',
    testCaseKey: 'PROJ-TC-2',
    cycleKey: 'PROJ-CY-2',
    testCase: { title: 'Checkout test', updatedDate: '2024-01-02' },
    defects: [],
    jiraDefectIDs: [186227],
  },
  {
    id: 'run-3',
    status: 'NOT_EXECUTED',
    testCaseKey: 'PROJ-TC-3',
    cycleKey: 'PROJ-CY-2',
    testCase: { title: 'Signup test', updatedDate: '2024-01-03' },
    defects: [],
    jiraDefectIDs: [],
  },
];

// Helper: set up default mocks for the happy path
async function setupDefaultMocks() {
  const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
    await import('@/services/aio');
  const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
  const { initializeAioStatusMap } = await import('@/lib/aioUtils');
  (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
  (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
  (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
  (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
  // Populate the module-level runtime AIO status map so normalizeStatusById resolves
  // testRunDistribution IDs correctly (CLEAN-07: map is no longer static).
  await initializeAioStatusMap('https://jira.example.com', 'fake-token', 10134);
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
        <Routes>
          <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Live import — will fail with "Cannot find module" until Wave 1 creates the component.
// This is the expected RED state for Wave 0.
import AioCycleDetailPage from './AioCycleDetailPage';

/** Text match outside the defect donut keys (which repeats status/priority labels). */
const inDefectList = (text: string) =>
  screen.getAllByText(text).find((el) => !el.closest('[data-testid="defect-donut-block"]'));

describe('AioCycleDetailPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockPinnedKeys = [];
    // Re-initialize the runtime AIO status map after vi.clearAllMocks() resets call counts.
    // The fetchAioProjectConfig mock is re-applied by the module-level vi.mock above, so
    // initializeAioStatusMap will still resolve correctly here.
    const { initializeAioStatusMap } = await import('@/lib/aioUtils');
    const { fetchAioProjectConfig } = await import('@/services/aio/cycles');
    vi.mocked(fetchAioProjectConfig).mockResolvedValue([
      { ID: 51, statusType: 'NOT_RUN', name: 'Not Run', color: '#CCCCCC' },
      { ID: 52, statusType: 'IN_PROGRESS', name: 'In Progress', color: '#0000FF' },
      { ID: 53, statusType: 'PASSED', name: 'Pass', color: '#00FF00' },
      { ID: 54, statusType: 'FAILED', name: 'Fail', color: '#FF0000' },
      { ID: 55, statusType: 'BLOCKED', name: 'Blocked', color: '#FFA500' },
      { ID: 901, statusType: 'PASSED', name: 'N/A', color: '#00FF00' },
    ]);
    await initializeAioStatusMap('https://jira.example.com', 'fake-token', 10134);
  });

  it('renders AioCycleDetailPage without crashing', async () => {
    await setupDefaultMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Sprint 2')).toBeDefined();
    });
  });

  describe('progress bar', () => {
    it('shows pass/fail/blocked/not-run counts from test runs', async () => {
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => {
        // pass / executed: 1 pass of 2 executed
        expect(screen.getByTestId('kpi-pass-rate').textContent).toMatch(/50%/);
        expect(screen.getByTestId('kpi-pass-rate').textContent).toMatch(/of executed/);
        expect(screen.getByTestId('kpi-unlinked')).toBeDefined();
        expect(screen.getByTestId('exec-donut').textContent).toMatch(/2\/3/);
        expect(screen.getByTestId('exec-donut').textContent).toMatch(/executed/);
        expect(screen.queryByTestId('cycle-progress-bar')).toBeNull();
      });
    });

    it('shows "No runs recorded" when runs array is empty', async () => {
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          ID: 10134,
          jiraProjectID: 10134,
          detail: null,
          summary: { totalTests: 0, testRunDistribution: {} },
        },
      ]);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('No runs recorded')).toBeDefined();
      });
    });

    it('percentages sum to 100 when all runs accounted for', async () => {
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      // 2 pass, 2 fail = 50% each
      const evenRuns = [
        {
          id: 'r1',
          status: 'PASS',
          testCaseKey: 'TC-1',
          cycleKey: 'PROJ-CY-2',
          defects: [],
          jiraDefectIDs: [],
        },
        {
          id: 'r2',
          status: 'PASS',
          testCaseKey: 'TC-2',
          cycleKey: 'PROJ-CY-2',
          defects: [],
          jiraDefectIDs: [],
        },
        {
          id: 'r3',
          status: 'FAIL',
          testCaseKey: 'TC-3',
          cycleKey: 'PROJ-CY-2',
          defects: [],
          jiraDefectIDs: [],
        },
        {
          id: 'r4',
          status: 'FAIL',
          testCaseKey: 'TC-4',
          cycleKey: 'PROJ-CY-2',
          defects: [],
          jiraDefectIDs: [],
        },
      ];
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(evenRuns);
      // Summary with 2 pass (901), 2 fail (54)
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          ID: 10134,
          jiraProjectID: 10134,
          detail: null,
          summary: { totalTests: 4, testRunDistribution: { '901': 2, '54': 2 } },
        },
      ]);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('kpi-pass-rate').textContent).toMatch(/50%/);
        expect(screen.getByTestId('kpi-unlinked').textContent).toMatch(/of 2 failing/);
        expect(screen.getByTestId('exec-donut').textContent).toMatch(/4\/4/);
      });
    });

    it('progress bar renders from cycle summary while runs are still loading', async () => {
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          ID: 10134,
          jiraProjectID: 10134,
          detail: null,
          summary: { totalTests: 3, testRunDistribution: { '53': 1, '901': 1, '51': 1 } },
        },
      ]);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      // runs query never resolves — simulates slow runs endpoint
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise(() => {}),
      );
      renderPage();
      // Progress bar must be visible even though runs never resolved
      await waitFor(() => {
        expect(screen.getByTestId('kpi-pass-rate')).toBeDefined();
        expect(screen.getByTestId('exec-donut')).toBeDefined();
      });
      // runs-table-skeleton should be present since runsQuery is still loading
      await waitFor(() => {
        expect(screen.getByTestId('runs-table-skeleton')).toBeDefined();
      });
    });

    it('falls back to runs-derived counts when summary query errors', async () => {
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
      renderPage();
      // Falls back to runs-derived counts: 1 pass, 1 fail, 1 not-run
      await waitFor(() => {
        expect(screen.getByTestId('kpi-pass-rate').textContent).toMatch(/50%/);
        expect(screen.getByTestId('kpi-unlinked').textContent).toMatch(/of 1 failing/);
        expect(screen.getByTestId('exec-donut').textContent).toMatch(/2\/3/);
      });
    });

    it('shows skeleton (not "No runs recorded") when jiraProjectIdQuery is still in-flight on fresh-cache navigation', async () => {
      // Regression: direct pinned-tab navigation with fresh cache leaves jiraProjectIdQuery
      // unresolved when cycleQuery resolves. With the old isLoading check, a disabled
      // summaryQuery returned isLoading=false (TQ v5), so showProgressSkeleton=false and
      // "No runs recorded" was rendered instead of a skeleton. The fix uses isPending.
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');

      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      // jiraProjectIdQuery never resolves — keeps aioGate=false, summaryQuery disabled
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise(() => {}),
      );
      // These would fire once aioGate opens, but since it stays closed they never run
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);

      renderPage();

      // Wait for cycleQuery to resolve (cycle name renders in header)
      await waitFor(() => {
        expect(screen.getByText('Sprint 2')).toBeDefined();
      });

      // Progress bar section: should NOT show "No runs recorded" while gate is closed
      expect(screen.queryByText('No runs recorded')).toBeNull();
    });

    it('initializes the AIO status map itself on direct pinned-tab navigation (all-Not-Run regression)', async () => {
      // Regression: on fresh-cache pinned-tab navigation the AioProjectOverviewPage never
      // mounts, so it never calls initializeAioStatusMap(). The detail page used to rely on
      // that side effect — leaving runtimeAioStatusMap empty, so normalizeStatusById resolved
      // every testRunDistribution ID to 'notRun' and the bar showed all test cases as Not Run.
      // The fix makes the detail page populate the map itself via its own query.
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      const { initializeAioStatusMap } = await import('@/lib/aioUtils');
      const { fetchAioProjectConfig } = await import('@/services/aio/cycles');

      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      // No runs (empty) so the summary distribution is the sole counts source — isolates the map.
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      // 53=PASSED, 54=FAILED, 51=NOT_RUN → expect 1 Pass / 1 Fail / 1 Not Run once map is populated.
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          ID: 10134,
          jiraProjectID: 10134,
          detail: null,
          summary: { totalTests: 3, testRunDistribution: { '53': 1, '54': 1, '51': 1 } },
        },
      ]);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);

      // Simulate the fresh-cache pinned path: empty the runtime map that beforeEach populated
      // (overview page never ran). One failing init clears it; the good mock remains for the
      // component's own status-map query to repopulate.
      vi.mocked(fetchAioProjectConfig).mockRejectedValueOnce(new Error('overview never mounted'));
      await initializeAioStatusMap('https://jira.example.com', 'fake-token', 10134);

      renderPage();

      // Without the component-side init every segment would be Not Run (0% pass). With the fix
      // the component populates the map and the distribution resolves to its true buckets.
      await waitFor(() => {
        expect(screen.getByTestId('kpi-pass-rate').textContent).toMatch(/50%/);
        expect(screen.getByTestId('exec-donut').textContent).toMatch(/2\/3/);
      });
    });
  });

  describe('executions toolbar', () => {
    it('All is selected by default with every run visible and counts on the chips', async () => {
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByText('Checkout test')).toBeDefined());
      expect(screen.getByRole('radiogroup', { name: 'Filter by status' })).toBeDefined();
      const all = screen.getByRole('radio', { name: 'All 3' });
      expect(all.getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('radio', { name: 'Pass 1' }).getAttribute('aria-checked')).toBe(
        'false',
      );
      expect(screen.getByRole('radio', { name: 'Fail 1' })).toBeDefined();
      expect(screen.getByRole('radio', { name: 'Blocked 0' })).toBeDefined();
      expect(screen.getByRole('radio', { name: 'Not run 1' })).toBeDefined();
      // In progress chip only appears when there are in-progress runs
      expect(screen.queryByRole('radio', { name: /In progress/ })).toBeNull();
      expect(screen.getByText('Login test')).toBeDefined();
      expect(screen.getByText('Checkout test')).toBeDefined();
      expect(screen.getByText('Signup test')).toBeDefined();
    });

    it('selecting Fail shows only FAIL rows', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByText('Checkout test')).toBeDefined());
      await user.click(screen.getByRole('radio', { name: 'Fail 1' }));
      await waitFor(() => {
        expect(screen.queryByText('Login test')).toBeNull();
        expect(screen.queryByText('Signup test')).toBeNull();
      });
      expect(screen.getByText('Checkout test')).toBeDefined();
      expect(screen.getByRole('radio', { name: 'Fail 1' }).getAttribute('aria-checked')).toBe(
        'true',
      );
      expect(screen.getByRole('radio', { name: 'All 3' }).getAttribute('aria-checked')).toBe(
        'false',
      );
    });

    it('arrow keys move the selection between chips', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByText('Checkout test')).toBeDefined());
      const all = screen.getByRole('radio', { name: 'All 3' });
      all.focus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('radio', { name: 'Pass 1' }).getAttribute('aria-checked')).toBe(
        'true',
      );
      await waitFor(() => {
        expect(screen.queryByText('Checkout test')).toBeNull();
      });
    });

    it('shows an In progress chip only when a run is in progress', async () => {
      const { fetchAioCycleTestCasesWithRuns } = await import('@/services/aio');
      await setupDefaultMocks();
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
        ...mockRuns,
        {
          id: 'run-4',
          status: 'IN_PROGRESS',
          testCaseKey: 'PROJ-TC-4',
          cycleKey: 'PROJ-CY-2',
          testCase: { title: 'Search test', updatedDate: '2024-01-04' },
          defects: [],
          jiraDefectIDs: [],
        },
      ]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: 'In progress 1' })).toBeDefined();
      });
    });

    it('search filters on test case key and on title, case-insensitively', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByText('Checkout test')).toBeDefined());
      const search = screen.getByLabelText('Search test cases');

      await user.type(search, 'proj-tc-3');
      await waitFor(() => {
        expect(screen.queryByText('Login test')).toBeNull();
        expect(screen.queryByText('Checkout test')).toBeNull();
      });
      expect(screen.getByText('Signup test')).toBeDefined();

      await user.clear(search);
      await user.type(search, 'CHECKOUT');
      await waitFor(() => expect(screen.queryByText('Signup test')).toBeNull());
      expect(screen.getByText('Checkout test')).toBeDefined();
    });

    it('shows "No runs match the selected filters" when the search matches nothing', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByText('Checkout test')).toBeDefined());
      await user.type(screen.getByLabelText('Search test cases'), 'zzz-nothing');
      await waitFor(() => {
        expect(screen.getByText(/No runs match the selected filters/)).toBeDefined();
      });
    });

    it('sort buttons cycle asc, desc, then back to server order', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByText('Checkout test')).toBeDefined());
      const order = () =>
        screen.getAllByTestId(/^run-row-/).map((r) => r.getAttribute('data-testid'));
      expect(order()).toEqual(['run-row-run-1', 'run-row-run-2', 'run-row-run-3']);

      await user.click(screen.getByTestId('executions-sort-key'));
      expect(screen.getByTestId('executions-sort-indicator-key')).toBeDefined();
      expect(order()).toEqual(['run-row-run-1', 'run-row-run-2', 'run-row-run-3']);

      await user.click(screen.getByTestId('executions-sort-key'));
      expect(order()).toEqual(['run-row-run-3', 'run-row-run-2', 'run-row-run-1']);

      await user.click(screen.getByTestId('executions-sort-key'));
      expect(screen.queryByTestId('executions-sort-indicator-key')).toBeNull();
      expect(order()).toEqual(['run-row-run-1', 'run-row-run-2', 'run-row-run-3']);
    });

    it('status sort puts failing runs first', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByText('Checkout test')).toBeDefined());
      await user.click(screen.getByTestId('executions-sort-status'));
      const rows = screen.getAllByTestId(/^run-row-/).map((r) => r.getAttribute('data-testid'));
      expect(rows[0]).toBe('run-row-run-2'); // FAIL
      expect(rows[rows.length - 1]).toBe('run-row-run-1'); // PASS
    });

    it('a row without a run id has no open button and is muted', async () => {
      const { fetchAioCycleTestCasesWithRuns } = await import('@/services/aio');
      await setupDefaultMocks();
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
        ...mockRuns,
        {
          id: '',
          status: 'NOT_EXECUTED',
          testCaseKey: 'PROJ-TC-9',
          cycleKey: 'PROJ-CY-2',
          testCase: { title: 'Never run test', updatedDate: '2024-01-09' },
          defects: [],
          jiraDefectIDs: [],
        },
      ]);
      renderPage();
      await waitFor(() => expect(screen.getByText('Never run test')).toBeDefined());
      expect(screen.getByRole('button', { name: /Open run for PROJ-TC-1/ })).toBeDefined();
      expect(screen.queryByRole('button', { name: /Open run for PROJ-TC-9/ })).toBeNull();
      expect(screen.getByTestId('run-row-').className).toContain('opacity-70');
    });
  });

  describe('header metadata', () => {
    const richCycle = {
      ...mockCycle,
      ownedByID: 'ext94772',
      folder: 'Checkout',
      startDate: new Date('2026-10-01T10:00:00').getTime(),
      endDate: new Date('2026-10-28T10:00:00').getTime(),
      updatedDate: Date.now() - 3 * 86_400_000,
      customFields: [
        { name: 'Device_Type', value: 'Web' },
        { name: 'Browser', value: 'Chrome, Firefox' },
      ],
    };

    it('renders owner, folder, dates, updated and custom fields', async () => {
      const { fetchAioCycleDetail } = await import('@/services/aio');
      const { fetchJiraUserByUsername } = await import('@/services/jira/users');
      await setupDefaultMocks();
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(richCycle);
      (fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mockResolvedValue({
        displayName: 'Olivia Owner',
        avatarUrls: { '48x48': '' },
      });
      renderPage();
      await waitFor(() => {
        expect(
          within(screen.getByTestId('cycle-meta-owner')).getByText('Olivia Owner'),
        ).toBeDefined();
      });
      expect(screen.getByTestId('cycle-meta-folder').textContent).toBe('Checkout');
      expect(screen.getByTestId('cycle-meta-dates').textContent).toMatch(/Oct/);
      expect(screen.getByTestId('cycle-meta-updated').textContent).toMatch(/^Updated /);
      const fields = screen.getAllByTestId('cycle-meta-field').map((f) => f.textContent);
      expect(fields).toEqual(['Device_Type:Web', 'Browser:Chrome, Firefox']);
    });

    it('shows Closed {date} instead of Updated for a closed cycle', async () => {
      const { fetchAioCycleDetail } = await import('@/services/aio');
      await setupDefaultMocks();
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...richCycle,
        status: 'Closed',
        closedDate: new Date('2026-10-09T10:00:00').getTime(),
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('cycle-meta-closed').textContent).toBe('Closed Oct 9');
      });
      expect(screen.queryByTestId('cycle-meta-updated')).toBeNull();
    });

    it('renders no owner element and no stray separator when the fields are absent', async () => {
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByText('Checkout test')).toBeDefined());
      expect(screen.queryByTestId('cycle-meta-owner')).toBeNull();
      expect(screen.queryByTestId('cycle-meta-folder')).toBeNull();
      expect(screen.queryByTestId('cycle-meta-dates')).toBeNull();
      expect(screen.queryByTestId('cycle-meta')?.textContent ?? '').not.toMatch(/^·|·$|··|—/);
    });
  });

  describe('KPI tiles', () => {
    it('renders the four tiles with sub-lines', async () => {
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByTestId('kpi-retest')).toBeDefined());
      expect(screen.getByTestId('kpi-pass-rate').textContent).toMatch(/Pass rate/);
      expect(screen.getByTestId('exec-donut').textContent).toMatch(/2\/3/);
      expect(screen.getByTestId('kpi-reruns')).toBeDefined();
      // run-2 FAIL has a linked defect, so nothing is failing without one
      expect(screen.getByTestId('kpi-unlinked').textContent).toMatch(/0of 1 failing/);
      // labels are user-facing copy: assert them so an icon/label mix-up can't slip through
      expect(screen.getByTestId('kpi-unlinked').textContent).toMatch(/Unlinked failures/);
      expect(screen.getByTestId('kpi-retest').textContent).toMatch(/Ready to retest/);
      expect(screen.getByTestId('kpi-reruns').textContent).toMatch(/Re-runs/);
    });

    it('Ready to retest counts failing cases whose linked defects are all Done', async () => {
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      await setupDefaultMocks();
      (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '186227',
        key: 'PROJ-1234',
        fields: {
          summary: 'Login broken',
          status: { name: 'Done', statusCategory: { key: 'done' } },
          issuetype: { name: 'Bug', subtask: false },
        },
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByTestId('kpi-retest').textContent).toMatch(/1of 1 failing/),
      );
    });
  });

  describe('Defects tab', () => {
    beforeEach(async () => {
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '186227',
        key: 'PROJ-1234',
        fields: {
          summary: 'Login broken',
          status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
          assignee: {
            displayName: 'Jane Doe',
            avatarUrls: { '48x48': 'https://example.com/jane.png' },
          },
          issuetype: { name: 'Bug', subtask: false },
        },
      });
    });

    it('AIOC-03: renders a defect row per unique defect key after clicking Defects tab', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => {
        // resolved Jira key rendered, not the raw numeric ID
        expect(screen.getByText('PROJ-1234')).toBeDefined();
        expect(screen.getByText('Login broken')).toBeDefined();
        expect(inDefectList('In Progress')).toBeDefined();
      });
    });

    it('AIOC-03: shows EmptyState when no defects', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      const runsNoDefects = mockRuns.map((r) => ({ ...r, defects: [], jiraDefectIDs: [] }));
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(runsNoDefects);
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      renderPage();
      await waitFor(() => expect(screen.getByText('Login test')).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => {
        expect(screen.getByText('No defects')).toBeDefined();
        expect(screen.getByText('No defects are linked to runs in this cycle.')).toBeDefined();
      });
    });

    it('AIOC-03: shows skeleton in title cell while fetchJiraIssueByKey is pending', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => {
        // defect key is '186227' (stringified jiraDefectID)
        expect(screen.getByText('186227')).toBeDefined();
        expect(screen.getByTestId('defect-title-loading-186227')).toBeDefined();
      });
    });

    it('AIOC-03: defect key links to /issue/:resolvedKey after issue resolves', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      // Wait for the resolved key to appear (not the raw numeric ID)
      await waitFor(() => expect(screen.getByText('PROJ-1234')).toBeDefined());
      expect(screen.getByText('PROJ-1234').closest('a')?.getAttribute('href')).toBe(
        '/issue/PROJ-1234',
      );
    });

    it('AIOC-03: triggered-by column lists test case keys from runs whose jiraDefectIDs contains the ID', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      const multiRuns = [
        ...mockRuns,
        {
          id: 'run-4',
          status: 'FAIL',
          testCaseKey: 'PROJ-TC-X',
          cycleKey: 'PROJ-CY-2',
          testCase: { title: 'Extra test', updatedDate: '2024-01-04' },
          defects: [],
          jiraDefectIDs: [186227],
        },
      ];
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(multiRuns);
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => {
        expect(screen.getByText(/PROJ-TC-2/)).toBeDefined();
        expect(screen.getByText(/PROJ-TC-X/)).toBeDefined();
      });
    });

    it('passes raw jiraDefectIDs (stringified) to DefectRow, not pre-resolved defects', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      // runs have jiraDefectIDs populated and defects: [] (post-Plan-02 service behaviour)
      const runsWithNumericDefects = [
        {
          id: 'run-1',
          status: 'FAIL',
          testCaseKey: 'PROJ-TC-1',
          cycleKey: 'PROJ-CY-2',
          testCase: { title: 'Login test', updatedDate: '2024-01-01' },
          defects: [],
          jiraDefectIDs: [186227],
        },
      ];
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(
        runsWithNumericDefects,
      );
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        key: 'PROJ-42',
        fields: { summary: 'x', status: { name: 'Open' } },
      });
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      // Wait for DefectRow to be rendered and fetchJiraIssueByKey to be called
      await waitFor(() => {
        expect(fetchJiraIssueByKey).toHaveBeenCalledWith(
          'https://jira.example.com',
          'fake-token',
          '186227',
        );
      });
    });

    it('summaryQuery enabled flag includes !tokenLoading — no queries fire while token is loading', async () => {
      // Mock readSecret to never resolve — keeps useAioCredentials in isLoading: true state
      const { readSecret } = await import('@/services/stronghold');
      (readSecret as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      renderPage();
      // Allow microtasks to flush — no query should fire while token is loading
      await new Promise((r) => setTimeout(r, 50));
      expect(fetchAioCycleSummaries).not.toHaveBeenCalled();
      expect(fetchJiraProjectNumericId).not.toHaveBeenCalled();
      expect(fetchAioCycleTestCasesWithRuns).not.toHaveBeenCalled();
      expect(fetchAioCycleDetail).not.toHaveBeenCalled();
      // Restore readSecret for subsequent tests in this describe block
      (readSecret as ReturnType<typeof vi.fn>).mockResolvedValue('fake-token');
    });

    it('Pitfall 5: fetchJiraIssueByKey called with correct args (stringified numeric ID)', async () => {
      const user = userEvent.setup();
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => {
        expect(fetchJiraIssueByKey).toHaveBeenCalledWith(
          'https://jira.example.com',
          'fake-token',
          '186227',
        );
      });
    });

    it('AIOC-03: renders resolved Jira key, colored status, and assignee from fetchJiraIssueByKey response', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));

      // Resolved key shown (not raw numeric ID)
      await waitFor(() => expect(screen.getByText('PROJ-1234')).toBeDefined());

      // Link points to resolved key
      expect(screen.getByText('PROJ-1234').closest('a')?.getAttribute('href')).toBe(
        '/issue/PROJ-1234',
      );

      // Status pill carries color class from statusPillClass('indeterminate')
      const statusEl = inDefectList('In Progress') as HTMLElement;
      expect(statusEl).toBeDefined();
      expect(statusEl.className).toContain('bg-blue-500/15');

      // Assignee name shown in defect row
      expect(screen.getByText('Jane Doe')).toBeDefined();
    });

    it('AIOC-03: falls back to numeric ID and em-dashes when fetchJiraIssueByKey returns null', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      // Null response — issue not found or unreachable
      (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));

      // Falls back to raw numeric ID (may appear in both key cell and title cell when issue is null)
      await waitFor(() => expect(screen.getAllByText('186227').length).toBeGreaterThan(0));

      // Falling back to the numeric id leaves the row non-interactive (nothing to open)
      expect(screen.queryByRole('button', { name: /^Open / })).toBeNull();
    });

    it('AIOC-03: Defects tab shows Reporter, Priority, Severity column headers', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => expect(screen.getByText('PROJ-1234')).toBeDefined());
      // All 8 column headers present
      for (const name of [
        'Key',
        'Title',
        'Status',
        'Assignee',
        'Reporter',
        'Priority',
        'Severity',
        'Triggered By',
      ]) {
        expect(screen.getAllByText(name).length).toBeGreaterThan(0);
      }
    });

    it('AIOC-03: renders reporter displayName, priority name, and severity value when populated', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '186227',
        key: 'PROJ-1234',
        fields: {
          summary: 'Login broken',
          status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
          assignee: { displayName: 'Jane Doe', avatarUrls: { '48x48': '' } },
          issuetype: { name: 'Bug', subtask: false },
          reporter: { displayName: 'Alice Reporter', avatarUrls: { '48x48': '' } },
          priority: { name: 'High' },
          customfield_13415: { value: 'Major' },
        },
      });
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => expect(screen.getByText('Alice Reporter')).toBeDefined());
      expect(inDefectList('High')).toBeDefined();
      expect(inDefectList('Major')).toBeDefined();
    });

    it('AIOC-03: renders em-dashes for Reporter, Priority, Severity when fields are null', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '186227',
        key: 'PROJ-1234',
        fields: {
          summary: 'Login broken',
          status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
          assignee: null,
          issuetype: { name: 'Bug', subtask: false },
          reporter: null,
          priority: null,
          customfield_13415: null,
        },
      });
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => expect(screen.getByText('PROJ-1234')).toBeDefined());
      // At least three em-dashes in the row (Reporter, Priority, Severity — plus possibly Assignee)
      const emDashes = screen.getAllByText('—');
      expect(emDashes.length).toBeGreaterThanOrEqual(3);
    });

    // Test A: loading state — row must NOT be interactive while issueQuery is loading
    it('AIOC-03-A: defect row is NOT interactive while issue is still loading', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      // Never-resolving promise — keeps issue in loading state
      (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));

      // Skeleton visible → still loading
      await waitFor(() => expect(screen.getByTestId('defect-title-loading-186227')).toBeDefined());

      // No overlay open-button while loading
      expect(screen.queryByRole('button', { name: /^Open / })).toBeNull();
      expect(screen.getByTestId('defect-row-186227').className).not.toContain('cursor-pointer');
    });

    // Test B: resolved + click — row navigates when clicked anywhere
    it('AIOC-03-B: clicking resolved defect row opens the peek preview via onOpenIssue', async () => {
      const user = userEvent.setup();
      const onOpenIssue = vi.fn();
      await setupDefaultMocks();
      render(
        <QueryClientProvider client={makeClient()}>
          <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
            <Routes>
              <Route element={<Outlet context={{ onOpenIssue }} />}>
                <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
              </Route>
              <Route
                path="/issue/:issueKey"
                element={<div data-testid="issue-detail-route">Issue Detail</div>}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));

      // Wait for issue to resolve
      await waitFor(() => expect(screen.getByText('PROJ-1234')).toBeDefined());

      // The full-row click target is an overlay button (sibling of the key link)
      const overlay = screen.getByRole('button', { name: 'Open PROJ-1234' });
      expect(overlay.className).toContain('cursor-pointer');
      // The row now opens the side peek preview instead of navigating.
      await user.click(overlay);

      expect(onOpenIssue).toHaveBeenCalledWith('PROJ-1234');
      // Row click does NOT navigate to the full issue route.
      expect(screen.queryByTestId('issue-detail-route')).toBeNull();
    });

    // Test C: resolved + keyboard — Enter and Space open the peek preview
    it('AIOC-03-C: Enter key on resolved defect row opens the peek preview via onOpenIssue', async () => {
      const onOpenIssue = vi.fn();
      await setupDefaultMocks();
      render(
        <QueryClientProvider client={makeClient()}>
          <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
            <Routes>
              <Route element={<Outlet context={{ onOpenIssue }} />}>
                <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => expect(screen.getByText('PROJ-1234')).toBeDefined());

      screen.getByRole('button', { name: 'Open PROJ-1234' }).focus();
      await user.keyboard('{Enter}');
      await waitFor(() => expect(onOpenIssue).toHaveBeenCalledWith('PROJ-1234'));
    });

    it('AIOC-03-C: Space key on resolved defect row opens the peek preview via onOpenIssue', async () => {
      const onOpenIssue = vi.fn();
      await setupDefaultMocks();
      render(
        <QueryClientProvider client={makeClient()}>
          <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
            <Routes>
              <Route element={<Outlet context={{ onOpenIssue }} />}>
                <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => expect(screen.getByText('PROJ-1234')).toBeDefined());

      screen.getByRole('button', { name: 'Open PROJ-1234' }).focus();
      await user.keyboard(' ');
      await waitFor(() => expect(onOpenIssue).toHaveBeenCalledWith('PROJ-1234'));
    });

    // Test D: clicking the defect key NavLink pushes a breadcrumb before navigation
    it('AIOC-03-D: clicking the defect key pushes breadcrumb before navigation', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      render(
        <QueryClientProvider client={makeClient()}>
          <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
            <Routes>
              <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
              <Route
                path="/issue/:issueKey"
                element={<div data-testid="issue-detail-route-bc">Issue Detail</div>}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => expect(screen.getByText('PROJ-1234')).toBeDefined());

      mockBreadcrumbPush.mockReset();

      // Navigation + breadcrumb push now live on the defect key NavLink, not the
      // row body (which opens the peek preview instead).
      await user.click(screen.getByText('PROJ-1234'));

      expect(mockBreadcrumbPush).toHaveBeenCalledWith({
        label: 'Sprint 2',
        path: '/aio-cycle/PROJ/PROJ-CY-2',
      });
      await waitFor(() => expect(screen.getByTestId('issue-detail-route-bc')).toBeDefined());
    });
  });

  describe('Defects tab — summary strip and triggered-by chips', () => {
    it('status/priority/severity donuts live in the stats block only; no Sev line in the tab', async () => {
      const user = userEvent.setup();
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      await setupDefaultMocks();
      (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '186227',
        key: 'PROJ-1234',
        fields: {
          summary: 'Login broken',
          status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
          assignee: null,
          issuetype: { name: 'Bug', subtask: false },
          priority: { name: 'High' },
          customfield_13415: { value: '1-Critical' },
        },
      });
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => expect(screen.getAllByTestId('defect-status-donut')).toHaveLength(1));
      expect(screen.getAllByTestId('defect-priority-donut')).toHaveLength(1);
      expect(screen.getAllByTestId('defect-severity-donut')).toHaveLength(1);
      expect(screen.getByTestId('defect-status-donut').getAttribute('aria-label')).toBe(
        'Defects by status: 1 In Progress',
      );
      expect(screen.getByTestId('defect-severity-donut').getAttribute('aria-label')).toBe(
        'Defects by severity: 1 Critical',
      );
      // the old text breakdown is gone (the Severity column stays)
      expect(screen.queryByTestId('defects-summary')).toBeNull();
      expect(screen.queryByText(/^Sev:/)).toBeNull();
    });

    it('triggered-by chip pushes the cycle breadcrumb and opens that run', async () => {
      const user = userEvent.setup();
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      await setupDefaultMocks();
      (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '186227',
        key: 'PROJ-1234',
        fields: {
          summary: 'Login broken',
          status: { name: 'Open', statusCategory: { key: 'new' } },
          issuetype: { name: 'Bug', subtask: false },
        },
      });
      mockBreadcrumbPush.mockReset();
      render(
        <QueryClientProvider client={makeClient()}>
          <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
            <Routes>
              <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
              <Route
                path="/aio-cycle/:projectKey/:cycleKey/run/:runId"
                element={<div data-testid="run-detail-route">Run Detail</div>}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      const chip = await screen.findByTestId('defect-trigger-186227-run-2');
      expect(chip.textContent).toBe('PROJ-TC-2');
      await user.click(chip);
      await waitFor(() => expect(screen.getByTestId('run-detail-route')).toBeDefined());
      expect(mockBreadcrumbPush).toHaveBeenCalledWith({
        label: 'Sprint 2',
        path: '/aio-cycle/PROJ/PROJ-CY-2',
      });
    });
  });

  describe('pin button', () => {
    it('reads "Pin cycle" when cycle is not pinned', async () => {
      await setupDefaultMocks();
      mockPinnedKeys = [];
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Pin cycle/ })).toBeDefined();
      });
    });

    it('reads "Unpin cycle" when cycle is pinned', async () => {
      await setupDefaultMocks();
      mockPinnedKeys = ['PROJ-CY-2'];
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Unpin cycle/ })).toBeDefined();
      });
    });

    it('clicking Pin button calls togglePin and setPinnedCycleMeta', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      mockPinnedKeys = [];
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Pin cycle/ })).toBeDefined();
      });
      const pinBtn = screen.getByRole('button', { name: /Pin cycle/ });
      await user.click(pinBtn);
      expect(mockTogglePin).toHaveBeenCalledWith('PROJ-CY-2');
      expect(mockSetPinnedCycleMeta).toHaveBeenCalledWith('PROJ-CY-2', {
        name: 'Sprint 2',
        projectKey: 'PROJ',
      });
    });
  });
});

const mockBreadcrumbPush = vi.fn();

vi.mock('@/stores/breadcrumb.store', () => ({
  useBreadcrumbStore: Object.assign(
    (
      selector?: (s: {
        trail: never[];
        pop: () => void;
        push: typeof mockBreadcrumbPush;
      }) => unknown,
    ) => {
      const state = { trail: [], pop: vi.fn(), push: mockBreadcrumbPush };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({ push: mockBreadcrumbPush, pop: vi.fn(), trail: [] }),
      setState: vi.fn(),
    },
  ),
}));

describe('Executions tab — clickable rows', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockPinnedKeys = [];
    mockBreadcrumbPush.mockReset();
    const { fetchJiraIssueByKey } = await import('@/services/jira');
    (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('renders Executions tab as default active with run table inside', async () => {
    await setupDefaultMocks();
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
          <Routes>
            <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Executions' })).toBeDefined();
      expect(screen.getByText('Login test')).toBeDefined();
    });
  });

  it('renders Defects tab trigger that can be activated', async () => {
    const user = userEvent.setup();
    await setupDefaultMocks();
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
          <Routes>
            <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Executions' })).toBeDefined();
    });
    await user.click(screen.getByRole('tab', { name: 'Defects' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined();
    });
  });

  it('D-08: clicking a run row navigates to /aio-cycle/PROJ/PROJ-CY-2/run/{run.id} and pushes breadcrumb', async () => {
    const user = userEvent.setup();
    await setupDefaultMocks();
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
          <Routes>
            <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
            <Route
              path="/aio-cycle/:projectKey/:cycleKey/run/:runId"
              element={<div data-testid="run-detail-route">Run Detail</div>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText('Login test')).toBeDefined();
    });
    await user.click(screen.getByRole('button', { name: /Open run for PROJ-TC-1/ }));
    await waitFor(() => {
      expect(screen.getByTestId('run-detail-route')).toBeDefined();
    });
    expect(mockBreadcrumbPush).toHaveBeenCalledWith({
      label: 'Sprint 2',
      path: '/aio-cycle/PROJ/PROJ-CY-2',
    });
  });

  it('D-09: Enter key on focused run row navigates same as click', async () => {
    const user = userEvent.setup();
    await setupDefaultMocks();
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
          <Routes>
            <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
            <Route
              path="/aio-cycle/:projectKey/:cycleKey/run/:runId"
              element={<div data-testid="run-detail-route">Run Detail</div>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText('Login test')).toBeDefined();
    });
    screen.getByRole('button', { name: /Open run for PROJ-TC-1/ }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByTestId('run-detail-route')).toBeDefined();
    });
  });

  it('D-09: Space key on focused run row navigates same as click', async () => {
    const user = userEvent.setup();
    await setupDefaultMocks();
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
          <Routes>
            <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
            <Route
              path="/aio-cycle/:projectKey/:cycleKey/run/:runId"
              element={<div data-testid="run-detail-route">Run Detail</div>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText('Login test')).toBeDefined();
    });
    screen.getByRole('button', { name: /Open run for PROJ-TC-1/ }).focus();
    await user.keyboard(' ');
    await waitFor(() => {
      expect(screen.getByTestId('run-detail-route')).toBeDefined();
    });
  });
});

// Suppress unused import warning — the import is intentional (RED state trigger)
void AioCycleDetailPage;
void QueryClientProvider;
void MemoryRouter;
void Route;
void Routes;

describe('AIOC-N3S-T1: parent-owned issue queries (useQueries refactor)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockPinnedKeys = [];
    mockBreadcrumbPush.mockReset();
    const { fetchJiraIssueByKey } = await import('@/services/jira');
    (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('T1-01: all defect issues are fetched from the parent (useQueries), not individually per row — multiple defects resolved in parallel', async () => {
    const user = userEvent.setup();
    const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
      await import('@/services/aio');
    const { fetchJiraIssueByKey } = await import('@/services/jira');
    const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
    (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
    // Two defects linked across different runs
    const multiDefectRuns = [
      {
        id: 'run-a',
        status: 'FAIL',
        testCaseKey: 'PROJ-TC-A',
        cycleKey: 'PROJ-CY-2',
        testCase: { title: 'Test A', updatedDate: '2024-01-01' },
        defects: [],
        jiraDefectIDs: [111111, 222222],
      },
    ];
    (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(multiDefectRuns);
    (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
    (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
    (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockImplementation(
      (_base: string, _token: string, key: string) => {
        if (key === '111111')
          return Promise.resolve({
            id: '111111',
            key: 'PROJ-100',
            fields: { summary: 'Bug 100', status: { name: 'Open' } },
          });
        if (key === '222222')
          return Promise.resolve({
            id: '222222',
            key: 'PROJ-200',
            fields: { summary: 'Bug 200', status: { name: 'Done' } },
          });
        return Promise.resolve(null);
      },
    );

    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
    await user.click(screen.getByRole('tab', { name: 'Defects' }));

    // Both rows should render with their resolved keys
    await waitFor(() => {
      expect(screen.getByText('PROJ-100')).toBeDefined();
      expect(screen.getByText('PROJ-200')).toBeDefined();
    });

    // fetchJiraIssueByKey must be called for both keys (from parent's useQueries)
    expect(fetchJiraIssueByKey).toHaveBeenCalledWith(
      'https://jira.example.com',
      'fake-token',
      '111111',
    );
    expect(fetchJiraIssueByKey).toHaveBeenCalledWith(
      'https://jira.example.com',
      'fake-token',
      '222222',
    );
  });

  it('T1-02: DefectRow shows skeleton for a loading defect while another resolved defect shows its data', async () => {
    const user = userEvent.setup();
    const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
      await import('@/services/aio');
    const { fetchJiraIssueByKey } = await import('@/services/jira');
    const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
    (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
    const multiDefectRuns = [
      {
        id: 'run-b',
        status: 'FAIL',
        testCaseKey: 'PROJ-TC-B',
        cycleKey: 'PROJ-CY-2',
        testCase: { title: 'Test B', updatedDate: '2024-01-01' },
        defects: [],
        jiraDefectIDs: [333333, 444444],
      },
    ];
    (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(multiDefectRuns);
    (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
    (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
    (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockImplementation(
      (_base: string, _token: string, key: string) => {
        if (key === '333333')
          return Promise.resolve({
            id: '333333',
            key: 'PROJ-333',
            fields: { summary: 'Resolved bug', status: { name: 'Open' } },
          });
        if (key === '444444') return new Promise(() => {}); // never resolves
        return Promise.resolve(null);
      },
    );

    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
    await user.click(screen.getByRole('tab', { name: 'Defects' }));

    // Resolved defect row shows its key
    await waitFor(() => expect(screen.getByText('PROJ-333')).toBeDefined());

    // Loading defect row shows skeleton (title loading)
    expect(screen.getByTestId('defect-title-loading-444444')).toBeDefined();

    // Loading row is NOT interactive
    const loadingRow = screen.getByTestId('defect-row-444444');
    expect(loadingRow.getAttribute('role')).not.toBe('button');
  });
});

// ── Task 2: sort + filter tests ──────────────────────────────────────────────

// Three-defect fixture: A=Open/High/Critical/Alice, B=Done/Low/Minor/Bob, C=Open/Medium/Major/Alice
const defectFixtureRuns = [
  {
    id: 'run-x1',
    status: 'FAIL',
    testCaseKey: 'PROJ-TC-X1',
    cycleKey: 'PROJ-CY-2',
    testCase: { title: 'X1 test', updatedDate: '2024-01-01' },
    defects: [],
    jiraDefectIDs: [1001, 1002, 1003],
  },
];

const defectIssueA = {
  id: '1001',
  key: 'PROJ-1',
  fields: {
    summary: 'Issue A summary',
    status: { name: 'Open', statusCategory: { key: 'new' } },
    priority: { name: 'High' },
    customfield_13415: { value: 'Critical' },
    assignee: { displayName: 'Alice', avatarUrls: { '48x48': '' } },
    reporter: null,
    issuetype: { name: 'Bug' },
  },
};

const defectIssueB = {
  id: '1002',
  key: 'PROJ-2',
  fields: {
    summary: 'Issue B summary',
    status: { name: 'Done', statusCategory: { key: 'done' } },
    priority: { name: 'Low' },
    customfield_13415: { value: 'Minor' },
    assignee: { displayName: 'Bob', avatarUrls: { '48x48': '' } },
    reporter: null,
    issuetype: { name: 'Bug' },
  },
};

const defectIssueC = {
  id: '1003',
  key: 'PROJ-3',
  fields: {
    summary: 'Issue C summary',
    status: { name: 'Open', statusCategory: { key: 'new' } },
    priority: { name: 'Medium' },
    customfield_13415: { value: 'Major' },
    assignee: { displayName: 'Alice', avatarUrls: { '48x48': '' } },
    reporter: null,
    issuetype: { name: 'Bug' },
  },
};

async function setupSortFilterMocks() {
  const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
    await import('@/services/aio');
  const { fetchJiraIssueByKey } = await import('@/services/jira');
  const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
  (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
  (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue(defectFixtureRuns);
  (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
  (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
  (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockImplementation(
    (_base: string, _token: string, key: string) => {
      if (key === '1001') return Promise.resolve(defectIssueA);
      if (key === '1002') return Promise.resolve(defectIssueB);
      if (key === '1003') return Promise.resolve(defectIssueC);
      return Promise.resolve(null);
    },
  );
}

describe('AIOC-N3S: defects sort + filter', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockPinnedKeys = [];
    mockBreadcrumbPush.mockReset();
  });

  it('Test 1 (sort by Key asc/desc/unsorted): clicking Key header cycles sort order', async () => {
    const user = userEvent.setup();
    await setupSortFilterMocks();
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
    await user.click(screen.getByRole('tab', { name: 'Defects' }));

    // Wait for all three defects to load
    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeDefined();
      expect(screen.getByText('PROJ-2')).toBeDefined();
      expect(screen.getByText('PROJ-3')).toBeDefined();
    });

    // Click Key header → asc order
    const keyHeader = screen.getByTestId('defects-sort-header-key');
    await user.click(keyHeader);

    // Chevron-up indicator should be visible
    await waitFor(() => expect(screen.getByTestId('defects-sort-indicator-key')).toBeDefined());

    // All three rows still visible in asc order (by resolved key: PROJ-1 < PROJ-2 < PROJ-3)
    await waitFor(() => {
      const rows = screen.getAllByTestId(/^defect-row-/);
      expect(rows.length).toBe(3);
      expect(rows[0].getAttribute('data-testid')).toBe('defect-row-1001');
      expect(rows[1].getAttribute('data-testid')).toBe('defect-row-1002');
      expect(rows[2].getAttribute('data-testid')).toBe('defect-row-1003');
    });

    // Click again → desc order: PROJ-3, PROJ-2, PROJ-1
    await user.click(keyHeader);
    await waitFor(
      () => {
        const rowsDesc = screen.getAllByTestId(/^defect-row-/);
        expect(rowsDesc[0].getAttribute('data-testid')).toBe('defect-row-1003');
        expect(rowsDesc[1].getAttribute('data-testid')).toBe('defect-row-1002');
        expect(rowsDesc[2].getAttribute('data-testid')).toBe('defect-row-1001');
      },
      { timeout: 3000 },
    );

    // Click again → unsorted (original input order: 1001, 1002, 1003)
    await user.click(keyHeader);
    // No sort indicator
    await waitFor(() => expect(screen.queryByTestId('defects-sort-indicator-key')).toBeNull(), {
      timeout: 3000,
    });
    const rowsUnsorted = screen.getAllByTestId(/^defect-row-/);
    expect(rowsUnsorted[0].getAttribute('data-testid')).toBe('defect-row-1001');
  });

  it('Test 2 (sort by Priority): clicking Priority header sorts by rank High → Medium → Low', async () => {
    const user = userEvent.setup();
    await setupSortFilterMocks();
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
    await user.click(screen.getByRole('tab', { name: 'Defects' }));

    await waitFor(() => expect(screen.getByText('PROJ-1')).toBeDefined());

    const priorityHeader = screen.getByTestId('defects-sort-header-priority');
    await user.click(priorityHeader);

    // High (rank 1) → Medium (rank 2) → Low (rank 3)
    await waitFor(() => {
      const rows = screen.getAllByTestId(/^defect-row-/);
      expect(rows[0].getAttribute('data-testid')).toBe('defect-row-1001'); // High
      expect(rows[1].getAttribute('data-testid')).toBe('defect-row-1003'); // Medium
      expect(rows[2].getAttribute('data-testid')).toBe('defect-row-1002'); // Low
    });
  });

  it('Test 3 (sort indicator): active column shows chevron, inactive columns do not', async () => {
    const user = userEvent.setup();
    await setupSortFilterMocks();
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
    await user.click(screen.getByRole('tab', { name: 'Defects' }));
    await waitFor(() => expect(screen.getByText('PROJ-1')).toBeDefined());

    // No indicator initially
    expect(screen.queryByTestId('defects-sort-indicator-status')).toBeNull();

    const statusHeader = screen.getByTestId('defects-sort-header-status');
    await user.click(statusHeader);
    // ChevronUp shown for asc
    await waitFor(() => expect(screen.getByTestId('defects-sort-indicator-status')).toBeDefined());
    // Priority header has no indicator
    expect(screen.queryByTestId('defects-sort-indicator-priority')).toBeNull();

    // Click again → ChevronDown (still has indicator)
    await user.click(statusHeader);
    await waitFor(() => expect(screen.getByTestId('defects-sort-indicator-status')).toBeDefined(), {
      timeout: 3000,
    });

    // Click again → no indicator (unsorted)
    await user.click(statusHeader);
    await waitFor(() => expect(screen.queryByTestId('defects-sort-indicator-status')).toBeNull(), {
      timeout: 3000,
    });
  });

  it('Test 4 (filter by Status): selecting Open shows only Open defects', async () => {
    const user = userEvent.setup();
    await setupSortFilterMocks();
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
    await user.click(screen.getByRole('tab', { name: 'Defects' }));
    await waitFor(() => expect(screen.getByText('PROJ-1')).toBeDefined());

    // All three visible
    expect(screen.getAllByTestId(/^defect-row-/).length).toBe(3);

    // Open Status filter popover
    const statusFilterBtn = screen.getByTestId('defects-filter-status');
    await user.click(statusFilterBtn);

    // Wait for popover to appear — popover renders options as buttons
    await waitFor(() => {
      const openOptions = screen.queryAllByRole('button', { name: /^Open$/ });
      expect(openOptions.length).toBeGreaterThan(0);
    });

    // Find "Open" option button in the popover (it's a <button>, unlike the status pill <span>)
    // Use getAllByRole to find button with exact text "Open"
    const openOptionButtons = screen.getAllByRole('button', { name: /^Open$/ });
    const openOption = openOptionButtons[openOptionButtons.length - 1]; // last = popover option
    await user.click(openOption);

    // Only defects A and C (both Open) remain — 1002 (Done) is hidden
    await waitFor(() => {
      const rows = screen.getAllByTestId(/^defect-row-/);
      expect(rows.length).toBe(2);
    });
    expect(screen.queryByTestId('defect-row-1002')).toBeNull(); // Done → hidden

    // Test chip removal: the "Status: Open" chip close button removes the filter
    const chip = screen.getByTestId('defects-filter-chip-status-Open');
    await user.click(chip);

    // All three rows visible again after removing the chip
    await waitFor(() => {
      expect(screen.getAllByTestId(/^defect-row-/).length).toBe(3);
    });
  });

  it('Test 5 (filter chip + clear all): chip renders with close; Clear all resets', async () => {
    const user = userEvent.setup();
    await setupSortFilterMocks();
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
    await user.click(screen.getByRole('tab', { name: 'Defects' }));
    await waitFor(() => expect(screen.getByText('PROJ-1')).toBeDefined());

    // Apply Status=Open filter via popover
    await user.click(screen.getByTestId('defects-filter-status'));
    const openOptions = screen.getAllByRole('button', { name: /^Open$/ });
    await user.click(openOptions[openOptions.length - 1]);

    // Chip "Status: Open" appears with close button
    await waitFor(() => {
      expect(screen.getByTestId('defects-filter-chip-status-Open')).toBeDefined();
    });

    // Clear all button appears
    expect(screen.getByTestId('defects-filter-clear-all')).toBeDefined();

    // Click clear all → all three defects visible again
    await user.click(screen.getByTestId('defects-filter-clear-all'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^defect-row-/).length).toBe(3);
    });
    expect(screen.queryByTestId('defects-filter-chip-status-Open')).toBeNull();
  });

  it('Test 6 (filter + sort compose): Status=Open AND sort by Key desc → C then A', async () => {
    const user = userEvent.setup();
    await setupSortFilterMocks();
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
    await user.click(screen.getByRole('tab', { name: 'Defects' }));
    await waitFor(() => expect(screen.getByText('PROJ-1')).toBeDefined());

    // Apply Status=Open filter
    await user.click(screen.getByTestId('defects-filter-status'));
    const openOptions = screen.getAllByRole('button', { name: /^Open$/ });
    await user.click(openOptions[openOptions.length - 1]);

    // Only 2 rows (A and C)
    await waitFor(() => expect(screen.getAllByTestId(/^defect-row-/).length).toBe(2));

    // Sort by Key desc (two clicks: first asc, then desc)
    const keyHeader = screen.getByTestId('defects-sort-header-key');
    await user.click(keyHeader); // asc
    await user.click(keyHeader); // desc

    // Rows: PROJ-3 (1003) then PROJ-1 (1001) — desc by resolved key
    await waitFor(
      () => {
        const rows = screen.getAllByTestId(/^defect-row-/);
        expect(rows[0].getAttribute('data-testid')).toBe('defect-row-1003');
        expect(rows[1].getAttribute('data-testid')).toBe('defect-row-1001');
      },
      { timeout: 3000 },
    );
  });

  it('Test 7 (no matches): filter that matches nothing shows "No defects match the selected filters."', async () => {
    const user = userEvent.setup();
    await setupSortFilterMocks();
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
    await user.click(screen.getByRole('tab', { name: 'Defects' }));
    await waitFor(() => expect(screen.getByText('PROJ-1')).toBeDefined());

    // Apply Assignee=Bob AND Status=Open → Bob's defect is Done, not Open → zero matches
    await user.click(screen.getByTestId('defects-filter-assignee'));
    // "Bob" may appear in assignee cells too — use role=button to target the popover option
    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: /^Bob$/ }).length).toBeGreaterThan(0),
    );
    const bobOptions = screen.getAllByRole('button', { name: /^Bob$/ });
    await user.click(bobOptions[bobOptions.length - 1]);

    await user.click(screen.getByTestId('defects-filter-status'));
    const openOptions = screen.getAllByRole('button', { name: /^Open$/ });
    await user.click(openOptions[openOptions.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('No defects match the selected filters.')).toBeDefined();
    });

    // EmptyState "No defects" title must NOT be present (that's for allDefects.length === 0)
    expect(screen.queryByText('No defects are linked to runs in this cycle.')).toBeNull();
  });

  it('Test 8 (loading rows excluded from filter but present unfiltered): loading defect sorts to bottom', async () => {
    const user = userEvent.setup();
    const { fetchAioCycleDetail, fetchAioCycleTestCasesWithRuns, fetchAioCycleSummaries } =
      await import('@/services/aio');
    const { fetchJiraIssueByKey } = await import('@/services/jira');
    const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
    (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
    // Two defects: 1001 resolves, 9999 never resolves
    (fetchAioCycleTestCasesWithRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'run-t8',
        status: 'FAIL',
        testCaseKey: 'PROJ-TC-T8',
        cycleKey: 'PROJ-CY-2',
        testCase: { title: 'T8 test', updatedDate: '2024-01-01' },
        defects: [],
        jiraDefectIDs: [1001, 9999],
      },
    ]);
    (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
    (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
    (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockImplementation(
      (_base: string, _token: string, key: string) => {
        if (key === '1001') return Promise.resolve(defectIssueA);
        if (key === '9999') return new Promise(() => {}); // never resolves
        return Promise.resolve(null);
      },
    );

    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
    await user.click(screen.getByRole('tab', { name: 'Defects' }));

    // Wait for resolved row
    await waitFor(() => expect(screen.getByText('PROJ-1')).toBeDefined());
    // Loading row is also present (unfiltered)
    expect(screen.getByTestId('defect-row-9999')).toBeDefined();
    expect(screen.getAllByTestId(/^defect-row-/).length).toBe(2);

    // Apply Status=Open filter — loading row should be excluded
    await user.click(screen.getByTestId('defects-filter-status'));
    const openOptions = screen.getAllByRole('button', { name: /^Open$/ });
    await user.click(openOptions[openOptions.length - 1]);

    await waitFor(() => {
      // Only PROJ-1 (resolved, Open) remains
      expect(screen.getAllByTestId(/^defect-row-/).length).toBe(1);
    });
    expect(screen.queryByTestId('defect-row-9999')).toBeNull();
  });
});
