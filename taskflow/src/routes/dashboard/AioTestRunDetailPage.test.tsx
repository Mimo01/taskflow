import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));
vi.mock('@/services/aio', () => ({
  fetchAioTestRunDetail: vi.fn(),
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
        { id: 2, step: 'Submit form', expectedResult: 'OK', actualResult: '', status: 'NOT_EXECUTED' },
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
});
