import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexChildToWeek, type RmWeek } from '@/lib/deployment-package';
import { bulkUpdateIssue, fetchDeploymentPackageEditShape } from '@/services/jira';
import { useDeploymentPackageSync } from './useDeploymentPackageSync';

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

describe('useDeploymentPackageSync', () => {
  beforeEach(() => {
    vi.mocked(bulkUpdateIssue).mockReset().mockResolvedValue(undefined);
    vi.mocked(fetchDeploymentPackageEditShape).mockReset().mockResolvedValue('single');
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={makeClient()}>{children}</QueryClientProvider>
  );

  it('applies a set-package fix with the editmeta shape', async () => {
    const stories = [story('S-1'), story('S-2', 'RM-11')];
    const { result } = renderHook(
      () => useDeploymentPackageSync({ version, stories, projectVersions: [] }),
      { wrapper },
    );
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

  it('turns a 403 on a single fix into a readable message', async () => {
    vi.mocked(bulkUpdateIssue).mockRejectedValue(
      Object.assign(new Error('Failed to update S-1'), { status: 403 }),
    );
    const stories = [story('S-1')];
    const { result } = renderHook(
      () => useDeploymentPackageSync({ version, stories, projectVersions: [] }),
      { wrapper },
    );
    await expect(
      act(() =>
        result.current.applyFix(stories[0], {
          kind: 'set-package',
          childKey: 'RM-11',
          childSummary: 'Core deployment',
        }),
      ),
    ).rejects.toThrow("You don't have permission to edit S-1.");
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
