/**
 * ReleasesWidget -- compact releases list for the widget grid.
 *
 * Shows up to 5 upcoming releases with version name, status badge, and release date.
 * Loads Jira token internally and shares the TanStack Query cache with ReleasesTab.
 */

import { useQuery } from '@tanstack/react-query';
import { Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchFixVersions } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

export default function ReleasesWidget(_props: { widgetId: string }) {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then(setJiraToken)
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  const {
    data: fixVersions,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject],
    queryFn: () => fetchFixVersions(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
    staleTime: 5 * 60_000,
  });

  const releases = !fixVersions
    ? []
    : (() => {
        // Show unreleased first (sorted by date asc), then released (newest first) -- take 5 total
        const unreleased = fixVersions
          .filter((v) => !v.released)
          .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''));
        const released = fixVersions
          .filter((v) => v.released)
          .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
        return [...unreleased, ...released].slice(0, 5);
      })();

  if (!jiraToken || !jiraBaseUrl || !activeJiraProject || isLoading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load releases'}
        </span>
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Tag className="size-5" />
          <span className="text-sm">No releases found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2 overflow-auto">
      {releases.map((v) => (
        <div
          key={v.id}
          className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-muted/50 text-sm gap-2"
        >
          <span className="truncate font-medium">{v.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            {v.released ? (
              <Badge variant="default" className="bg-green-600 text-white">
                Released
              </Badge>
            ) : (
              <Badge variant="default" className="bg-amber-500 text-white">
                Unreleased
              </Badge>
            )}
            {v.releaseDate && (
              <span className="text-xs text-muted-foreground tabular-nums">{v.releaseDate}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
