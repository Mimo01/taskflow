import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
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
  fetchAioProjects: vi.fn(),
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('AioProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AION-02: renders a row for each AIO project (name and projectKey)', async () => {
    const { fetchAioProjects } = await import('@/services/aio');
    (fetchAioProjects as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, projectKey: 'PROJ', name: 'Project Alpha' },
    ]);
    const { default: AioProjectsPage } = await import('./AioProjectsPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<AioProjectsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(true).toBe(false);
  });

  it('AION-02: shows EmptyState when fetchAioProjects returns empty array', async () => {
    const { fetchAioProjects } = await import('@/services/aio');
    (fetchAioProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { default: AioProjectsPage } = await import('./AioProjectsPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<AioProjectsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(true).toBe(false);
  });

  it('AION-02: shows ErrorState when fetchAioProjects rejects', async () => {
    const { fetchAioProjects } = await import('@/services/aio');
    (fetchAioProjects as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    const { default: AioProjectsPage } = await import('./AioProjectsPage');
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<AioProjectsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(true).toBe(false);
  });
});
