import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  MR_CHANNEL_QUERY_PREFIXES,
  mrChannelKeys,
} from '../routes/dashboard/release-detail/mrChannelKeys';
import { refreshReleaseDetail, refreshReleaseList } from './release-refresh';

describe('refreshReleaseDetail', () => {
  function harness() {
    const resolvers: (() => void)[] = [];
    const invalidateQueries = vi.fn(
      (_f: { queryKey: unknown[] }) => new Promise<void>((res) => resolvers.push(res)),
    );
    return { invalidateQueries, resolvers, qc: { invalidateQueries } as unknown as QueryClient };
  }
  const GITLAB = [
    'gitlab-project',
    'gitlab-branch',
    'gitlab-release-tags',
    'gitlab-mr-source-branch',
    'gitlab-compare',
  ];

  it('invalidates upstream first, dependents after, resolves after stage 2', async () => {
    const { invalidateQueries, resolvers, qc } = harness();
    let done = false;
    const p = refreshReleaseDetail(qc, {
      activeJiraProject: 'PROJ',
      activeGitlabProject: 7,
      versionId: '123',
    }).then(() => {
      done = true;
    });
    expect(invalidateQueries.mock.calls.map((c) => c[0].queryKey)).toEqual([
      ['jira-fix-versions', 'PROJ'],
      ['gitlab-milestones', 7],
    ]);
    await Promise.resolve();
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    for (const r of resolvers.splice(0)) r();
    await vi.waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(2 + 1 + 3 + 5));
    const stage2 = invalidateQueries.mock.calls.slice(2).map((c) => c[0].queryKey);
    expect(stage2).toContainEqual(['jira-fixversion-issues', '123']);
    for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
      expect(stage2).toContainEqual(mrChannelKeys.channelForProject(prefix, 7));
    }
    for (const k of GITLAB) expect(stage2).toContainEqual([k, 7]);
    expect(done).toBe(false);
    for (const r of resolvers.splice(0)) r();
    await p;
    expect(done).toBe(true);
  });

  it('skips gitlab keys when no gitlab project', async () => {
    const { invalidateQueries, resolvers, qc } = harness();
    const p = refreshReleaseDetail(qc, {
      activeJiraProject: 'PROJ',
      activeGitlabProject: null,
      versionId: '1',
    });
    for (const r of resolvers.splice(0)) r();
    await vi.waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(2));
    for (const r of resolvers.splice(0)) r();
    await p;
    expect(JSON.stringify(invalidateQueries.mock.calls).toLowerCase()).not.toContain('gitlab');
  });
});

describe('refreshReleaseList', () => {
  it('invalidates sources first and dependents only after they settle', async () => {
    const events: string[] = [];
    const resolvers: (() => void)[] = [];
    const invalidateQueries = vi.fn((f: { queryKey: unknown[] }) => {
      const k = JSON.stringify(f.queryKey);
      events.push(`start:${k}`);
      return new Promise<void>((res) => {
        resolvers.push(() => {
          events.push(`end:${k}`);
          res();
        });
      });
    });
    const qc = { invalidateQueries } as unknown as QueryClient;

    let done = false;
    const p = refreshReleaseList(qc, 'PROJ').then(() => {
      done = true;
    });

    expect(invalidateQueries.mock.calls.map((c) => c[0].queryKey)).toEqual([
      ['jira-fix-versions', 'PROJ'],
      ['rm-week-list'],
      ['jira-projects-rm'],
    ]);
    await Promise.resolve();
    expect(invalidateQueries).toHaveBeenCalledTimes(3);

    for (const r of resolvers.splice(0)) r();
    await vi.waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(5));
    expect(invalidateQueries.mock.calls.slice(3).map((c) => c[0].queryKey)).toEqual([
      ['rm-week-children'],
      ['jira-version-counts', 'batch'],
    ]);
    expect(done).toBe(false);

    for (const r of resolvers.splice(0)) r();
    await p;
    expect(done).toBe(true);
    const all = JSON.stringify(invalidateQueries.mock.calls);
    expect(all.toLowerCase()).not.toContain('gitlab');
  });
});
