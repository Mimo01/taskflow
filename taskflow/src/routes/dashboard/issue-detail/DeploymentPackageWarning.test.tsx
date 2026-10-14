import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexChildToWeek, type PackageEditShape, type RmWeek } from '@/lib/deployment-package';
import { openExternal } from '@/lib/openExternal';
import { DeploymentPackageWarning } from './DeploymentPackageWarning';

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
let editShape: PackageEditShape | undefined = 'array';
let direct: { child: undefined; week: RmWeek | null; isLoading: boolean } = {
  child: undefined,
  week: null,
  isLoading: false,
};

vi.mock('@/hooks/useRmWeekIndex', () => ({
  useRmWeekIndex: () => rm,
  useRmPackage: () => direct,
  useDeploymentPackageEditShape: () => ({ shape: editShape, isLoading: false }),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));
vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('@/services/jira/versions', () => ({
  fetchFixVersions: vi.fn().mockResolvedValue([
    { id: '1', name: 'R-43', releaseDate: '2026-10-22', released: false },
    { id: '2', name: 'R-44', releaseDate: '2026-10-29', released: false },
  ]),
}));

const v43 = { id: '1', name: 'R-43', releaseDate: '2026-10-22' };
const v44 = { id: '2', name: 'R-44', releaseDate: '2026-10-29' };

function setup(
  props: Partial<React.ComponentProps<typeof DeploymentPackageWarning>> = {},
  enabled = true,
) {
  rm.enabled = enabled;
  const mutate = vi.fn();
  const mutation = { mutate, isPending: false } as never;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DeploymentPackageWarning
        issueKey="PROJ-1"
        issueTypeName="Story"
        projectKey="PROJ"
        projectName="Core"
        pkgField={null}
        fixVersions={[]}
        mutation={mutation}
        jiraBaseUrl="https://jira.example.com"
        {...props}
      />
    </QueryClientProvider>,
  );
  return { mutate };
}

describe('DeploymentPackageWarning', () => {
  beforeEach(() => {
    editShape = 'array';
    direct = { child: undefined, week: null, isLoading: false };
    rm.weeks = [week43, week44];
    vi.mocked(openExternal).mockClear();
  });

  it('renders nothing when no RM project is configured', () => {
    setup({ fixVersions: [v44] }, false);
    expect(screen.queryByTestId('deployment-package-warning')).toBeNull();
  });

  it('renders nothing for non-Story issue types', () => {
    setup({ issueTypeName: 'Epic', fixVersions: [v44] });
    expect(screen.queryByTestId('deployment-package-warning')).toBeNull();
  });

  it('renders nothing when package and fix version agree', async () => {
    setup({ pkgField: { key: 'RM-11' }, fixVersions: [v43] });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('deployment-package-warning')).toBeNull();
  });

  it('fv-only: sets the deployment package in the editmeta shape', async () => {
    const { mutate } = setup({ fixVersions: [v44] });
    fireEvent.click(
      await screen.findByRole('button', { name: /set deployment package to .*RM-21/i }),
    );
    expect(mutate).toHaveBeenCalledWith({ fieldName: 'customfield_15725', value: ['RM-21'] });
  });

  it('writes a bare key when editmeta reports a single-value field', async () => {
    editShape = 'single';
    const { mutate } = setup({ fixVersions: [v44] });
    fireEvent.click(await screen.findByRole('button', { name: /set deployment package/i }));
    expect(mutate).toHaveBeenCalledWith({ fieldName: 'customfield_15725', value: 'RM-21' });
  });

  it('shows the target week as text next to a compact button', async () => {
    setup({ fixVersions: [v44] });
    const btn = await screen.findByRole('button', { name: /set deployment package/i });
    expect(btn.textContent).toBe('Apply');
    expect(btn.getAttribute('aria-label')).toBe(
      'Set deployment package to Week 44 (26.10.2026 – 01.11.2026) (RM-21)',
    );
    expect(screen.getByText('Package: Week 44 (26.10.2026 – 01.11.2026) (RM-21)')).toBeTruthy();
  });

  it('pkg-only: sets the fix version', async () => {
    const { mutate } = setup({ pkgField: 'RM-11', fixVersions: [] });
    fireEvent.click(await screen.findByRole('button', { name: /set fix version to R-43/i }));
    expect(mutate).toHaveBeenCalledWith({ fieldName: 'fixVersions', value: [{ id: '1' }] });
  });

  it('mismatch: shows both buttons and the fix-version write drops the stale version', async () => {
    const { mutate } = setup({ pkgField: ['RM-11'], fixVersions: [v44] });
    expect(await screen.findByRole('button', { name: /set deployment package/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /set fix version to R-43/i }));
    expect(mutate).toHaveBeenCalledWith({ fieldName: 'fixVersions', value: [{ id: '1' }] });
  });

  it('fast path: resolves the package week directly while the week index is still empty', async () => {
    rm.weeks = [];
    direct = { child: undefined, week: week43, isLoading: false };
    const { mutate } = setup({ pkgField: 'RM-11', fixVersions: [] });
    fireEvent.click(await screen.findByRole('button', { name: /set fix version to R-43/i }));
    expect(mutate).toHaveBeenCalledWith({ fieldName: 'fixVersions', value: [{ id: '1' }] });
  });

  it('embedded: the fallback is replaced by the warning when there is something to warn about', async () => {
    setup({ pkgField: 'RM-11', fixVersions: [], embedded: true, fallback: <span>FALLBACK</span> });
    await screen.findByTestId('deployment-package-warning');
    expect(screen.queryByText('FALLBACK')).toBeNull();
  });

  it('embedded: shows the fallback when there is nothing to warn about', async () => {
    setup({
      pkgField: 'RM-11',
      fixVersions: [v43],
      embedded: true,
      fallback: <span>FALLBACK</span>,
    });
    expect(await screen.findByText('FALLBACK')).toBeTruthy();
    expect(screen.queryByTestId('deployment-package-warning')).toBeNull();
  });

  it('unresolved: shows only the hint', async () => {
    setup({ pkgField: 'RM-999', fixVersions: [v43] });
    await waitFor(() => expect(screen.getByTestId('deployment-package-warning')).toBeTruthy());
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('not-editable: replaces the package button with an Open in Jira link', async () => {
    editShape = 'not-editable';
    const { mutate } = setup({ fixVersions: [v44] });
    fireEvent.click(await screen.findByRole('button', { name: /open in jira/i }));
    expect(openExternal).toHaveBeenCalledWith('https://jira.example.com/browse/PROJ-1');
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /set deployment package/i })).toBeNull();
  });
});
