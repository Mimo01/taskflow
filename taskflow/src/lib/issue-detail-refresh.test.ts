import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { refreshIssueDetail } from './issue-detail-refresh';

describe('refreshIssueDetail', () => {
  const BASE = 'https://jira.example';
  function harness() {
    const resolvers: (() => void)[] = [];
    const invalidateQueries = vi.fn(
      (_f: { queryKey?: unknown[]; predicate?: (q: { queryKey: unknown[] }) => boolean }) =>
        new Promise<void>((res) => resolvers.push(res)),
    );
    return { invalidateQueries, resolvers, qc: { invalidateQueries } as unknown as QueryClient };
  }

  it('invalidates the issue first and dependents only after it resolves', async () => {
    const { invalidateQueries, resolvers, qc } = harness();
    let done = false;
    const p = refreshIssueDetail(qc, { issueKey: 'PROJ-1', jiraBaseUrl: BASE }).then(() => {
      done = true;
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries.mock.calls[0][0].queryKey).toEqual([
      'jira-issue-detail',
      'PROJ-1',
      BASE,
    ]);
    await Promise.resolve();
    await Promise.resolve();
    expect(invalidateQueries).toHaveBeenCalledTimes(1);

    for (const r of resolvers.splice(0)) r();
    await vi.waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(12));
    const keys = invalidateQueries.mock.calls
      .slice(1)
      .map((c) => c[0].queryKey)
      .filter(Boolean);
    expect(keys).toEqual([
      ['jira-issue-comments', 'PROJ-1', BASE],
      ['jira-issue-changelog', 'PROJ-1', BASE],
      ['jira-worklogs', 'PROJ-1', BASE],
      ['jira-subtask-enrichment', 'PROJ-1', BASE],
      ['jira-epic-stories', 'PROJ-1', BASE],
      ['jira-parent-detail'],
      ['jira-epic-worklogs', 'PROJ-1'],
      ['jira-epic-status-history', 'PROJ-1'],
      ['jira-issue-transitions-fields', 'PROJ-1'],
      ['aio', BASE, 'issue-steps', 'PROJ-1'],
    ]);
    expect(done).toBe(false);
    for (const r of resolvers.splice(0)) r();
    await p;
    expect(done).toBe(true);
  });

  it('scopes the linked-MR predicate to this issue', async () => {
    const { invalidateQueries, resolvers, qc } = harness();
    const p = refreshIssueDetail(qc, { issueKey: 'PROJ-1', jiraBaseUrl: BASE });
    for (const r of resolvers.splice(0)) r();
    await vi.waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(12));
    const predicate = invalidateQueries.mock.calls.map((c) => c[0].predicate).find(Boolean);
    expect(predicate).toBeDefined();
    expect(predicate?.({ queryKey: ['gitlab-issue-linked-mrs', 'https://gl', 7, 'PROJ-1'] })).toBe(
      true,
    );
    expect(predicate?.({ queryKey: ['gitlab-issue-linked-mrs', 'https://gl', 7, 'PROJ-2'] })).toBe(
      false,
    );
    expect(predicate?.({ queryKey: ['jira-issue-detail', 'PROJ-1', BASE] })).toBe(false);
    for (const r of resolvers.splice(0)) r();
    await p;
  });
});
