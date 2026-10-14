// Quick 261014-eym: derived Deployment package chip + per-row bulk sync on the Releases tab.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  fetchFixVersionIssues: vi.fn(),
  bulkUpdateIssue: vi.fn(),
  fetchDeploymentPackageEditShape: vi.fn(),
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

import {
  bulkUpdateIssue,
  fetchDeploymentPackageEditShape,
  fetchFixVersionIssues,
  fetchFixVersions,
  listJiraProjects,
} from '@/services/jira';

const story = (key: string, pkg: unknown = null) =>
  ({
    key,
    fields: { issuetype: { name: 'Story' }, project: { name: 'Core' }, customfield_15725: pkg },
  }) as never;

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
    vi.mocked(fetchFixVersionIssues).mockResolvedValue([story('S-1'), story('S-2')]);
    vi.mocked(fetchDeploymentPackageEditShape).mockResolvedValue('array');
    vi.mocked(bulkUpdateIssue).mockReset().mockResolvedValue(undefined);
  });

  it('shows no package chip or sync action without an RM project', async () => {
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
  });

  it('confirms, writes per story and reports successes and failures', async () => {
    vi.mocked(bulkUpdateIssue)
      .mockRejectedValueOnce(new Error('403 forbidden'))
      .mockResolvedValueOnce(undefined);
    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderTab(<ReleasesTab />);
    await waitFor(() => expect(screen.getByTestId('row-sync-packages')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('row-sync-packages'));
    expect(await screen.findByText(/2 stories/)).toBeInTheDocument();
    expect(bulkUpdateIssue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    const status = await screen.findByTestId('package-sync-status');
    await waitFor(() => expect(status.textContent).toMatch(/1 updated, 1 failed/));
    // each failure on its own line, not a run-on sentence
    expect(screen.getByText('S-1: 403 forbidden').tagName).toBe('LI');
  });

  it('says so when everything is already in sync', async () => {
    vi.mocked(fetchFixVersionIssues).mockResolvedValue([story('S-1', 'RM-11')]);
    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderTab(<ReleasesTab />);
    await waitFor(() => expect(screen.getByTestId('row-sync-packages')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('row-sync-packages'));
    expect((await screen.findByTestId('package-sync-status')).textContent).toMatch(
      /already in sync/,
    );
  });

  it('refuses to sync (no dialog, no writes) when the field is not editable', async () => {
    vi.mocked(fetchDeploymentPackageEditShape).mockResolvedValue('not-editable');
    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderTab(<ReleasesTab />);
    await waitFor(() => expect(screen.getByTestId('row-sync-packages')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('row-sync-packages'));
    expect((await screen.findByTestId('package-sync-status')).textContent).toMatch(/not editable/i);
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(bulkUpdateIssue).not.toHaveBeenCalled();
  });
});
