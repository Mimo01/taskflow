import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexChildToWeek, type PackageEditShape, type RmWeek } from '@/lib/deployment-package';
import { bulkUpdateIssue, fetchDeploymentPackageEditShape } from '@/services/jira';
import { executeDeploymentPackageSync, useDeploymentPackageSync } from './useDeploymentPackageSync';

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
const weeks = [week43, week44];

vi.mock('@/hooks/useRmWeekIndex', () => ({
  useRmWeekIndex: () => ({
    weeks,
    childToWeek: indexChildToWeek(weeks),
    enabled: true,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (sel: (s: { jiraBaseUrl: string }) => unknown) =>
    sel({ jiraBaseUrl: 'https://jira.example.com' }),
}));
vi.mock('@/services/jira', () => ({
  bulkUpdateIssue: vi.fn(),
  fetchDeploymentPackageEditShape: vi.fn(),
}));

const story = (key: string, pkg: unknown = null) => ({
  key,
  fields: { issuetype: { name: 'Story' }, project: { name: 'Core' }, customfield_15725: pkg },
});
const version = { releaseDate: '2026-10-22' };

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('executeDeploymentPackageSync', () => {
  beforeEach(() => {
    vi.mocked(bulkUpdateIssue).mockReset().mockResolvedValue(undefined);
    vi.mocked(fetchDeploymentPackageEditShape).mockReset().mockResolvedValue('array');
  });

  const run = (shape: PackageEditShape, stories = [story('S-1'), story('S-2')]) => {
    vi.mocked(fetchDeploymentPackageEditShape).mockResolvedValue(shape);
    const queryClient = makeClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    return {
      invalidate,
      promise: executeDeploymentPackageSync({
        queryClient,
        jiraBaseUrl: 'https://jira.example.com',
        token: 'tok',
        stories,
        version,
        weeks,
      }),
    };
  };

  it('blocks without writing when the field is not editable', async () => {
    const { promise } = run('not-editable');
    expect(await promise).toEqual({ blocked: true, results: [] });
    expect(bulkUpdateIssue).not.toHaveBeenCalled();
  });

  it('fetches the edit shape once and writes each planned story in the editmeta shape', async () => {
    const { promise } = run('array');
    const out = await promise;
    expect(fetchDeploymentPackageEditShape).toHaveBeenCalledTimes(1);
    expect(bulkUpdateIssue).toHaveBeenCalledTimes(2);
    expect(bulkUpdateIssue).toHaveBeenCalledWith('https://jira.example.com', 'tok', 'S-1', {
      customfield_15725: ['RM-11'],
    });
    expect(out.results.map((r) => r.ok)).toEqual([true, true]);
  });

  it('collects failures without aborting the loop, then invalidates', async () => {
    vi.mocked(bulkUpdateIssue)
      .mockRejectedValueOnce(new Error('Field not on screen'))
      .mockResolvedValueOnce(undefined);
    const { promise, invalidate } = run('single');
    const out = await promise;
    expect(out.results).toEqual([
      { key: 'S-1', ok: false, error: 'Field not on screen' },
      { key: 'S-2', ok: true },
    ]);
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey[0]);
    expect(keys).toEqual(['jira-fixversion-issues', 'jira-issue-detail']);
  });

  it('does nothing when every story is already in sync', async () => {
    const { promise } = run('array', [story('S-1', 'RM-11')]);
    expect(await promise).toEqual({ blocked: false, results: [] });
    expect(fetchDeploymentPackageEditShape).not.toHaveBeenCalled();
  });
});

describe('useDeploymentPackageSync', () => {
  beforeEach(() => {
    vi.mocked(bulkUpdateIssue).mockReset().mockResolvedValue(undefined);
    vi.mocked(fetchDeploymentPackageEditShape).mockReset().mockResolvedValue('single');
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={makeClient()}>{children}</QueryClientProvider>
  );

  it('exposes the plan and applies a set-package fix with the editmeta shape', async () => {
    const stories = [story('S-1'), story('S-2', 'RM-11')];
    const { result } = renderHook(
      () => useDeploymentPackageSync({ version, stories, projectVersions: [] }),
      { wrapper },
    );
    expect(result.current.plan.map((p) => p.key)).toEqual(['S-1']);
    await act(() =>
      result.current.applyFix(stories[0], {
        kind: 'set-package',
        childKey: 'RM-11',
        childSummary: 'Core deployment',
      }),
    );
    expect(bulkUpdateIssue).toHaveBeenCalledWith('https://jira.example.com', 'tok', 'S-1', {
      customfield_15725: 'RM-11',
    });
  });

  it('applies a set-fix-version fix, dropping stale dated versions', async () => {
    const s = {
      key: 'S-3',
      fields: {
        ...story('S-3', 'RM-11').fields,
        fixVersions: [{ id: '2', name: 'R-44', releaseDate: '2026-10-29' }],
      },
    };
    const { result } = renderHook(
      () => useDeploymentPackageSync({ version, stories: [s], projectVersions: [] }),
      { wrapper },
    );
    await act(() =>
      result.current.applyFix(s, { kind: 'set-fix-version', versionId: '1', versionName: 'R-43' }),
    );
    expect(bulkUpdateIssue).toHaveBeenCalledWith('https://jira.example.com', 'tok', 'S-3', {
      fixVersions: [{ id: '1' }],
    });
  });

  it('rejects a set-package fix when the field is not editable', async () => {
    vi.mocked(fetchDeploymentPackageEditShape).mockResolvedValue('not-editable');
    const stories = [story('S-1')];
    const { result } = renderHook(
      () => useDeploymentPackageSync({ version, stories, projectVersions: [] }),
      { wrapper },
    );
    await expect(
      result.current.applyFix(stories[0], {
        kind: 'set-package',
        childKey: 'RM-11',
        childSummary: 'x',
      }),
    ).rejects.toThrow(/not editable/i);
    expect(bulkUpdateIssue).not.toHaveBeenCalled();
  });
});
