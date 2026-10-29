import type { QueryClient } from '@tanstack/react-query';
import type { AioTestRun } from '@/services/aio';

type Base = string | null | undefined;

/**
 * Refresh the AIO Test cycles page. Upstream-first: the cycle list needs the folder
 * tree / counts / project config, and the summaries are keyed by the cycle IDs that
 * the list returns. Invalidating them in parallel would refetch against stale inputs,
 * so each stage is awaited before the next one starts.
 */
export async function refreshAioCycleList(
  queryClient: QueryClient,
  jiraBaseUrl: Base,
  projectKey: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'folders', projectKey] }),
    queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'cycle-count', projectKey] }),
    queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'project-config', projectKey] }),
  ]);
  await queryClient.invalidateQueries({
    queryKey: ['aio', jiraBaseUrl, 'cycles-detail', projectKey],
  });
  await queryClient.invalidateQueries({
    queryKey: ['aio', jiraBaseUrl, 'cycle-summaries', projectKey],
  });
}

/**
 * Refresh the AIO cycle detail page. Stage 1 refetches cycle, runs and status map;
 * stage 2 refetches derived data (summaries, step summary, Jira defects). Defects are
 * keyed by the NUMERIC Jira ids in runs[].jiraDefectIDs (see issue-lightweight-cache.ts),
 * so the fresh runs are read from the cache after stage 1 settles.
 */
export async function refreshAioCycleDetail(
  queryClient: QueryClient,
  args: { jiraBaseUrl: Base; projectKey: string; cycleKey: string },
): Promise<void> {
  const { jiraBaseUrl, projectKey, cycleKey } = args;
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['aio', jiraBaseUrl, 'cycle-detail', projectKey, cycleKey],
    }),
    queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey] }),
    queryClient.invalidateQueries({
      queryKey: ['aio', jiraBaseUrl, 'status-map-init', projectKey],
    }),
  ]);

  const runs = queryClient.getQueryData<AioTestRun[]>([
    'aio',
    jiraBaseUrl,
    'runs',
    projectKey,
    cycleKey,
  ]);
  const defectIds = new Set<string>();
  for (const run of runs ?? []) {
    for (const id of run.jiraDefectIDs ?? []) {
      if (id !== null && id !== undefined && String(id) !== '') defectIds.add(String(id));
    }
  }

  const stage2: Promise<void>[] = [
    queryClient.invalidateQueries({
      queryKey: ['aio', jiraBaseUrl, 'cycle-summaries', projectKey],
    }),
    queryClient.invalidateQueries({
      queryKey: ['aio', jiraBaseUrl, 'cycle-step-summary', projectKey],
    }),
  ];
  if (defectIds.size > 0) {
    stage2.push(
      queryClient.invalidateQueries({
        queryKey: ['jira', jiraBaseUrl, 'issue-lightweight'],
        predicate: (query) => defectIds.has(String(query.queryKey[3])),
      }),
    );
  }
  await Promise.all(stage2);
}
