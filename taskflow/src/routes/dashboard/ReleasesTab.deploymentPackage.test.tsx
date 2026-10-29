// Quick 261014-eym / Phase 93 D-12: derived Deployment package column on the Releases list.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexChildToWeek, type RmWeek } from '@/lib/deployment-package';

const week43: RmWeek = {
  key: 'RM-1',
  summary: 'WEEK43 (19.10.2026 - 25.10.2026)',
  weekNo: 43,
  start: '2026-10-19',
  end: '2026-10-25',
  children: [{ key: 'RM-11', summary: 'Core deployment' }],
};
const rm = {
  weeks: [week43],
  childToWeek: indexChildToWeek([week43]),
  enabled: true,
  isLoading: false,
  isError: false,
};

vi.mock('@/hooks/useRmWeekIndex', () => ({ useRmWeekIndex: () => rm }));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));
vi.mock('@/services/jira', () => ({
  fetchFixVersions: vi.fn(),
  fetchVersionsStatusBreakdown: vi.fn().mockResolvedValue({}),
  listJiraProjects: vi.fn(),
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  })),
}));

import { fetchFixVersions, listJiraProjects } from '@/services/jira';

function renderTab(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ReleasesTab deployment package', () => {
  beforeEach(() => {
    rm.enabled = true;
    vi.mocked(fetchFixVersions).mockResolvedValue([
      { id: '10001', name: 'R-43', releaseDate: '2026-10-22', released: false },
    ]);
    vi.mocked(listJiraProjects).mockResolvedValue([{ id: '1', key: 'PROJ', name: 'Core' }]);
  });

  it('hides the Package column and cells without an RM project (D-12)', async () => {
    rm.enabled = false;
    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderTab(<ReleasesTab />);
    await screen.findByText('R-43');
    expect(screen.queryByText('Package')).toBeNull();
    expect(screen.queryByTestId('row-deployment-package')).toBeNull();
  });

  it('shows the Package header and the derived RM child for the release-date week', async () => {
    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderTab(<ReleasesTab />);
    await screen.findByText('Package');
    await waitFor(() =>
      expect(screen.getByTestId('row-deployment-package').textContent).toBe(
        'Week 43 (19.10.2026 – 25.10.2026)RM-11',
      ),
    );
  });

  it('shows the week only when no child matches the project', async () => {
    vi.mocked(listJiraProjects).mockResolvedValue([{ id: '2', key: 'PROJ', name: 'Unrelated' }]);
    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderTab(<ReleasesTab />);
    await waitFor(() =>
      expect(screen.getByTestId('row-deployment-package').textContent).toBe(
        'Week 43 (19.10.2026 – 25.10.2026)',
      ),
    );
  });
});
