import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAioCredentials } from '@/hooks/useAioCredentials';
import { initializeAioStatusMap, normalizeStatus, normalizeStatusById } from '@/lib/aioUtils';
import type { AioCycle, AioCycleSummaryItem, AioTestRun } from '@/services/aio';
import {
  fetchAioCycleDetail,
  fetchAioCycleSummaries,
  fetchAioCycleTestCasesWithRuns,
} from '@/services/aio';
import { fetchJiraProjectNumericId } from '@/services/jira/projects';
import { useAuthStore } from '@/stores/auth.store';

export interface AioStatusCounts {
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
  inProgress: number;
}

const ZERO_COUNTS: AioStatusCounts = { pass: 0, fail: 0, blocked: 0, notRun: 0, inProgress: 0 };

/**
 * Shared AIO cycle queries (cycle-detail, project-numeric-id, status-map-init,
 * cycle-summaries, runs) plus derived status counts. Query keys are shared with
 * AioProjectOverviewPage so the cache is reused.
 */
export function useAioCycleData(projectKey: string | undefined, cycleKey: string | undefined) {
  const { jiraBaseUrl } = useAuthStore();
  const { token, isLoading: tokenLoading } = useAioCredentials();

  // Credential gate — must include !tokenLoading to prevent first-load 401 flash (Pitfall 6)
  const credGate = !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey && !!cycleKey;

  const cycleQuery = useQuery<AioCycle>({
    queryKey: ['aio', jiraBaseUrl, 'cycle-detail', projectKey, cycleKey],
    queryFn: () =>
      fetchAioCycleDetail(jiraBaseUrl ?? '', token ?? '', projectKey ?? '', cycleKey ?? ''),
    enabled: credGate,
  });

  // Resolve numeric Jira project ID — required for fetchAioCycleSummaries (AIO paged endpoint)
  const jiraProjectIdQuery = useQuery({
    queryKey: ['jira', jiraBaseUrl, 'project-numeric-id', projectKey],
    queryFn: () => fetchJiraProjectNumericId(jiraBaseUrl ?? '', token ?? '', projectKey ?? ''),
    enabled: credGate,
    staleTime: 60 * 60 * 1000,
  });
  const jiraProjectId = jiraProjectIdQuery.data ?? null;

  // aioGate requires the numeric jiraProjectId to be resolved
  const aioGate = credGate && !!jiraProjectId;

  // Populate the module-level runtime AIO status map (used by normalizeStatusById).
  // AioProjectOverviewPage also does this, but direct pinned-tab navigation with a
  // fresh cache never mounts the overview — without this, every status ID falls back
  // to 'notRun'. Modelled as a query (not an effect) so completion re-renders and
  // summaryCounts recomputes with the populated map.
  const aioStatusMapQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'status-map-init', projectKey],
    queryFn: async () => {
      await initializeAioStatusMap(jiraBaseUrl ?? '', token ?? '', jiraProjectId ?? 0);
      return true;
    },
    enabled: aioGate,
    staleTime: 60 * 60 * 1000,
  });
  const aioStatusMapReady = aioStatusMapQuery.data === true;

  // USE-DETAIL-ID — AioCycle.ID populated by normalizeCycle from /detail response
  const cycleNumericId = cycleQuery.data?.ID ?? null;

  // Summary query — drives progress bar independently of runsQuery
  const summaryQuery = useQuery<AioCycleSummaryItem[]>({
    queryKey: ['aio', jiraBaseUrl, 'cycle-summaries', projectKey, String(cycleNumericId)],
    queryFn: () =>
      fetchAioCycleSummaries(jiraBaseUrl ?? '', token ?? '', jiraProjectId ?? 0, [
        cycleNumericId ?? 0,
      ]),
    enabled: aioGate && !!cycleNumericId && !tokenLoading,
  });

  // Runs query — fast POST paged endpoint (numeric IDs required)
  const runsQuery = useQuery<AioTestRun[]>({
    queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey],
    queryFn: () =>
      fetchAioCycleTestCasesWithRuns(
        jiraBaseUrl ?? '',
        token ?? '',
        jiraProjectId ?? 0,
        cycleNumericId ?? 0,
        cycleKey ?? '',
      ),
    enabled: aioGate && !!cycleNumericId,
  });

  const runs = runsQuery.data;
  const runsTotal = runs?.length ?? 0;

  // Runs-derived counts — graceful degradation fallback when summaryQuery errors
  const runsCounts = (runs ?? []).reduce<AioStatusCounts>(
    (acc, run) => {
      const norm = normalizeStatus(run.status);
      acc[norm] = (acc[norm] ?? 0) + 1;
      return acc;
    },
    { ...ZERO_COUNTS },
  );

  // Summary-derived counts — primary source. testRunDistribution keys are JSON
  // strings — ALWAYS Number(idStr) before lookup (Pitfall 5).
  const summaryDistribution = summaryQuery.data?.[0]?.summary.testRunDistribution;
  const summaryTotal = summaryQuery.data?.[0]?.summary.totalTests ?? 0;
  const summaryCounts = summaryDistribution
    ? Object.entries(summaryDistribution).reduce<AioStatusCounts>(
        (acc, [idStr, count]) => {
          const statusKey = normalizeStatusById(Number(idStr));
          acc[statusKey] = (acc[statusKey] ?? 0) + count;
          return acc;
        },
        { ...ZERO_COUNTS },
      )
    : null;

  // Final counts/total resolution: summary when resolved with data, else runs-derived.
  const hasSummaryData = !!summaryQuery.data && summaryTotal > 0;
  const counts = hasSummaryData ? (summaryCounts ?? runsCounts) : runsCounts;
  const total = hasSummaryData ? summaryTotal : runsTotal;

  // Runs that can be opened (non-empty run id), in server (cycle rank) order
  const navigableRuns = useMemo(() => (runs ?? []).filter((r) => !!r.id), [runs]);

  return {
    cycleQuery,
    runsQuery,
    summaryQuery,
    aioStatusMapReady,
    jiraProjectId,
    cycleNumericId,
    runs,
    counts,
    total,
    hasSummaryData,
    credGate,
    token,
    tokenLoading,
    jiraBaseUrl,
    navigableRuns,
    ownerID: cycleQuery.data?.ownedByID,
  };
}
