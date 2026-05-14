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
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('fake-token'),
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
};

const mockRuns = [
  {
    id: 'run-1',
    status: 'PASS',
    testCaseKey: 'PROJ-TC-1',
    cycleKey: 'PROJ-CY-2',
    testCase: { title: 'Login test', updatedDate: '2024-01-01' },
    defects: [],
  },
  {
    id: 'run-2',
    status: 'FAIL',
    testCaseKey: 'PROJ-TC-2',
    cycleKey: 'PROJ-CY-2',
    testCase: { title: 'Checkout test', updatedDate: '2024-01-02' },
    defects: ['PROJ-42'],
  },
  {
    id: 'run-3',
    status: 'NOT_EXECUTED',
    testCaseKey: 'PROJ-TC-3',
    cycleKey: 'PROJ-CY-2',
    testCase: { title: 'Signup test', updatedDate: '2024-01-03' },
    defects: [],
  },
];

// Live import — will fail with "Cannot find module" until Wave 1 creates the component.
// This is the expected RED state for Wave 0.
import AioCycleDetailPage from './AioCycleDetailPage';

describe('AioCycleDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPinnedKeys = [];
  });

  it('renders AioCycleDetailPage without crashing', async () => {
    const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
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
      expect(screen.getByText('Sprint 2')).toBeDefined();
    });
  });

  describe('progress bar', () => {
    it('shows pass/fail/blocked/not-run counts from test runs', async () => {
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
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
        expect(screen.getByText(/Pass: 1/)).toBeDefined();
        expect(screen.getByText(/Fail: 1/)).toBeDefined();
        expect(screen.getByText(/Not Run: 1/)).toBeDefined();
      });
    });

    it('shows "No runs recorded" when runs array is empty', async () => {
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
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
        expect(screen.getByText('No runs recorded')).toBeDefined();
      });
    });

    it('percentages sum to 100 when all runs accounted for', async () => {
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      // 2 pass, 2 fail = 50% each
      const evenRuns = [
        { id: 'r1', status: 'PASS', testCaseKey: 'TC-1', cycleKey: 'PROJ-CY-2', defects: [] },
        { id: 'r2', status: 'PASS', testCaseKey: 'TC-2', cycleKey: 'PROJ-CY-2', defects: [] },
        { id: 'r3', status: 'FAIL', testCaseKey: 'TC-3', cycleKey: 'PROJ-CY-2', defects: [] },
        { id: 'r4', status: 'FAIL', testCaseKey: 'TC-4', cycleKey: 'PROJ-CY-2', defects: [] },
      ];
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(evenRuns);
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
        expect(screen.getByText(/Pass: 2 \(50%\)/)).toBeDefined();
        expect(screen.getByText(/Fail: 2 \(50%\)/)).toBeDefined();
      });
    });
  });

  describe('filter chips', () => {
    it('all four chips are active by default', async () => {
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
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
        const chips = screen.getAllByRole('switch');
        expect(chips).toHaveLength(4);
        chips.forEach((chip) => {
          expect(chip.getAttribute('aria-checked')).toBe('true');
        });
      });
    });

    it('toggling Fail chip off hides Fail-status rows from the run list', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
      render(
        <QueryClientProvider client={makeClient()}>
          <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
            <Routes>
              <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
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
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
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

  describe('defects section', () => {
    it('renders deduplicated Jira issue keys as NavLinks when runs have defects', async () => {
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
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
        const link = screen.getByText('PROJ-42');
        expect(link).toBeDefined();
        expect(link.closest('a')?.getAttribute('href')).toBe('/issue/PROJ-42');
      });
    });

    it('hides defects section when no runs have non-empty defects array', async () => {
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      const runsNoDefects = mockRuns.map((r) => ({ ...r, defects: [] }));
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(runsNoDefects);
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
        // Data should be loaded (check a run title)
        expect(screen.getByText('Login test')).toBeDefined();
      });
      expect(screen.queryByText('Defects')).toBeNull();
    });
  });

  describe('pin button', () => {
    it('reads "Pin cycle" when cycle is not pinned', async () => {
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
      mockPinnedKeys = [];
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
        expect(screen.getByRole('button', { name: /Pin cycle/ })).toBeDefined();
      });
    });

    it('reads "Unpin cycle" when cycle is pinned', async () => {
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
      mockPinnedKeys = ['PROJ-CY-2'];
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
        expect(screen.getByRole('button', { name: /Unpin cycle/ })).toBeDefined();
      });
    });

    it('clicking Pin button calls togglePin and setPinnedCycleMeta', async () => {
      const user = userEvent.setup();
      const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
      (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
      (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
      mockPinnedKeys = [];
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockPinnedKeys = [];
    mockBreadcrumbPush.mockReset();
  });

  it('renders Executions tab as default active with run table inside', async () => {
    const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
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
    const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
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
      expect(screen.getByTestId('defects-tab-placeholder')).toBeDefined();
    });
  });

  it('D-08: clicking a run row navigates to /aio-cycle/PROJ/PROJ-CY-2/run/{run.id} and pushes breadcrumb', async () => {
    const user = userEvent.setup();
    const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
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
    const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
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
    const { fetchAioCycleDetail, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycleDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockCycle);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);
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
