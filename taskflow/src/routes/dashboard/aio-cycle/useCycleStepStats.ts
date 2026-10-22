import { useQuery } from '@tanstack/react-query';
import { type AioCycleStepSummary, fetchAioCycleStepSummary } from '@/services/aio';

export type CycleStepStats = AioCycleStepSummary & {
  /** passed + failed + blocked */
  executed: number;
  loading: boolean;
};

const ZERO: AioCycleStepSummary = {
  passed: 0,
  failed: 0,
  blocked: 0,
  notRun: 0,
  total: 0,
  cases: 0,
  casesWithSteps: 0,
};

/**
 * Step-level totals for a cycle from one AIO report request (the endpoint behind AIO's
 * cycle-summary dashboard gadget). Only the step tiles wait on `loading`; case counts and
 * charts never do. A failed request settles to zeros, so the tiles show dashes.
 */
export function useCycleStepStats({
  projectKey,
  jiraProjectId,
  cycleNumericId,
  jiraBaseUrl,
  token,
  tokenLoading,
}: {
  projectKey: string | undefined;
  jiraProjectId: number | null | undefined;
  cycleNumericId: number | null | undefined;
  jiraBaseUrl: string | null | undefined;
  token: string | null | undefined;
  tokenLoading: boolean;
}): CycleStepStats {
  const query = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'cycle-step-summary', projectKey, String(cycleNumericId)],
    queryFn: () =>
      fetchAioCycleStepSummary(
        jiraBaseUrl ?? '',
        token ?? '',
        jiraProjectId ?? 0,
        cycleNumericId ?? 0,
      ),
    enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!jiraProjectId && !!cycleNumericId,
  });
  const s = query.data ?? ZERO;
  return { ...s, executed: s.passed + s.failed + s.blocked, loading: query.isPending };
}
