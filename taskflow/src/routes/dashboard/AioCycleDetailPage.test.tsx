import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
  fetchAioTestRunsForCycle: vi.fn(),
  fetchAioCycleDetail: vi.fn(),
  fetchAioCycleSummaries: vi.fn(),
  fetchAioCyclesWithDetail: vi.fn(),
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
  const { fetchAioCycleDetail, fetchAioTestRunsForCycle, fetchAioCycleSummaries } = await import(
    '@/services/aio'
  );
  const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
  (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
  (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
  (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
  (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
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

describe('AioCycleDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPinnedKeys = [];
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
        expect(screen.getByText(/Pass: 1/)).toBeDefined();
        expect(screen.getByText(/Fail: 1/)).toBeDefined();
        expect(screen.getByText(/Not Run: 1/)).toBeDefined();
      });
    });

    it('shows "No runs recorded" when runs array is empty', async () => {
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
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
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      // 2 pass, 2 fail = 50% each
      const evenRuns = [
        { id: 'r1', status: 'PASS', testCaseKey: 'TC-1', cycleKey: 'PROJ-CY-2', defects: [], jiraDefectIDs: [] },
        { id: 'r2', status: 'PASS', testCaseKey: 'TC-2', cycleKey: 'PROJ-CY-2', defects: [], jiraDefectIDs: [] },
        { id: 'r3', status: 'FAIL', testCaseKey: 'TC-3', cycleKey: 'PROJ-CY-2', defects: [], jiraDefectIDs: [] },
        { id: 'r4', status: 'FAIL', testCaseKey: 'TC-4', cycleKey: 'PROJ-CY-2', defects: [], jiraDefectIDs: [] },
      ];
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(evenRuns);
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
        expect(screen.getByText(/Pass: 2 \(50%\)/)).toBeDefined();
        expect(screen.getByText(/Fail: 2 \(50%\)/)).toBeDefined();
      });
    });

    it('progress bar renders from cycle summary while runs are still loading', async () => {
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle, fetchAioCycleSummaries } =
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
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      renderPage();
      // Progress bar must be visible even though runs never resolved
      await waitFor(() => {
        expect(screen.getByText(/Pass:/)).toBeDefined();
      });
      // runs-table-skeleton should be present since runsQuery is still loading
      await waitFor(() => {
        expect(screen.getByTestId('runs-table-skeleton')).toBeDefined();
      });
    });

    it('falls back to runs-derived counts when summary query errors', async () => {
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
      renderPage();
      // Falls back to runs-derived counts: 1 pass, 1 fail, 1 not-run
      await waitFor(() => {
        expect(screen.getByText(/Pass: 1/)).toBeDefined();
        expect(screen.getByText(/Fail: 1/)).toBeDefined();
        expect(screen.getByText(/Not Run: 1/)).toBeDefined();
      });
    });
  });

  describe('filter chips', () => {
    it('all four chips are active by default', async () => {
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => {
        const chips = screen.getAllByRole('switch');
        expect(chips).toHaveLength(4);
        chips.forEach((chip) => {
          expect(chip.getAttribute('aria-checked')).toBe('true');
        });
      });
    });

    it('toggling Fail chip off hides Fail-status rows from the run list', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      // wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Checkout test')).toBeDefined();
      });
      const failChip = screen.getByRole('switch', { name: 'Fail' });
      await user.click(failChip);
      await waitFor(() => {
        expect(screen.queryByText('Checkout test')).toBeNull();
      });
    });

    it('shows "No runs match the selected filters" when all chips toggled off', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByRole('switch')).toHaveLength(4);
      });
      const chips = screen.getAllByRole('switch');
      for (const chip of chips) {
        await user.click(chip);
      }
      await waitFor(() => {
        expect(screen.getByText(/No runs match the selected filters/)).toBeDefined();
      });
    });
  });

  describe('Defects tab', () => {
    beforeEach(async () => {
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        key: 'PROJ-42',
        fields: { summary: 'Login broken', status: { name: 'Open' } },
      });
    });

    it('AIOC-03: renders a defect row per unique defect key after clicking Defects tab', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => {
        // defect key rendered as string '186227' (jiraDefectIDs[0].toString())
        expect(screen.getByText('186227')).toBeDefined();
        expect(screen.getByText('Login broken')).toBeDefined();
        expect(screen.getByText('Open')).toBeDefined();
      });
    });

    it('AIOC-03: shows EmptyState when no defects', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      const runsNoDefects = mockRuns.map((r) => ({ ...r, defects: [], jiraDefectIDs: [] }));
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(runsNoDefects);
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
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
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

    it('AIOC-03: defect key links to /issue/:key', async () => {
      const user = userEvent.setup();
      await setupDefaultMocks();
      renderPage();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Defects' })).toBeDefined());
      await user.click(screen.getByRole('tab', { name: 'Defects' }));
      await waitFor(() => expect(screen.getByText('186227')).toBeDefined());
      expect(screen.getByText('186227').closest('a')?.getAttribute('href')).toBe('/issue/186227');
    });

    it('AIOC-03: triggered-by column lists test case keys from runs whose jiraDefectIDs contains the ID', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle, fetchAioCycleSummaries } =
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
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(multiRuns);
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
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle, fetchAioCycleSummaries } =
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
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(runsWithNumericDefects);
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

      const { fetchAioCycleDetail, fetchAioTestRunsForCycle, fetchAioCycleSummaries } =
        await import('@/services/aio');
      const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
      renderPage();
      // Allow microtasks to flush — no query should fire while token is loading
      await new Promise((r) => setTimeout(r, 50));
      expect(fetchAioCycleSummaries).not.toHaveBeenCalled();
      expect(fetchJiraProjectNumericId).not.toHaveBeenCalled();
      expect(fetchAioTestRunsForCycle).not.toHaveBeenCalled();
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
    (selector?: (s: { trail: never[]; pop: () => void; push: typeof mockBreadcrumbPush }) => unknown) => {
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
    });
    expect(screen.getByText('Login test')).toBeDefined();
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
    await user.click(screen.getByTestId('run-row-run-1'));
    await waitFor(() => {
      expect(screen.getByTestId('run-detail-route')).toBeDefined();
    });
    expect(mockBreadcrumbPush).toHaveBeenCalledWith({
      label: 'Sprint 2',
      path: '/aio-cycle/PROJ/PROJ-CY-2',
    });
  });

  it('D-09: Enter key on focused run row navigates same as click', async () => {
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
    const row = screen.getByTestId('run-row-run-1');
    row.focus();
    fireEvent.keyDown(row, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByTestId('run-detail-route')).toBeDefined();
    });
  });

  it('D-09: Space key on focused run row navigates same as click', async () => {
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
    const row = screen.getByTestId('run-row-run-1');
    row.focus();
    fireEvent.keyDown(row, { key: ' ' });
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
