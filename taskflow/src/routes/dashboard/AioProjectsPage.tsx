import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { AioProject } from '@/services/aio';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { AioProjectsSkeleton } from './AioProjectsSkeleton';

export default function AioProjectsPage() {
  const { jiraBaseUrl } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null));
  }, []);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery<AioProject[]>({
    queryKey: ['aio', jiraBaseUrl, 'projects'],
    queryFn: () => fetchAioProjects(jiraBaseUrl!, token!),
    enabled: !!jiraBaseUrl && !!token,
  });

  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <h1 className="text-xl font-semibold">AIO Projects</h1>
      </div>

      <div className="flex-1 overflow-auto">
        {isError && !data && (
          <div className="p-4">
            <ErrorState
              error={error}
              onRetry={() =>
                queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'projects'] })
              }
              viewName="AIO projects"
            />
          </div>
        )}

        {showSkeleton ? (
          <div className="p-4">
            <AioProjectsSkeleton />
          </div>
        ) : !isError ? (
          <>
            {(data ?? []).length > 0 ? (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/10">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Key
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).map((project) => (
                    <tr
                      key={project.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/aio-project/${project.projectKey}`)}
                    >
                      <td className="px-4 py-3">{project.name}</td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          {project.projectKey}
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
                title="No test projects found"
                subtitle="AIO test projects will appear here once configured in your Jira instance"
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
