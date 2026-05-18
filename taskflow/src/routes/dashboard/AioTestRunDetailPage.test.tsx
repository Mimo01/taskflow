import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));
vi.mock('@/services/aio', () => ({
  fetchAioTestRunDetail: vi.fn(),
}));
vi.mock('@/services/jira', () => ({
  fetchJiraIssueByKey: vi.fn(),
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('fake-token'),
}));
vi.mock('@/hooks/useDelayedLoading', () => ({
  useDelayedLoading: () => false,
}));
// Avoid rendering full WikiRenderer pipeline in the run-detail tests — we only
// care here about the page structure (header, table, status chip). The step
// content rendering is covered by WikiRenderer's own tests.
vi.mock('./WikiRenderer', () => ({
  WikiRenderer: ({ wikiText }: { wikiText?: string | null }) => (
    <span data-testid="wiki-stub">{wikiText ?? ''}</span>
  ),
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

import AioTestRunDetailPage from './AioTestRunDetailPage';

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/aio-cycle/:projectKey/:cycleKey/run/:runId"
            element={<AioTestRunDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AioTestRunDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBreadcrumbStore.setState({ trail: [] });
  });

  it('renders run header + step table when the detail fetch succeeds', async () => {
    const { fetchAioTestRunDetail } = await import('@/services/aio');
    (fetchAioTestRunDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      run: {
        id: '263794',
        status: 'PASS',
        testCaseKey: 'ESHOP-TC-8477',
        cycleKey: 'ESHOP-CY-1011',
        testCase: { title: 'Login flow happy path' },
        executedDate: '2026-05-01T10:00:00Z',
      },
      steps: [
        { id: 1, step: 'Open page', expectedResult: 'OK', actualResult: 'OK', status: 'PASS' },
        {
          id: 2,
          step: 'Submit form',
          expectedResult: 'OK',
          actualResult: '',
          status: 'NOT_EXECUTED',
        },
      ],
    });

    renderAt('/aio-cycle/ESHOP/ESHOP-CY-1011/run/263794');

    // Wait for the fetch-dependent status chip (detailQuery.data must be set).
    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-status-chip')).toBeTruthy();
    });
    // Title shows the run id.
    expect(screen.getByTestId('aio-run-detail-title').textContent).toMatch(/263794/);
    // Status chip shows the fetched detail.run.status, not "Not Run".
    expect(screen.getByTestId('aio-run-detail-status-chip').textContent).toBe('Pass');
    // Step table rendered with 2 rows.
    const table = screen.getByTestId('aio-run-detail-step-table');
    expect(table.querySelectorAll('tbody tr').length).toBe(2);
    // Step content text routed through WikiRenderer stub.
    const wikiStubs = screen.getAllByTestId('wiki-stub');
    expect(wikiStubs.some((n) => n.textContent === 'Open page')).toBe(true);
  });

  it('shows EmptyState when fetch resolves to null (run not found / 404)', async () => {
    const { fetchAioTestRunDetail } = await import('@/services/aio');
    (fetchAioTestRunDetail as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    renderAt('/aio-cycle/ESHOP/ESHOP-CY-1011/run/999999');

    await waitFor(() => {
      expect(screen.getByText(/Run not found/i)).toBeTruthy();
    });
    // No status chip rendered when detail is null.
    expect(screen.queryByTestId('aio-run-detail-status-chip')).toBeNull();
  });

  it('renders breadcrumb header from useBreadcrumbStore trail; current segment is "Run {runId}"', async () => {
    const { fetchAioTestRunDetail } = await import('@/services/aio');
    (fetchAioTestRunDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      run: {
        id: '263794',
        status: 'FAIL',
        testCaseKey: 'ESHOP-TC-8477',
        cycleKey: 'ESHOP-CY-1011',
        executedDate: '2026-05-01T10:00:00Z',
      },
      steps: [],
    });

    // Source page (e.g. IssueDetailPage) pushed its entry to the trail before
    // navigating here — this is the existing breadcrumb-store convention.
    useBreadcrumbStore.setState({
      trail: [{ path: '/issue/VTE-1234', label: 'VTE-1234' }],
    });

    renderAt('/aio-cycle/ESHOP/ESHOP-CY-1011/run/263794');

    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-breadcrumb')).toBeTruthy();
    });
    // Trail entry is rendered as a button labeled with the issue key.
    expect(screen.getByRole('button', { name: 'VTE-1234' })).toBeTruthy();
    // Current segment shows the run id.
    expect(screen.getByTestId('aio-run-detail-breadcrumb-current').textContent).toBe('Run 263794');
  });

  it('omits the breadcrumb header when the trail is empty (direct URL access)', async () => {
    const { fetchAioTestRunDetail } = await import('@/services/aio');
    (fetchAioTestRunDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      run: { id: '1', status: 'PASS', testCaseKey: 'X', cycleKey: 'X-CY-1' },
      steps: [],
    });

    // Trail empty (beforeEach already resets it) — no breadcrumb header.
    renderAt('/aio-cycle/X/X-CY-1/run/1');

    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-status-chip')).toBeTruthy();
    });
    expect(screen.queryByTestId('aio-run-detail-breadcrumb')).toBeNull();
  });

  it('uses the cycle-derived projectKey from the URL (cross-project routing)', async () => {
    const { fetchAioTestRunDetail } = await import('@/services/aio');
    const mockFn = fetchAioTestRunDetail as ReturnType<typeof vi.fn>;
    mockFn.mockResolvedValue({
      run: {
        id: '209620',
        status: 'FAIL',
        testCaseKey: 'ESHOP-TC-100',
        cycleKey: 'ESHOP-CY-759',
        executedDate: '2026-05-01T10:00:00Z',
      },
      steps: [],
    });

    renderAt('/aio-cycle/ESHOP/ESHOP-CY-759/run/209620');

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalled();
    });
    // The page fetches with projectKey='ESHOP' from URL, NOT some stale
    // projectKey from a parent issue. The arg order is
    // (jiraBaseUrl, token, projectKey, cycleKey, runId).
    expect(mockFn.mock.calls[0][2]).toBe('ESHOP');
    expect(mockFn.mock.calls[0][3]).toBe('ESHOP-CY-759');
    expect(mockFn.mock.calls[0][4]).toBe('209620');
  });

  it('renders defects section with resolved issue when jiraDefectIDs is non-empty', async () => {
    const { fetchAioTestRunDetail } = await import('@/services/aio');
    const { fetchJiraIssueByKey } = await import('@/services/jira');
    (fetchAioTestRunDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      run: {
        id: '263794',
        status: 'FAIL',
        testCaseKey: 'ESHOP-TC-8477',
        cycleKey: 'ESHOP-CY-1011',
        executedDate: '2026-05-01T10:00:00Z',
        jiraDefectIDs: [186227],
      },
      steps: [],
    });
    (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: 'VTE-186227',
      fields: {
        summary: 'Login regression',
        status: { name: 'Open', statusCategory: { key: 'new' } },
        assignee: null,
        reporter: null,
        priority: null,
        customfield_13415: null,
        issuetype: { name: 'Bug' },
      },
    });

    renderAt('/aio-cycle/ESHOP/ESHOP-CY-1011/run/263794');

    await waitFor(() => {
      expect(screen.getByTestId('aio-run-defects-section')).toBeTruthy();
    });
    // Defect key is rendered
    expect(screen.getByText('VTE-186227')).toBeTruthy();
    // Defect summary is rendered
    expect(screen.getByText('Login regression')).toBeTruthy();
  });

  it('omits defects section when jiraDefectIDs is empty', async () => {
    const { fetchAioTestRunDetail } = await import('@/services/aio');
    (fetchAioTestRunDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      run: {
        id: '263794',
        status: 'PASS',
        testCaseKey: 'ESHOP-TC-8477',
        cycleKey: 'ESHOP-CY-1011',
        executedDate: '2026-05-01T10:00:00Z',
        jiraDefectIDs: [],
      },
      steps: [],
    });

    renderAt('/aio-cycle/ESHOP/ESHOP-CY-1011/run/263794');

    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-status-chip')).toBeTruthy();
    });
    // No defects section when list is empty
    expect(screen.queryByTestId('aio-run-defects-section')).toBeNull();
  });

  it('omits defects section when jiraDefectIDs is undefined', async () => {
    const { fetchAioTestRunDetail } = await import('@/services/aio');
    (fetchAioTestRunDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      run: {
        id: '263794',
        status: 'PASS',
        testCaseKey: 'ESHOP-TC-8477',
        cycleKey: 'ESHOP-CY-1011',
        executedDate: '2026-05-01T10:00:00Z',
      },
      steps: [],
    });

    renderAt('/aio-cycle/ESHOP/ESHOP-CY-1011/run/263794');

    await waitFor(() => {
      expect(screen.getByTestId('aio-run-detail-status-chip')).toBeTruthy();
    });
    // No defects section when jiraDefectIDs is undefined
    expect(screen.queryByTestId('aio-run-defects-section')).toBeNull();
  });

  it('clicking a defect row pushes the run page onto the breadcrumb trail before navigating', async () => {
    const { fetchAioTestRunDetail } = await import('@/services/aio');
    const { fetchJiraIssueByKey } = await import('@/services/jira');
    (fetchAioTestRunDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      run: {
        id: '263794',
        status: 'FAIL',
        testCaseKey: 'ESHOP-TC-8477',
        cycleKey: 'ESHOP-CY-1011',
        executedDate: '2026-05-01T10:00:00Z',
        jiraDefectIDs: [186227],
      },
      steps: [],
    });
    (fetchJiraIssueByKey as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: 'VTE-186227',
      fields: {
        summary: 'Login regression',
        status: { name: 'Open', statusCategory: { key: 'new' } },
        assignee: null,
        reporter: null,
        priority: null,
        customfield_13415: null,
        issuetype: { name: 'Bug' },
      },
    });

    // Trail is empty — simulates arriving at the run page directly (no prior breadcrumb).
    useBreadcrumbStore.setState({ trail: [] });

    renderAt('/aio-cycle/ESHOP/ESHOP-CY-1011/run/263794');

    // Wait for the defects section and the resolved defect key to appear.
    await waitFor(() => {
      expect(screen.getByTestId('aio-run-defects-section')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText('VTE-186227')).toBeTruthy();
    });

    // Click the defect row (role=button).
    const defectRow = screen.getByRole('button', { name: 'Open defect VTE-186227' });
    await userEvent.click(defectRow);

    // The breadcrumb trail must now contain the run page so the user can go back.
    const trail = useBreadcrumbStore.getState().trail;
    expect(trail).toHaveLength(1);
    expect(trail[0].label).toBe('Run 263794');
    expect(trail[0].path).toMatch(/aio-cycle\/ESHOP\/ESHOP-CY-1011\/run\/263794/);
  });
});
