import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexChildToWeek, type RmWeek } from '@/lib/deployment-package';
import type { JiraIssue } from '@/services/jira';
import { DeploymentPackageSection } from './DeploymentPackageSection';

const week43: RmWeek = {
  key: 'RM-1',
  summary: 'WEEK43 (19.10.2026 - 25.10.2026)',
  weekNo: 43,
  start: '2026-10-19',
  end: '2026-10-25',
  children: [{ key: 'RM-11', summary: 'Core deployment' }],
};
const week44: RmWeek = {
  key: 'RM-2',
  summary: 'WEEK44 (26.10.2026 - 01.11.2026)',
  weekNo: 44,
  start: '2026-10-26',
  end: '2026-11-01',
  children: [{ key: 'RM-21', summary: 'Core deployment' }],
};
const rm = {
  weeks: [week43, week44],
  childToWeek: indexChildToWeek([week43, week44]),
  enabled: true,
  isLoading: false,
  isError: false,
};
const applyFix = vi.fn();

vi.mock('@/hooks/useRmWeekIndex', () => ({ useRmWeekIndex: () => rm }));
vi.mock('./useDeploymentPackageSync', () => ({
  useDeploymentPackageSync: () => ({ applyFix }),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));
const orphans = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/services/jira', () => ({
  fetchStoriesWithPackageNoFixVersion: orphans.fetch,
  fetchFixVersions: vi.fn().mockResolvedValue([
    { id: '1', name: 'R-43', releaseDate: '2026-10-22', released: false },
    { id: '2', name: 'R-44', releaseDate: '2026-10-29', released: false },
  ]),
}));

const v44 = { id: '2', name: 'R-44', releaseDate: '2026-10-29' };
const issue = (key: string, type: string, pkg: unknown, fixVersions: unknown[]) =>
  ({
    id: key,
    key,
    fields: {
      summary: `Summary ${key}`,
      issuetype: { name: type, subtask: false },
      project: { id: '1', key: 'PROJ', name: 'Core' },
      customfield_15725: pkg,
      fixVersions,
    },
  }) as unknown as JiraIssue;

function renderSection(stories: JiraIssue[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenIssue = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <DeploymentPackageSection
        stories={stories}
        version={{ releaseDate: '2026-10-29' }}
        jiraBaseUrl="https://jira.example.com"
        activeJiraProject="PROJ"
        onOpenIssue={onOpenIssue}
      />
    </QueryClientProvider>,
  );
  return { onOpenIssue };
}

describe('DeploymentPackageSection', () => {
  beforeEach(() => {
    rm.enabled = true;
    applyFix.mockReset().mockResolvedValue(undefined);
    orphans.fetch.mockReset().mockResolvedValue([]);
  });

  it('renders nothing without an RM project', () => {
    rm.enabled = false;
    renderSection([issue('S-1', 'Story', null, [v44])]);
    expect(screen.queryByTestId('deployment-package-section')).toBeNull();
  });

  it('renders nothing when no Story drifts (Epics ignored, in-sync Stories skipped)', async () => {
    renderSection([issue('E-1', 'Epic', null, [v44]), issue('S-2', 'Story', 'RM-21', [v44])]);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('deployment-package-section')).toBeNull();
  });

  it('lists drifted Stories only and runs the row fix', async () => {
    renderSection([
      issue('S-1', 'Story', null, [v44]),
      issue('S-2', 'Story', 'RM-21', [v44]),
      issue('E-1', 'Epic', null, [v44]),
    ]);
    expect(await screen.findByText('Summary S-1')).toBeInTheDocument();
    expect(screen.queryByText('Summary S-2')).toBeNull();
    expect(screen.queryByText('Summary E-1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /set deployment package to .*RM-21/i }));
    await waitFor(() =>
      expect(applyFix).toHaveBeenCalledWith(expect.objectContaining({ key: 'S-1' }), {
        kind: 'set-package',
        childKey: 'RM-21',
        childSummary: 'Core deployment',
        weekSummary: 'WEEK44 (26.10.2026 - 01.11.2026)',
      }),
    );
  });

  it('shows the error from a failed fix', async () => {
    applyFix.mockRejectedValue(new Error('Field not on screen'));
    renderSection([issue('S-1', 'Story', null, [v44])]);
    fireEvent.click(await screen.findByRole('button', { name: /set deployment package/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Field not on screen');
  });
  it('lists a story that has a package of the release week but no fix version', async () => {
    orphans.fetch.mockResolvedValue([issue('S-9', 'Story', 'RM-21', [])]);
    renderSection([]);
    expect(await screen.findByText('Summary S-9')).toBeInTheDocument();
    expect(screen.getByText('No fix version')).toBeInTheDocument();
    expect(orphans.fetch).toHaveBeenCalledWith('https://jira.example.com', 'tok', 'PROJ', [
      'RM-21',
    ]);
    expect(screen.getByRole('button', { name: /set fix version to R-44/i })).toBeInTheDocument();
  });

  it('does not duplicate a story already in the release list', async () => {
    orphans.fetch.mockResolvedValue([issue('S-1', 'Story', 'RM-21', [])]);
    renderSection([issue('S-1', 'Story', 'RM-21', [])]);
    await screen.findByText('Summary S-1');
    expect(screen.getAllByText('Summary S-1')).toHaveLength(1);
  });
});
