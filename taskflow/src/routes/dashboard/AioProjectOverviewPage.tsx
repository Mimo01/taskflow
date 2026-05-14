import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { NavLink, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAioCredentials } from '@/hooks/useAioCredentials';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { aioCycleStatusBadgeClass } from '@/lib/statusStyles';
import { normalizeStatus } from '@/lib/aioUtils';
import type { AioCycle, AioTestRun } from '@/services/aio';
import { fetchAioCycles, fetchAioTestRunsForCycle } from '@/services/aio';
import { useAuthStore } from '@/stores/auth.store';
import { AioCyclesSkeleton } from './AioCyclesSkeleton';

function CycleStatsCell({
  projectKey,
  cycleKey,
  jiraBaseUrl,
  token,
  tokenLoading,
}: {
  projectKey: string;
  cycleKey: string;
  jiraBaseUrl: string | undefined;
  token: string | null;
  tokenLoading: boolean;
}) {
  const runsQuery = useQuery<AioTestRun[]>({
    queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey],
    queryFn: () => fetchAioTestRunsForCycle(jiraBaseUrl!, token!, projectKey, cycleKey),
    enabled: !!jiraBaseUrl && !!token && !tokenLoading,
  });

  if (runsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-1" data-testid="cycle-stats-loading">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-3 w-24 mt-1" />
      </div>
    );
  }

  if (runsQuery.isError) {
    return (
      <span className="text-xs text-muted-foreground" data-testid="cycle-stats-error">
        —
      </span>
    );
  }

  const runs = runsQuery.data ?? [];

  if (runs.length === 0) {
    return (
      <div data-testid="cycle-stats-loaded">
        <p className="text-xs text-muted-foreground mt-0.5">No runs</p>
      </div>
    );
  }

  const counts = runs.reduce(
    (acc, run) => {
      const norm = normalizeStatus(run.status);
      acc[norm] = (acc[norm] ?? 0) + 1;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, notRun: 0 },
  );

  const total = runs.length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div data-testid="cycle-stats-loaded">
      <div className="h-1.5 rounded-full overflow-hidden flex">
        {counts.pass > 0 && (
          <div className="bg-green-500 h-full" style={{ width: `${pct(counts.pass)}%` }} />
        )}
        {counts.fail > 0 && (
          <div className="bg-red-500 h-full" style={{ width: `${pct(counts.fail)}%` }} />
        )}
        {counts.blocked > 0 && (
          <div className="bg-orange-400 h-full" style={{ width: `${pct(counts.blocked)}%` }} />
        )}
        {counts.notRun > 0 && (
          <div className="bg-muted h-full" style={{ width: `${pct(counts.notRun)}%` }} />
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">
        {counts.pass}P {counts.fail}F {counts.blocked}B {counts.notRun}N
      </p>
    </div>
  );
}

export default function AioProjectOverviewPage() {
  const { projectKey } = useParams<{ projectKey: string }>();
  const { jiraBaseUrl } = useAuthStore();
  const { token, isLoading: tokenLoading } = useAioCredentials();

  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery<AioCycle[]>({
    queryKey: ['aio', jiraBaseUrl, 'cycles', projectKey],
    queryFn: () => fetchAioCycles(jiraBaseUrl!, token!, projectKey!),
    enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey,
  });

  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <h1 className="text-xl font-semibold">Cycles — {projectKey ?? ''}</h1>
      </div>

      <div className="flex-1 overflow-auto">
        {isError && !data && (
          <div className="p-4">
            <ErrorState
              error={error}
              onRetry={() =>
                queryClient.invalidateQueries({
                  queryKey: ['aio', jiraBaseUrl, 'cycles', projectKey],
                })
              }
              viewName="cycles"
            />
          </div>
        )}

        {showSkeleton ? (
          <div className="p-4">
            <AioCyclesSkeleton />
          </div>
        ) : !isError ? (
          <>
            {(data ?? []).length > 0 ? (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/10">
                  <tr>
                    <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Key
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="w-40 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).map((cycle) => (
                    <tr
                      key={cycle.key}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-3 text-xs text-muted-foreground font-mono">
                        {cycle.key}
                      </td>
                      <td className="px-4 py-3">
                        <NavLink
                          to={`/aio-cycle/${projectKey}/${cycle.key}`}
                          className="hover:underline"
                        >
                          {cycle.name}
                        </NavLink>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioCycleStatusBadgeClass(cycle.status)}`}
                        >
                          {cycle.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <CycleStatsCell
                          projectKey={projectKey!}
                          cycleKey={cycle.key}
                          jiraBaseUrl={jiraBaseUrl}
                          token={token}
                          tokenLoading={tokenLoading}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {data !== undefined && data.length === 0 && (
              <EmptyState
                icon={FlaskConical}
                title="No cycles found"
                subtitle="No test cycles have been created for this project yet"
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
