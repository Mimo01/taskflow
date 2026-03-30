/**
 * SprintProgressTab — PM-01: Sprint progress buckets with three-segment stacked bar,
 * sprint-wide time totals summary, and per-assignee points breakdown table.
 *
 * Fetches all sprint issues (assignedToMe=false) and groups by statusCategory:
 *   'new'          → To Do
 *   'indeterminate' → In Progress
 *   'done'          → Done
 *   undefined       → defaults to To Do (safe fallback for on-prem servers)
 *
 * Bucket counts and per-assignee points use parent stories only — subtasks excluded.
 * Time totals (estimate/spent/remaining) sum all issues including subtasks.
 * Story points field key comes from useSettingsStore (not hardcoded).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useIsActiveRoute } from '@/hooks/useIsActiveRoute';
import { POLL_INTERVAL_MS, STALE_TIME_MS } from '@/lib/query-constants';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { SprintProgressSkeleton } from './SprintProgressSkeleton';

function formatSeconds(secs: number): string {
  if (secs === 0) return '0h';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function SprintProgressTab() {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { storyPointsFieldKey } = useSettingsStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const isActive = useIsActiveRoute('/sprint-progress');

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey),
    enabled: isActive && !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: STALE_TIME_MS,
  });

  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const showSkeleton = useDelayedLoading(isLoading) || isRefreshing;

  useEffect(() => {
    if (!isLoading) setIsRefreshing(false);
  }, [isLoading]);

  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    setBannerDismissed(false);
  }, []);

  const computed = (() => {
    const issues = data ?? [];

    // Partition into stories (parent issues) and all issues (for time totals)
    const stories = issues.filter((i) => !i.fields.issuetype?.subtask);

    let todoCount = 0;
    let inProgressCount = 0;
    let doneCount = 0;
    let ptsTodo = 0;
    let ptsInProgress = 0;
    let ptsDone = 0;

    // Per-assignee map: name -> { todo, inProgress, done, stories, subtasks }
    const assigneeMap = new Map<
      string,
      { todo: number; inProgress: number; done: number; stories: number; subtasks: number }
    >();

    for (const story of stories) {
      const cat = story.fields.status.statusCategory?.key ?? 'new';
      const pts = (story.fields[storyPointsFieldKey] as number | null | undefined) ?? 0;

      const assigneeName =
        (story.fields.assignee as { displayName: string } | null)?.displayName ?? 'Unassigned';

      if (!assigneeMap.has(assigneeName)) {
        assigneeMap.set(assigneeName, { todo: 0, inProgress: 0, done: 0, stories: 0, subtasks: 0 });
      }
      const row = assigneeMap.get(assigneeName)!;
      row.stories++;

      if (cat === 'done') {
        doneCount++;
        ptsDone += pts;
        row.done += pts;
      } else if (cat === 'indeterminate') {
        inProgressCount++;
        ptsInProgress += pts;
        row.inProgress += pts;
      } else {
        // 'new' or anything else → To Do
        todoCount++;
        ptsTodo += pts;
        row.todo += pts;
      }
    }

    // Count subtasks per assignee using issuetype.subtask boolean
    for (const issue of issues) {
      if (!issue.fields.issuetype?.subtask) continue;
      const assigneeName =
        (issue.fields.assignee as { displayName: string } | null)?.displayName ?? 'Unassigned';
      if (!assigneeMap.has(assigneeName)) {
        assigneeMap.set(assigneeName, { todo: 0, inProgress: 0, done: 0, stories: 0, subtasks: 0 });
      }
      assigneeMap.get(assigneeName)!.subtasks++;
    }

    const total = todoCount + inProgressCount + doneCount;
    const todoPct = total > 0 ? Math.round((todoCount / total) * 100) : 0;
    const inProgPct = total > 0 ? Math.round((inProgressCount / total) * 100) : 0;
    const donePct = total > 0 ? 100 - todoPct - inProgPct : 0;

    // Time totals: sum all issues (stories + subtasks)
    let totalEstSecs = 0;
    let totalSpentSecs = 0;
    let totalRemainSecs = 0;

    for (const issue of issues) {
      const tt = issue.fields.timetracking as
        | {
            originalEstimateSeconds?: number;
            timeSpentSeconds?: number;
            remainingEstimateSeconds?: number;
          }
        | null
        | undefined;
      if (tt) {
        totalEstSecs += tt.originalEstimateSeconds ?? 0;
        totalSpentSecs += tt.timeSpentSeconds ?? 0;
        totalRemainSecs += tt.remainingEstimateSeconds ?? 0;
      }
    }

    const hasTimeData = totalEstSecs > 0 || totalSpentSecs > 0 || totalRemainSecs > 0;
    const hasPoints = stories.some(
      (s) => ((s.fields[storyPointsFieldKey] as number | null | undefined) ?? 0) > 0,
    );

    // Assignee rows sorted by total pts desc, alphabetical tiebreaker
    const assigneeRows = Array.from(assigneeMap.entries())
      .map(([name, buckets]) => ({
        name,
        buckets,
        points: buckets.todo + buckets.inProgress + buckets.done,
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .map(
        ({ name, buckets }) =>
          [name, buckets] as [
            string,
            { todo: number; inProgress: number; done: number; stories: number; subtasks: number },
          ],
      );

    return {
      todo: todoCount,
      inProgress: inProgressCount,
      done: doneCount,
      ptsTodo,
      ptsInProgress,
      ptsDone,
      todoPct,
      inProgPct,
      donePct,
      total,
      totalEstSecs,
      totalSpentSecs,
      totalRemainSecs,
      hasTimeData,
      hasPoints,
      assigneeRows,
    };
  })();

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
          onClick={() => {
            setIsRefreshing(true);
            queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
          }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>

      {/* Loading skeleton */}
      {showSkeleton && <SprintProgressSkeleton />}

      {/* Error state — no cached data */}
      {isError && !data && (
        <ErrorState
          error={error}
          onRetry={() => {
            setIsRefreshing(true);
            queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
          }}
          viewName="sprint progress"
        />
      )}

      {/* Stale data banner — error with cached data */}
      {isError && data && !bannerDismissed && (
        <StaleDataBanner
          onRetry={() => {
            setIsRefreshing(true);
            queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
          }}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* Empty state — no issues in sprint */}
      {!showSkeleton && !isError && data && data.length === 0 && (
        <EmptyState
          icon={BarChart3}
          title="No sprint data yet"
          subtitle="Sprint progress will appear once a sprint is active"
        />
      )}

      {/* Content */}
      {!showSkeleton && !isError && data && data.length > 0 && (
        <div className="flex flex-col gap-4">
          {/* Status bucket rows — unchanged labels, unchanged dot colors */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full bg-slate-400" />
                <span className="text-sm">To Do</span>
              </div>
              <span className="text-sm font-medium tabular-nums">{computed.todo}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full bg-blue-500" />
                <span className="text-sm">In Progress</span>
              </div>
              <span className="text-sm font-medium tabular-nums">{computed.inProgress}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full bg-green-500" />
                <span className="text-sm">Done</span>
              </div>
              <span className="text-sm font-medium tabular-nums">{computed.done}</span>
            </div>
          </div>

          {/* Stacked bar — only when sprint has issues */}
          {computed.total > 0 && (
            <div className="flex flex-col gap-1" data-testid="stacked-bar">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div style={{ width: `${computed.todoPct}%` }} className="bg-slate-400" />
                <div style={{ width: `${computed.inProgPct}%` }} className="bg-blue-500" />
                <div style={{ width: `${computed.donePct}%` }} className="bg-green-500" />
              </div>
              <p className="text-xs text-muted-foreground">
                {computed.todoPct}% to do · {computed.inProgPct}% in progress · {computed.donePct}%
                done
              </p>
            </div>
          )}

          {/* Sprint time summary — only when time tracking data exists */}
          {computed.hasTimeData && (
            <div className="text-xs text-muted-foreground" data-testid="time-summary">
              <span className="font-medium text-foreground">Sprint Time</span>
              {'  '}
              Total Est: {formatSeconds(computed.totalEstSecs)} · Spent:{' '}
              {formatSeconds(computed.totalSpentSecs)} · Remaining:{' '}
              {formatSeconds(computed.totalRemainSecs)}
            </div>
          )}

          {/* Per-assignee breakdown table */}
          {computed.assigneeRows.length > 0 && (
            <table className="w-full text-sm" data-testid="assignee-breakdown">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="pb-2 text-left font-normal">Assignee</th>
                  <th className="pb-2 text-right font-normal">Stories</th>
                  <th className="pb-2 text-right font-normal">Subtasks</th>
                  <th className="pb-2 text-right font-normal">To Do pts</th>
                  <th className="pb-2 text-right font-normal">In Progress pts</th>
                  <th className="pb-2 text-right font-normal">Done pts</th>
                </tr>
              </thead>
              <tbody>
                {computed.assigneeRows.map(([name, buckets]) => (
                  <tr key={name} data-testid="assignee-row" className="hover:bg-muted/50">
                    <td className="py-1.5 text-sm">{name}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {buckets.stories}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {buckets.subtasks}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {buckets.todo}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {buckets.inProgress}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {buckets.done}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
