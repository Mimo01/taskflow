import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { refreshReleaseList } from './release-refresh';

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
