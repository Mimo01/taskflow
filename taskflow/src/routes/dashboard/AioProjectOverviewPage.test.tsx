import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
    const { fetchAioCycles } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'PROJ-CY-2', name: 'Sprint 1 Cycle', status: 'Active', projectKey: 'PROJ' },
    ]);
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
    const { fetchAioCycles } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockResolvedValue([]);
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
    const { fetchAioCycles } = await import('@/services/aio');
    (fetchAioCycles as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
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
