import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AioTestRun } from '@/services/aio';

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
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('AioProjectOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AION-03: renders a row for each cycle (key, name, status)', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'PROJ-CY-2', name: 'Sprint 1 Cycle', status: 'Active', projectKey: 'PROJ' },
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText('Sprint 1 Cycle')).toBeDefined();
      expect(screen.getByText('PROJ-CY-2')).toBeDefined();
      expect(screen.getByText('Active')).toBeDefined();
    });
  });

  it('AION-03: shows EmptyState when fetchAioCycles returns empty array', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText('No cycles found')).toBeDefined();
    });
  });

  it('AION-03: shows ErrorState when fetchAioCycles rejects', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("Couldn't load cycles")).toBeDefined();
    });
  });
});

describe('AION-03: per-row stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Progress column header', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'PROJ-CY-9', name: 'Cycle 9', status: 'Active', projectKey: 'PROJ' },
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('Progress')).toBeDefined());
  });

  it('shows loading skeleton in stats cell while runs query is pending', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'PROJ-CY-9', name: 'Cycle 9', status: 'Active', projectKey: 'PROJ' },
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('cycle-stats-loading')).toBeDefined());
  });

  it('shows per-row counts text formatted as {N}P {N}F {N}B {N}N once runs query resolves', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'PROJ-CY-9', name: 'Cycle 9', status: 'Active', projectKey: 'PROJ' },
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([
      { status: 'PASS' },
      { status: 'PASS' },
      { status: 'FAIL' },
      { status: 'BLOCKED' },
      { status: 'NOT_EXECUTED' },
    ] as unknown as AioTestRun[]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('2P 1F 1B 1N')).toBeDefined());
  });

  it('shows "No runs" text when fetchAioTestRunsForCycle returns empty array', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'PROJ-CY-9', name: 'Cycle 9', status: 'Active', projectKey: 'PROJ' },
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      const el = screen.getByTestId('cycle-stats-loaded');
      expect(el).toBeDefined();
      expect(el.textContent).toContain('No runs');
    });
  });

  it('renders error fallback ("—") when fetchAioTestRunsForCycle rejects', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'PROJ-CY-9', name: 'Cycle 9', status: 'Active', projectKey: 'PROJ' },
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fetch error'),
    );
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('cycle-stats-error')).toBeDefined());
    // Cycle row itself is still rendered
    expect(screen.getByText('Cycle 9')).toBeDefined();
  });

  it('uses query key prefix ["aio", jiraBaseUrl, "runs", projectKey, cycleKey] for per-row stats', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'PROJ-CY-9', name: 'X', status: 'Active', projectKey: 'PROJ' },
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('cycle-stats-loaded')).toBeDefined());
    expect(fetchAioTestRunsForCycle).toHaveBeenCalledWith(
      'https://jira.example.com',
      'test-jira-token',
      'PROJ',
      'PROJ-CY-9',
    );
  });
});

describe('Folder accordion + lazy stats (Gap 1+2)', () => {
  const cycleFolderA1 = {
    key: 'PROJ-CY-1',
    name: 'Cycle A1',
    status: 'Active',
    projectKey: 'PROJ',
    folder: 'Sprint 1',
  };
  const cycleFolderA2 = {
    key: 'PROJ-CY-2',
    name: 'Cycle A2',
    status: 'Active',
    projectKey: 'PROJ',
    folder: 'Sprint 1',
  };
  const cycleFolderB1 = {
    key: 'PROJ-CY-3',
    name: 'Cycle B1',
    status: 'Closed',
    projectKey: 'PROJ',
    folder: 'Sprint 2',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups cycles by folder.folder value — renders folder header buttons', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      cycleFolderA1,
      cycleFolderA2,
      cycleFolderB1,
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('folder-toggle-Sprint 1')).toBeDefined();
      expect(screen.getByTestId('folder-toggle-Sprint 2')).toBeDefined();
    });
  });

  it('first folder is expanded by default — renders its cycle rows, collapses others', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      cycleFolderA1,
      cycleFolderA2,
      cycleFolderB1,
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      // Sprint 1 cycles are visible (first folder expanded)
      expect(screen.getByText('Cycle A1')).toBeDefined();
      expect(screen.getByText('Cycle A2')).toBeDefined();
      // Sprint 2 cycle is NOT visible (collapsed)
      expect(screen.queryByText('Cycle B1')).toBeNull();
    });
  });

  it('CycleStatsCell fires useQuery only for cycles in the open folder — not for collapsed folder cycles', async () => {
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      cycleFolderA1,
      cycleFolderA2,
      cycleFolderB1,
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // Wait for Sprint 1 cycles to be visible and stats to load
    await waitFor(() => {
      expect(screen.getByText('Cycle A1')).toBeDefined();
    });
    // Stats were fetched for Sprint 1 cycles
    expect(fetchAioTestRunsForCycle).toHaveBeenCalledWith(
      'https://jira.example.com',
      'test-jira-token',
      'PROJ',
      'PROJ-CY-1',
    );
    expect(fetchAioTestRunsForCycle).toHaveBeenCalledWith(
      'https://jira.example.com',
      'test-jira-token',
      'PROJ',
      'PROJ-CY-2',
    );
    // Stats were NOT fetched for Sprint 2 cycle (collapsed)
    expect(fetchAioTestRunsForCycle).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'PROJ',
      'PROJ-CY-3',
    );
  });

  it('clicking collapsed folder header expands it and collapses the previous folder', async () => {
    const user = userEvent.setup();
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      cycleFolderA1,
      cycleFolderA2,
      cycleFolderB1,
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // Wait for data to load and Sprint 1 to be expanded by default
    await waitFor(() => {
      expect(screen.getByText('Cycle A1')).toBeDefined();
    });
    // Click Sprint 2 folder toggle
    await user.click(screen.getByTestId('folder-toggle-Sprint 2'));
    await waitFor(() => {
      // Sprint 2 cycle is now visible
      expect(screen.getByText('Cycle B1')).toBeDefined();
      // Sprint 1 cycles are no longer visible (collapsed)
      expect(screen.queryByText('Cycle A1')).toBeNull();
    });
    // Stats were fetched for Sprint 2 cycle after expansion
    expect(fetchAioTestRunsForCycle).toHaveBeenCalledWith(
      'https://jira.example.com',
      'test-jira-token',
      'PROJ',
      'PROJ-CY-3',
    );
  });

  it('clicking expanded folder header collapses it', async () => {
    const user = userEvent.setup();
    const { fetchAioCycles, fetchAioTestRunsForCycle } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      cycleFolderA1,
      cycleFolderA2,
      cycleFolderB1,
    ]);
    (fetchAioTestRunsForCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectOverviewPage } = await import('./AioProjectOverviewPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/aio-project/PROJ']}>
          <Routes>
            <Route path="/aio-project/:projectKey" element={<AioProjectOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // Wait for data to load and Sprint 1 to be expanded by default
    await waitFor(() => {
      expect(screen.getByText('Cycle A1')).toBeDefined();
    });
    // Click Sprint 1 folder toggle (currently expanded) to collapse it
    await user.click(screen.getByTestId('folder-toggle-Sprint 1'));
    await waitFor(() => {
      // Sprint 1 cycles are no longer visible
      expect(screen.queryByText('Cycle A1')).toBeNull();
      // Sprint 1 toggle has aria-expanded="false"
      expect(screen.getByTestId('folder-toggle-Sprint 1').getAttribute('aria-expanded')).toBe(
        'false',
      );
    });
  });
});
