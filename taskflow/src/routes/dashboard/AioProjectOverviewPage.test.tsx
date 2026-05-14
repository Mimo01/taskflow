import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
