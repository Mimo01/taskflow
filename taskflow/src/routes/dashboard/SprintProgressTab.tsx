/**
 * SprintProgressTab — PM-01: Sprint progress buckets and optional story points progress bar.
 *
 * Fetches all sprint issues (assignedToMe=false) and groups by statusCategory:
 *   'new'          → To Do
 *   'indeterminate' → In Progress
 *   'done'          → Done
 *   undefined       → defaults to To Do (safe fallback for on-prem servers)
 *
 * Progress bar is only shown when at least one issue has story points set.
 * Uses the same TanStack query key as SprintBoardTab and WorkloadTab to share the cache.
 */
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';

export default function SprintProgressTab() {
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

  const { todo, inProgress, done, pointsDone, pointsRemaining, hasPoints } = useMemo(() => {
    const issues = data ?? [];
    let todoCount = 0;
    let inProgressCount = 0;
    let doneCount = 0;
    let ptsDone = 0;
    let ptsRemaining = 0;

    for (const issue of issues) {
      const cat = issue.fields.status.statusCategory?.key ?? 'new';
      const pts = issue.fields.customfield_10016 ?? 0;

      if (cat === 'done') {
        doneCount++;
        ptsDone += pts;
      } else if (cat === 'indeterminate') {
        inProgressCount++;
        ptsRemaining += pts;
      } else {
        // 'new' or anything else → To Do
        todoCount++;
        ptsRemaining += pts;
      }
    }

    const totalPoints = ptsDone + ptsRemaining;
    const hasPointsFlag = issues.some((i) => (i.fields.customfield_10016 ?? 0) > 0);

    return {
      todo: todoCount,
      inProgress: inProgressCount,
      done: doneCount,
      pointsDone: ptsDone,
      pointsRemaining: ptsRemaining,
      hasPoints: hasPointsFlag,
      totalPoints,
    };
  }, [data]);

  const totalPoints = pointsDone + pointsRemaining;
  const progressPct = totalPoints > 0 ? Math.round((pointsDone / totalPoints) * 100) : 0;

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never';

  return (
    <div className="flex flex-col gap-3 p-4">
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
        <div className="flex flex-col gap-3">
          {/* Status bucket rows */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full bg-slate-400" />
                <span className="text-sm">To Do</span>
              </div>
              <span className="text-sm font-medium tabular-nums">{todo}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full bg-blue-500" />
                <span className="text-sm">In Progress</span>
              </div>
              <span className="text-sm font-medium tabular-nums">{inProgress}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full bg-green-500" />
                <span className="text-sm">Done</span>
              </div>
              <span className="text-sm font-medium tabular-nums">{done}</span>
            </div>
          </div>

          {/* Progress bar — only when story points are tracked */}
          {hasPoints && (
            <div className="flex flex-col gap-1.5" data-testid="progress-bar">
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground text-right">
                {pointsDone} / {totalPoints} pts
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
