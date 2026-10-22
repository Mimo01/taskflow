import { useQueries } from '@tanstack/react-query';
import pLimit from 'p-limit';
import { aggregateStepStats, type StepStatsTotals } from '@/lib/aio-step-stats';
import { type AioTestRun, fetchAioTestRunDetail } from '@/services/aio';

// Dedicated AIO step limiter, deliberately NOT getJiraLimit(): a few hundred step
// fetches queued on the shared Jira limiter would starve Jira calls (defect resolution etc.).
const stepLimit = pLimit(4);

export type CycleStepStats = StepStatsTotals & { loading: boolean };

/**
 * Step-level totals for a cycle. No bulk/cycle-level step endpoint exists, so this
 * issues one run-detail query per run, throttled to 4 concurrent requests. The query
 * key and fetcher match AioTestRunDetailPage so both share one cache entry; step data
 * therefore ages on the shared 5-min staleTime, independent of the runs list.
 * Only the step tiles wait on `loading`; case counts and charts never do.
 */
export function useCycleStepStats({
  runs,
  projectKey,
  cycleKey,
  jiraBaseUrl,
  token,
  tokenLoading,
}: {
  runs: AioTestRun[] | undefined;
  projectKey: string | undefined;
  cycleKey: string | undefined;
  jiraBaseUrl: string | null | undefined;
  token: string | null | undefined;
  tokenLoading: boolean;
}): CycleStepStats {
  const enabled = !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey && !!cycleKey;
  const ids = (runs ?? []).filter((r) => !!r.id).map((r) => r.id);
  return useQueries({
    queries: ids.map((runId) => ({
      queryKey: ['aio', jiraBaseUrl, 'run-detail', projectKey, cycleKey, runId],
      queryFn: () =>
        stepLimit(() =>
          fetchAioTestRunDetail(
            jiraBaseUrl ?? '',
            token ?? '',
            projectKey ?? '',
            cycleKey ?? '',
            runId,
          ),
        ),
      enabled,
    })),
    combine: (results) => ({
      ...aggregateStepStats(results),
      loading: runs === undefined || !enabled || results.some((r) => r.isPending),
    }),
  });
}
