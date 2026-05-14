import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { aioCycleStatusBadgeClass } from '@/lib/statusStyles';
import type { AioCycle } from '@/services/aio';
import { fetchAioCycles } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { AioCyclesSkeleton } from './AioCyclesSkeleton';

export default function AioProjectOverviewPage() {
  const { projectKey } = useParams<{ projectKey: string }>();
  const { jiraBaseUrl } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null));
  }, []);

  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery<AioCycle[]>({
    queryKey: ['aio', jiraBaseUrl, 'cycles', projectKey],
    queryFn: () => fetchAioCycles(jiraBaseUrl!, token!, projectKey!),
    enabled: !!jiraBaseUrl && !!token && !!projectKey,
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
