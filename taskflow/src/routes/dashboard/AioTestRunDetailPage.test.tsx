import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));
vi.mock('@/services/aio', () => ({
  fetchAioTestRunDetail: vi.fn(),
  fetchAioTestCaseDetail: vi.fn(),
  fetchAioCycleDetail: vi.fn(),
  fetchAioCycleSummaries: vi.fn(),
  fetchAioCycleTestCasesWithRuns: vi.fn(),
}));
vi.mock('@/services/aio/cycles', () => ({
  fetchAioProjectConfig: vi.fn().mockResolvedValue([
    { ID: 51, statusType: 'NOT_RUN', name: 'Not Run', color: '#CCCCCC' },
    { ID: 53, statusType: 'PASSED', name: 'Pass', color: '#00FF00' },
    { ID: 54, statusType: 'FAILED', name: 'Fail', color: '#FF0000' },
  ]),
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
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('fake-token'),
}));
vi.mock('@/hooks/useDelayedLoading', () => ({
  useDelayedLoading: () => false,
}));
// Avoid rendering full WikiRenderer pipeline in the run-detail tests — we only
// care here about the page structure (header, cards, sidebar). The wiki rendering
// is covered by WikiRenderer's own tests.
vi.mock('./WikiRenderer', () => ({
  WikiRenderer: ({ wikiText }: { wikiText?: string | null }) => (
    <span data-testid="wiki-stub">{wikiText ?? ''}</span>
  ),
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

import AioTestRunDetailPage from './AioTestRunDetailPage';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="probe-path">{loc.pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route
            path="/aio-cycle/:projectKey/:cycleKey/run/:runId"
            element={<AioTestRunDetailPage />}
          />
          <Route path="/aio-cycle/:projectKey/:cycleKey" element={<div>cycle page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Runs list (testcasewithrun/paged shape, normalised). The middle one is the route's run.
const mockRuns = [
  {
    id: 'run-1',
    status: 'PASS',
    testCaseKey: 'SHOP-TC-1',
    cycleKey: 'SHOP-CY-1011',
    testCase: { title: 'First test' },
    assignedToID: 'ext111',
    runCount: 1,
  },
  {
    id: 'run-2',
    status: 'FAIL',
    testCaseKey: 'SHOP-TC-8477',
    cycleKey: 'SHOP-CY-1011',
    testCase: { title: 'Login flow happy path' },
    assignedToID: 'ext94772',
    runCount: 3,
  },
  {
    id: 'run-3',
    status: 'NOT_EXECUTED',
    testCaseKey: 'SHOP-TC-3',
    cycleKey: 'SHOP-CY-1011',
    testCase: { title: 'Third test' },
    runCount: 0,
  },
];

// Live P4 shape for the test case detail
const mockTestCase = {
  key: 'SHOP-TC-8477',
  title: 'Login flow happy path',
  description: 'h1. Goal',
  statusName: 'Published',
  typeName: 'System Test',
  folderName: 'Checkout',
  ownedByID: 'ext94772',
  version: '2',
  customFields: [
    { name: 'Platform', value: 'Web' },
    { name: 'Browsers', value: 'Chrome, Firefox' },
  ],
};

// Live P3 run-detail shape: no testCase, testCaseKey is ''.
function runDetail(overrides: Record<string, unknown> = {}, steps?: unknown[]) {
  return {
    run: {
      id: 'run-2',
      status: 'FAIL',
      testCaseKey: '',
      cycleKey: 'SHOP-CY-1011',
      executedDate: '2026-05-01T10:00:00Z',
      createdDate: '2026-04-01T10:00:00Z',
      executedByID: 'ext222',
      ...overrides,
    },
    steps: steps ?? [
      { id: 1, step: 'Open page', expectedResult: 'OK', actualResult: 'OK', status: 'PASS' },
      {
        id: 2,
        step: 'Submit form',
        expectedResult: 'Saved',
        actualResult: 'Error 500',
        status: 'FAIL',
      },
      {
        id: 3,
        step: 'Log out',
        expectedResult: 'Logged out',
        actualResult: '',
        status: 'NOT_EXECUTED',
      },
    ],
  };
}

const RUN_PATH = '/aio-cycle/SHOP/SHOP-CY-1011/run/run-2';

async function setup(opts: { detail?: unknown; runs?: unknown; testCase?: unknown } = {}) {
  const aio = await import('@/services/aio');
  const projects = await import('@/services/jira/projects');
  vi.mocked(projects.fetchJiraProjectNumericId).mockResolvedValue(10134);
  vi.mocked(aio.fetchAioCycleDetail).mockResolvedValue({
    ID: 99,
    key: 'SHOP-CY-1011',
    name: 'Cycle',
    status: 'Active',
    projectKey: 'SHOP',
  } as never);
  vi.mocked(aio.fetchAioCycleSummaries).mockResolvedValue([]);
  vi.mocked(aio.fetchAioCycleTestCasesWithRuns).mockResolvedValue((opts.runs ?? mockRuns) as never);
  vi.mocked(aio.fetchAioTestRunDetail).mockResolvedValue(
    (opts.detail === undefined ? runDetail() : opts.detail) as never,
  );
  if (opts.testCase instanceof Error) {
    vi.mocked(aio.fetchAioTestCaseDetail).mockRejectedValue(opts.testCase);
  } else {
    vi.mocked(aio.fetchAioTestCaseDetail).mockResolvedValue(
      (opts.testCase === undefined ? mockTestCase : opts.testCase) as never,
    );
  }
}

describe('AioTestRunDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBreadcrumbStore.setState({ trail: [] });
  });

  it('renders key + title header, status chip and one card per step', async () => {
    await setup();
    renderAt(RUN_PATH);

    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-status-chip')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-title').textContent).toBe(
        'SHOP-TC-8477 Login flow happy path',
      );
    });
    // The key is rendered monospaced
    expect(
      screen.getByTestId('aio-run-detail-title').querySelector('span.font-mono')?.textContent,
    ).toBe('SHOP-TC-8477');
    expect(screen.getByTestId('aio-run-detail-status-chip').textContent).toBe('Fail');
    const container = screen.getByTestId('aio-run-detail-step-table');
    expect(container.querySelectorAll('[data-testid^="run-step-"]').length).toBe(3);
    const wikiStubs = screen.getAllByTestId('wiki-stub');
    expect(wikiStubs.some((n) => n.textContent === 'Open page')).toBe(true);
    // Step summary counts passed steps
    expect(screen.getByTestId('aio-run-step-summary').textContent).toMatch(/Steps 1\/3 passed/);
  });

  it('falls back to the test case detail title when the list title is empty', async () => {
    await setup({
      runs: [mockRuns[0], { ...mockRuns[1], testCase: { title: '' } }, mockRuns[2]],
    });
    renderAt(RUN_PATH);
    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-title').textContent).toBe(
        'SHOP-TC-8477 Login flow happy path',
      );
    });
  });

  it('falls back to "Run {id}" when the run is absent from the cycle runs list', async () => {
    await setup({ runs: [mockRuns[0], mockRuns[2]] });
    renderAt(RUN_PATH);

    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-status-chip')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-title').textContent).toBe('Run run-2');
    });
    expect(screen.queryByTestId('aio-run-detail-position')).toBeNull();
  });

  it('shows EmptyState when fetch resolves to null (run not found / 404)', async () => {
    await setup({ detail: null });
    renderAt('/aio-cycle/SHOP/SHOP-CY-1011/run/999999');

    await waitFor(() => {
      expect(screen.getByText(/Run not found/i)).toBeTruthy();
    });
    expect(screen.queryByTestId('aio-run-detail-status-chip')).toBeNull();
  });

  it('renders breadcrumb from the trail; current segment is the test case key', async () => {
    await setup();
    useBreadcrumbStore.setState({
      trail: [{ path: '/issue/QAT-1234', label: 'QAT-1234' }],
    });
    renderAt(RUN_PATH);

    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-breadcrumb')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'QAT-1234' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-breadcrumb-current').textContent).toBe(
        'SHOP-TC-8477',
      );
    });
  });

  it('renders cycle / test case breadcrumb when the trail is empty (direct URL access)', async () => {
    await setup();
    renderAt(RUN_PATH);

    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-status-chip')).toBeTruthy();
    });
    expect(screen.getByTestId('aio-run-detail-breadcrumb')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Back to cycle/ }).textContent).toBe('SHOP-CY-1011');
  });

  it('does not repeat the cycle when the trail already ends at it', async () => {
    await setup();
    useBreadcrumbStore.setState({
      trail: [{ label: 'Cycle', path: '/aio-cycle/SHOP/SHOP-CY-1011' }],
    });
    renderAt(RUN_PATH);
    await screen.findByRole('button', { name: 'Cycle' });
    expect(screen.queryByRole('link', { name: /Back to cycle/ })).toBeNull();
  });

  it('uses the projectKey/cycleKey/runId from the URL (cross-project routing)', async () => {
    await setup();
    const { fetchAioTestRunDetail } = await import('@/services/aio');
    renderAt('/aio-cycle/SHOP/SHOP-CY-759/run/209620');

    await waitFor(() => {
      expect(fetchAioTestRunDetail).toHaveBeenCalled();
    });
    const mockFn = vi.mocked(fetchAioTestRunDetail);
    // (jiraBaseUrl, token, projectKey, cycleKey, runId)
    expect(mockFn.mock.calls[0][2]).toBe('SHOP');
    expect(mockFn.mock.calls[0][3]).toBe('SHOP-CY-759');
    expect(mockFn.mock.calls[0][4]).toBe('209620');
  });

  describe('Prev / Next', () => {
    it('shows the position and navigates (replace) to the next run', async () => {
      await setup();
      const user = userEvent.setup();
      renderAt(RUN_PATH);

      await waitFor(() => {
        expect(screen.getByTestId('aio-run-detail-position').textContent).toBe('2/3');
      });
      const prev = screen.getByRole('button', { name: 'Previous run' }) as HTMLButtonElement;
      const next = screen.getByRole('button', { name: 'Next run' }) as HTMLButtonElement;
      expect(prev.disabled).toBe(false);
      expect(next.disabled).toBe(false);

      await user.click(next);
      await waitFor(() => {
        expect(screen.getByTestId('probe-path').textContent).toBe(
          '/aio-cycle/SHOP/SHOP-CY-1011/run/run-3',
        );
      });
      // No breadcrumb entry is pushed while stepping through runs
      expect(useBreadcrumbStore.getState().trail).toHaveLength(0);
    });

    it('disables Previous on the first run and Next on the last', async () => {
      await setup();
      renderAt('/aio-cycle/SHOP/SHOP-CY-1011/run/run-1');

      await waitFor(() => {
        expect(screen.getByTestId('aio-run-detail-position').textContent).toBe('1/3');
      });
      expect(
        (screen.getByRole('button', { name: 'Previous run' }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect((screen.getByRole('button', { name: 'Next run' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    it('ArrowLeft steps to the previous run', async () => {
      await setup();
      const user = userEvent.setup();
      renderAt(RUN_PATH);
      await waitFor(() => {
        expect(screen.getByTestId('aio-run-detail-position').textContent).toBe('2/3');
      });
      await user.keyboard('{ArrowLeft}');
      await waitFor(() => {
        expect(screen.getByTestId('probe-path').textContent).toBe(
          '/aio-cycle/SHOP/SHOP-CY-1011/run/run-1',
        );
      });
    });

    it('skips runs with an empty id', async () => {
      await setup({ runs: [mockRuns[0], { ...mockRuns[1], id: '' }, mockRuns[2]] });
      renderAt('/aio-cycle/SHOP/SHOP-CY-1011/run/run-3');
      await waitFor(() => {
        expect(screen.getByTestId('aio-run-detail-position').textContent).toBe('2/2');
      });
    });
  });

  describe('step cards', () => {
    it('highlights a FAIL step and not a PASS step', async () => {
      await setup();
      renderAt(RUN_PATH);
      await waitFor(() => {
        expect(screen.getByTestId('run-step-1')).toBeTruthy();
      });
      expect(screen.getByTestId('run-step-1').className).toContain('ring-red-500/40');
      expect(screen.getByTestId('run-step-0').className).not.toContain('ring-red-500/40');
    });

    it('shows Actual only when present and no Test data label without testData', async () => {
      await setup();
      renderAt(RUN_PATH);
      await waitFor(() => {
        expect(screen.getByTestId('run-step-2')).toBeTruthy();
      });
      // Step 3 is not executed with an empty actual result
      expect(within(screen.getByTestId('run-step-2')).queryByText('Actual')).toBeNull();
      expect(within(screen.getByTestId('run-step-1')).getByText('Actual')).toBeTruthy();
      expect(screen.queryByText('Test data')).toBeNull();
    });

    it('renders Test data when a step has testData', async () => {
      await setup({
        detail: runDetail({}, [
          { id: 1, step: 'Do it', expectedResult: 'OK', status: 'PASS', testData: 'user=bob' },
        ]),
      });
      renderAt(RUN_PATH);
      await waitFor(() => {
        expect(screen.getByText('Test data')).toBeTruthy();
      });
      expect(screen.getAllByTestId('wiki-stub').some((n) => n.textContent === 'user=bob')).toBe(
        true,
      );
    });

    it('shows per-step defect chips when jiraDefectIDs is non-empty', async () => {
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      vi.mocked(fetchJiraIssueByKey).mockResolvedValue({
        key: 'QAT-186227',
        fields: { summary: 'x', status: { name: 'Open' }, issuetype: { name: 'Bug' } },
      } as never);
      await setup({
        detail: runDetail({}, [
          { id: 1, step: 'Do it', status: 'FAIL', actualResult: 'bad', jiraDefectIDs: [186227] },
        ]),
      });
      renderAt(RUN_PATH);
      await waitFor(() => {
        expect(screen.getByTestId('run-step-defects-0').textContent).toContain('QAT-186227');
      });
    });
  });

  describe('sidebar and test case info', () => {
    it('renders the run count in the sidebar', async () => {
      await setup();
      renderAt(RUN_PATH);
      await waitFor(() => {
        expect(screen.getByTestId('aio-run-run-count').textContent).toBe('×3');
      });
      expect(screen.getByTestId('aio-run-sidebar')).toBeTruthy();
    });

    it('renders the description above the step summary', async () => {
      await setup();
      renderAt(RUN_PATH);
      const desc = await screen.findByTestId('aio-run-testcase-description');
      const summary = screen.getByTestId('aio-run-step-summary');
      expect(desc.textContent).toBe('h1. Goal');
      expect(desc.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('shows test case metadata (type, status, custom fields)', async () => {
      await setup();
      renderAt(RUN_PATH);
      const meta = await screen.findByTestId('aio-run-testcase-meta');
      expect(within(meta).getByText('System Test')).toBeTruthy();
      expect(within(meta).getByText('Published')).toBeTruthy();
      expect(within(meta).getByText('Checkout')).toBeTruthy();
      expect(within(meta).getByText('Platform')).toBeTruthy();
      expect(within(meta).getByText('Web')).toBeTruthy();
      expect(within(meta).getByText('Chrome, Firefox')).toBeTruthy();
    });

    it('still renders steps and omits test case meta when the test case fetch fails', async () => {
      await setup({ testCase: new Error('boom') });
      renderAt(RUN_PATH);
      await waitFor(() => {
        expect(screen.getByTestId('run-step-0')).toBeTruthy();
      });
      // Title still comes from the runs list
      await waitFor(() => {
        expect(screen.getByTestId('aio-run-detail-title').textContent).toContain('SHOP-TC-8477');
      });
      const { fetchAioTestCaseDetail } = await import('@/services/aio');
      await waitFor(() => {
        expect(fetchAioTestCaseDetail).toHaveBeenCalled();
      });
      expect(screen.queryByTestId('aio-run-testcase-meta')).toBeNull();
      expect(screen.queryByTestId('aio-run-testcase-description')).toBeNull();
    });

    it('links back to the cycle', async () => {
      await setup();
      renderAt(RUN_PATH);
      const link = await screen.findByRole('link', { name: /Back to cycle/ });
      expect(link.getAttribute('href')).toBe('/aio-cycle/SHOP/SHOP-CY-1011');
    });

    it('the cycle breadcrumb segment consumes its entry instead of stacking', async () => {
      await setup();
      useBreadcrumbStore.setState({
        trail: [
          { label: 'Cycles', path: '/aio/SHOP' },
          { label: 'Cycle', path: '/aio-cycle/SHOP/SHOP-CY-1011' },
        ],
      });
      renderAt(RUN_PATH);
      await userEvent.click(await screen.findByRole('button', { name: 'Cycle' }));
      expect(useBreadcrumbStore.getState().trail.map((e) => e.path)).toEqual(['/aio/SHOP']);
    });
  });

  it('renders the IN_PROGRESS status as "In progress"', async () => {
    await setup({ detail: runDetail({ status: 'IN_PROGRESS' }) });
    renderAt(RUN_PATH);
    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-status-chip').textContent).toBe('In progress');
    });
  });

  describe('defects', () => {
    const issue = {
      key: 'QAT-186227',
      fields: {
        summary: 'Login regression',
        status: { name: 'Open', statusCategory: { key: 'new' } },
        assignee: null,
        reporter: null,
        priority: null,
        customfield_13415: null,
        issuetype: { name: 'Bug' },
      },
    };

    it('renders the defects section with the resolved issue when jiraDefectIDs is non-empty', async () => {
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      vi.mocked(fetchJiraIssueByKey).mockResolvedValue(issue as never);
      await setup({ detail: runDetail({ jiraDefectIDs: [186227] }) });
      renderAt(RUN_PATH);

      await waitFor(() => {
        expect(screen.getByTestId('aio-run-defects-section')).toBeTruthy();
      });
      await waitFor(() => {
        expect(screen.getByText('Login regression')).toBeTruthy();
      });
      expect(screen.getAllByText('QAT-186227').length).toBeGreaterThan(0);
    });

    it('omits the defects section when jiraDefectIDs is empty or undefined', async () => {
      await setup({ detail: runDetail({ jiraDefectIDs: [] }) });
      const first = renderAt(RUN_PATH);
      await waitFor(() => {
        expect(screen.getByTestId('aio-run-detail-status-chip')).toBeTruthy();
      });
      expect(screen.queryByTestId('aio-run-defects-section')).toBeNull();
      first.unmount();

      await setup({ detail: runDetail() });
      renderAt(RUN_PATH);
      await waitFor(() => {
        expect(screen.getByTestId('aio-run-detail-status-chip')).toBeTruthy();
      });
      expect(screen.queryByTestId('aio-run-defects-section')).toBeNull();
    });

    it('clicking a defect pushes the run page onto the breadcrumb trail before navigating', async () => {
      const { fetchJiraIssueByKey } = await import('@/services/jira');
      vi.mocked(fetchJiraIssueByKey).mockResolvedValue(issue as never);
      await setup({ detail: runDetail({ jiraDefectIDs: [186227] }) });
      useBreadcrumbStore.setState({ trail: [] });
      renderAt(RUN_PATH);

      const defectBtn = await screen.findByRole('button', { name: 'Open defect QAT-186227' });
      await userEvent.click(defectBtn);

      const trail = useBreadcrumbStore.getState().trail;
      expect(trail).toHaveLength(1);
      expect(trail[0].label).toBe('Run run-2');
      expect(trail[0].path).toMatch(/aio-cycle\/SHOP\/SHOP-CY-1011\/run\/run-2/);
    });
  });
});
