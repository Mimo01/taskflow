// Quick 261014-eym: derived Deployment package chip on the Releases tab.

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
  fetchVersionIssueCounts: vi.fn().mockResolvedValue({ issuesFixed: 0, issuesTotal: 0 }),
  listJiraProjects: vi.fn(),
}));
vi.mock('@/services/gitlab', () => ({
  fetchProjectMilestonesInRange: vi.fn().mockResolvedValue([]),
  fetchProjectBranches: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/releaseLinker', () => ({
  matchGitLabToFixVersion: vi
    .fn()
    .mockReturnValue({ type: 'none', candidateName: '', candidateUrl: '' }),
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: 'https://gitlab.example.com',
    activeGitlabProject: 42,
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
      { id: 'v1', name: 'R-43', releaseDate: '2026-10-22', released: false },
    ]);
    vi.mocked(listJiraProjects).mockResolvedValue([{ id: '1', key: 'PROJ', name: 'Core' }]);
  });

  it('shows no package chip without an RM project', async () => {
    rm.enabled = false;
    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderTab(<ReleasesTab />);
    await screen.findByText('R-43');
    expect(screen.queryByTestId('row-deployment-package')).toBeNull();
    expect(screen.queryByTestId('row-sync-packages')).toBeNull();
  });

  it('shows the derived RM child for the release-date week', async () => {
    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderTab(<ReleasesTab />);
    await waitFor(() =>
      expect(screen.getByTestId('row-deployment-package').textContent).toBe(
        'Week 43 (19.10.2026 – 25.10.2026) RM-11',
      ),
    );
    // regression guard: the bulk sync button is gone even with RM enabled
    expect(screen.queryByTestId('row-sync-packages')).toBeNull();
  });
});
