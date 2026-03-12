/**
 * WorkloadTab — PM-02: Per-assignee open task count and story points.
 *
 * Reads from the shared TanStack cache (same query key as SprintProgressTab).
 * Counts and points only reflect non-done stories; done stories appear in expanded sub-rows.
 * Groups by assignee.displayName, with null assignee → 'Unassigned'.
 * Rows sorted by total story points (non-done) descending; ties broken alphabetically by name.
 * Time tracking columns (Est/Spent/Remaining) hidden when all values are zero/null.
 * Each assignee row is expandable to reveal per-story sub-rows.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';

interface WorkloadStoryRow {
  key: string;
  summary: string;
  points: number;
  estSecs: number;
  spentSecs: number;
  remainSecs: number;
}

interface WorkloadRow {
  name: string;
  count: number;         // non-done story count only
  points: number;        // story points only (no subtasks)
  estSecs: number;       // stories + subtasks aggregated
  spentSecs: number;
  remainSecs: number;
  stories: WorkloadStoryRow[];  // for expandable detail
}

function formatSeconds(secs: number): string {
  if (secs === 0) return '0h';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function WorkloadTab() {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { storyPointsFieldKey } = useSettingsStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    // Include storyPointsFieldKey in cache key: when discovery changes the key, the query
    // re-fires with the updated fields list so the response actually contains the value.
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () => fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  function toggleRow(name: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const { rows, hasTimeData } = useMemo(() => {
    const issues = data ?? [];
    const stories = issues.filter((i) => !i.fields.issuetype.subtask);
    const subtasks = issues.filter((i) => i.fields.issuetype.subtask);

    const map = new Map<string, WorkloadRow>();

    // Accumulate story-level data
    for (const story of stories) {
      const cat = story.fields.status.statusCategory?.key ?? 'new';
      const isDone = cat === 'done';
      // Always add story to the assignee map — done stories still appear as sub-rows
      const name = story.fields.assignee?.displayName ?? 'Unassigned';
      const pts = (story.fields[storyPointsFieldKey] as number | null) ?? 0;
      const tt = story.fields.timetracking;
      const existing = map.get(name) ?? {
        name,
        count: 0,
        points: 0,
        estSecs: 0,
        spentSecs: 0,
        remainSecs: 0,
        stories: [],
      };

      if (!isDone) {
        existing.points += pts;
        existing.count += 1;
      }
      // Time tracking always aggregated regardless of done status
      existing.estSecs += tt?.originalEstimateSeconds ?? 0;
      existing.spentSecs += tt?.timeSpentSeconds ?? 0;
      existing.remainSecs += tt?.remainingEstimateSeconds ?? 0;
      existing.stories.push({
        key: story.key,
        summary: story.fields.summary,
        points: pts,
        estSecs: tt?.originalEstimateSeconds ?? 0,
        spentSecs: tt?.timeSpentSeconds ?? 0,
        remainSecs: tt?.remainingEstimateSeconds ?? 0,
      });
      map.set(name, existing);
    }

    // Accumulate subtask time into assignee bucket (no points, no count)
    for (const sub of subtasks) {
      const name = sub.fields.assignee?.displayName ?? 'Unassigned';
      const tt = sub.fields.timetracking;
      const existing = map.get(name);
      if (!existing) continue; // subtask assignee not in any story — skip
      existing.estSecs += tt?.originalEstimateSeconds ?? 0;
      existing.spentSecs += tt?.timeSpentSeconds ?? 0;
      existing.remainSecs += tt?.remainingEstimateSeconds ?? 0;
    }

    const rows = Array.from(map.values()).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    const hasTimeData = rows.some((r) => r.estSecs > 0 || r.spentSecs > 0 || r.remainSecs > 0);
    return { rows, hasTimeData };
  }, [data, storyPointsFieldKey]);

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
        <>
          {rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No sprint data available
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="pb-2 text-left font-normal">Assignee</th>
                  <th className="pb-2 text-right font-normal">Tasks</th>
                  <th className="pb-2 text-right font-normal">Pts</th>
                  {hasTimeData && <th className="pb-2 text-right font-normal">Est</th>}
                  {hasTimeData && <th className="pb-2 text-right font-normal">Spent</th>}
                  {hasTimeData && <th className="pb-2 text-right font-normal">Remaining</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isOpen = expandedRows.has(row.name);
                  return (
                    <React.Fragment key={row.name}>
                      {/* Summary row */}
                      <tr
                        data-testid="workload-row"
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleRow(row.name)}
                      >
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-1">
                            <ChevronRight
                              className={`size-3 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
                              aria-label={isOpen ? 'Collapse' : 'Expand'}
                            />
                            <span className="font-medium">{row.name}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {row.count} {row.count === 1 ? 'task' : 'tasks'}
                        </td>
                        <td className="py-2 text-right tabular-nums">{row.points} pts</td>
                        {hasTimeData && <td className="py-2 text-right tabular-nums text-muted-foreground">{formatSeconds(row.estSecs)}</td>}
                        {hasTimeData && <td className="py-2 text-right tabular-nums text-muted-foreground">{formatSeconds(row.spentSecs)}</td>}
                        {hasTimeData && <td className="py-2 text-right tabular-nums text-muted-foreground">{formatSeconds(row.remainSecs)}</td>}
                      </tr>
                      {/* Per-story rows — only shown when expanded */}
                      {isOpen && row.stories.map((story) => (
                        <tr key={story.key} data-testid="workload-story-row" className="bg-muted/20">
                          <td className="py-1 pl-6 pr-2 text-xs text-muted-foreground">
                            <span className="font-mono">{story.key}</span>
                            <span className="ml-2 truncate">{story.summary}</span>
                          </td>
                          <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">—</td>
                          <td className="py-1 text-right tabular-nums text-xs">{story.points} pts</td>
                          {hasTimeData && <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">{formatSeconds(story.estSecs)}</td>}
                          {hasTimeData && <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">{formatSeconds(story.spentSecs)}</td>}
                          {hasTimeData && <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">{formatSeconds(story.remainSecs)}</td>}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
