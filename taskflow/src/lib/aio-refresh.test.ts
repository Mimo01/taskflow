import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { refreshAioCycleDetail, refreshAioCycleList } from './aio-refresh';

const BASE = 'https://jira.example';

function setup() {
  const qc = new QueryClient();
  const calls: {
    filters: { queryKey?: unknown[]; predicate?: (q: unknown) => boolean };
    resolve: () => void;
  }[] = [];
  vi.spyOn(qc, 'invalidateQueries').mockImplementation(((filters: never) => {
    return new Promise<void>((resolve) => {
      calls.push({ filters, resolve });
    });
  }) as never);
  return { qc, calls };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('refreshAioCycleList', () => {
  it('runs three awaited stages in order', async () => {
    const { qc, calls } = setup();
    const p = refreshAioCycleList(qc, BASE, 'PK');
    await tick();
    expect(calls.map((c) => c.filters.queryKey?.[2])).toEqual([
      'folders',
      'cycle-count',
      'project-config',
    ]);
    for (const c of calls) c.resolve();
    await tick();
    expect(calls).toHaveLength(4);
    expect(calls[3].filters.queryKey).toEqual(['aio', BASE, 'cycles-detail', 'PK']);
    calls[3].resolve();
    await tick();
    expect(calls).toHaveLength(5);
    expect(calls[4].filters.queryKey).toEqual(['aio', BASE, 'cycle-summaries', 'PK']);
    calls[4].resolve();
    await p;
  });
});

describe('refreshAioCycleDetail', () => {
  it('invalidates derived queries only after upstream, and scopes defects to fresh runs', async () => {
    const { qc, calls } = setup();
    const p = refreshAioCycleDetail(qc, { jiraBaseUrl: BASE, projectKey: 'PK', cycleKey: 'CY-1' });
    await tick();
    expect(calls.map((c) => c.filters.queryKey?.[2])).toEqual([
      'cycle-detail',
      'runs',
      'status-map-init',
    ]);
    qc.setQueryData(
      ['aio', BASE, 'runs', 'PK', 'CY-1'],
      [{ jiraDefectIDs: [101, 202] }, { jiraDefectIDs: [] }],
    );
    for (const c of calls.slice()) c.resolve();
    await tick();
    expect(calls).toHaveLength(6);
    expect(calls[3].filters.queryKey).toEqual(['aio', BASE, 'cycle-summaries', 'PK']);
    expect(calls[4].filters.queryKey).toEqual(['aio', BASE, 'cycle-step-summary', 'PK']);
    const defect = calls[5].filters;
    expect(defect.queryKey).toEqual(['jira', BASE, 'issue-lightweight']);
    const match = (id: string) =>
      defect.predicate?.({ queryKey: ['jira', BASE, 'issue-lightweight', id] });
    expect(match('101')).toBe(true);
    expect(match('999')).toBe(false);
    for (const c of calls) c.resolve();
    await p;
  });

  it('skips the defect invalidation when there are no defect ids', async () => {
    const { qc, calls } = setup();
    const p = refreshAioCycleDetail(qc, { jiraBaseUrl: BASE, projectKey: 'PK', cycleKey: 'CY-1' });
    await tick();
    for (const c of calls.slice()) c.resolve();
    await tick();
    expect(calls).toHaveLength(5);
    expect(calls.some((c) => c.filters.queryKey?.[0] === 'jira')).toBe(false);
    for (const c of calls) c.resolve();
    await p;
  });
});
