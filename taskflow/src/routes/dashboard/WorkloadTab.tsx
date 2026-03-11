/**
 * WorkloadTab — PM-02: Per-assignee open task count and story points.
 *
 * Reads from the shared TanStack cache (same query key as SprintProgressTab).
 * Only counts NON-done issues (statusCategory.key !== 'done').
 * Groups by assignee.displayName, with null assignee → 'Unassigned'.
 * Rows sorted by open task count descending.
 */
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';

interface WorkloadRow {
  name: string;
  count: number;
  points: number;
}

export default function WorkloadTab() {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject],
    queryFn: () => fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const rows: WorkloadRow[] = useMemo(() => {
    const issues = data ?? [];
    const map = new Map<string, { count: number; points: number }>();

    for (const issue of issues) {
      const cat = issue.fields.status.statusCategory?.key ?? 'new';
      if (cat === 'done') continue;

      const name = issue.fields.assignee?.displayName ?? 'Unassigned';
      const pts = issue.fields.customfield_10016 ?? 0;
      const existing = map.get(name) ?? { count: 0, points: 0 };
      map.set(name, { count: existing.count + 1, points: existing.points + pts });
    }

    return Array.from(map.entries())
      .map(([name, { count, points }]) => ({ name, count, points }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never';

  return (
    <div className="flex flex-col gap-3 pt-2">
      {/* Header row */}
      <div className="flex items-center justify-end gap-2 pb-2">
        <span className="text-xs text-muted-foreground">{lastRefreshed}</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} data-testid="skeleton-row" className="h-8 rounded bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(error as Error)?.message ?? 'Failed to load sprint data'}
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && (
        <>
          {rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No sprint data available
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {rows.map((row) => (
                <div
                  key={row.name}
                  data-testid="workload-row"
                  className="flex items-center justify-between rounded px-3 py-2 hover:bg-muted/50"
                >
                  <span className="text-sm font-medium">{row.name}</span>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{row.count} {row.count === 1 ? 'task' : 'tasks'}</span>
                    <span>{row.points} pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
