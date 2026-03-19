/**
 * WorkloadTab — PM-02: Per-assignee open task count and story points.
 *
 * Reads from the shared TanStack cache (same query key as SprintProgressTab).
 * Count includes all stories (in-progress + done); points only reflect non-done stories (locked decision).
 * Done stories are visually distinguished with a "Done" badge in expanded sub-rows.
 * Groups by assignee.displayName, with null assignee → 'Unassigned'.
 * Rows sorted by total story points (non-done) descending; ties broken alphabetically by name.
 * Time tracking columns (Est/Spent/Remaining) hidden when all values are zero/null.
 * Each assignee row is expandable to reveal per-story sub-rows, with subtasks nested under each story.
 * People who appear only in worklogs (not assigned to any story) get a workload row (count=0, pts=0).
 */

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, RefreshCw, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { fetchIssueWorklogs, fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

interface WorkloadSubtaskRow {
  key: string;
  summary: string;
  estSecs: number;
  spentSecs: number;
  remainSecs: number;
}

interface WorkloadStoryRow {
  key: string;
  summary: string;
  points: number;
  isDone: boolean;
  estSecs: number;
  spentSecs: number;
  remainSecs: number;
  subtasks: WorkloadSubtaskRow[];
}

interface WorkloadRow {
  name: string;
  count: number; // all stories (in-progress + done)
  points: number; // story points (all stories including done, no subtasks)
  estSecs: number; // stories + subtasks aggregated
  spentSecs: number;
  remainSecs: number;
  stories: WorkloadStoryRow[]; // for expandable detail
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
  const [bannerDismissed, setBannerDismissed] = useState(false);

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
    queryFn: () =>
      fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Reset banner dismissal when error state changes
  useEffect(() => {
    setBannerDismissed(false);
  }, []);

  const sprintIssues = data ?? [];

  const { data: worklogMap } = useQuery({
    queryKey: ['workload-worklogs', activeJiraProject, sprintIssues.map((i) => i.key).join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        sprintIssues.map(async (issue) => {
          const authors = await fetchIssueWorklogs(jiraBaseUrl!, jiraToken!, issue.key);
          return [issue.key, authors] as [string, string[]];
        }),
      );
      return new Map<string, string[]>(entries);
    },
    enabled: !!jiraBaseUrl && !!jiraToken && sprintIssues.length > 0,
    staleTime: 60_000,
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

    // Build subtask lookup by key for fast access
    const subtaskByKey = new Map(subtasks.map((s) => [s.key, s]));

    // Build subtasksByParent map: parentKey → subtask keys (for worklog-based filtering in Pass 2)
    const subtaskKeysByParent = new Map<string, string[]>();
    for (const sub of subtasks) {
      const parentKey = sub.fields.parent?.key;
      if (!parentKey) continue;
      const existing = subtaskKeysByParent.get(parentKey) ?? [];
      existing.push(sub.key);
      subtaskKeysByParent.set(parentKey, existing);
    }

    const map = new Map<string, WorkloadRow>();

    // Pass 1: assignment-based — build rows with count, points, and the stories[] drill-down.
    // Every assignee sees all their stories in the drill-down immediately (no worklog data needed).
    // Subtasks start empty ([]) and are overlaid in Pass 2 once worklog data arrives.
    // Time totals (est/spent/remaining) are worklog-based, so they stay at 0 until Pass 2.
    for (const story of stories) {
      const name = story.fields.assignee?.displayName ?? 'Unassigned';
      const pts = (story.fields[storyPointsFieldKey] as number | null) ?? 0;
      const cat = story.fields.status.statusCategory?.key ?? 'new';
      const isDone = cat === 'done';
      const existing = map.get(name) ?? {
        name,
        count: 0,
        points: 0,
        estSecs: 0,
        spentSecs: 0,
        remainSecs: 0,
        stories: [],
      };
      existing.count += 1;
      existing.points += pts;
      existing.stories.push({
        key: story.key,
        summary: story.fields.summary,
        points: pts,
        isDone,
        estSecs: 0,
        spentSecs: 0,
        remainSecs: 0,
        subtasks: [],
      });
      map.set(name, existing);
    }

    // Pass 2: worklog-based overlay — fill in subtasks, time totals, and worklog-only author rows.
    // Runs only once worklogMap is available; rows remain usable before it loads (stories already visible).
    if (worklogMap) {
      // Ensure every worklog author has a row (even if not assigned to any story)
      for (const [, authors] of worklogMap) {
        for (const authorName of authors) {
          if (!map.has(authorName)) {
            map.set(authorName, {
              name: authorName,
              count: 0,
              points: 0,
              estSecs: 0,
              spentSecs: 0,
              remainSecs: 0,
              stories: [],
            });
          }
        }
      }

      // For each story: update the assignee's existing story row with filtered subtasks + time totals.
      // Also add the story to any worklog-only authors who logged time on it (not the assignee).
      for (const story of stories) {
        const storyAuthors = worklogMap.get(story.key) ?? [];
        const cat = story.fields.status.statusCategory?.key ?? 'new';
        const isDone = cat === 'done';
        const pts = (story.fields[storyPointsFieldKey] as number | null) ?? 0;
        const tt = story.fields.timetracking;
        const childKeys = subtaskKeysByParent.get(story.key) ?? [];

        for (const authorName of storyAuthors) {
          const row = map.get(authorName);
          if (!row) continue;

          // Collect only subtasks where this author also has worklogs
          const filteredSubtasks: WorkloadSubtaskRow[] = childKeys
            .filter((subKey) => (worklogMap.get(subKey) ?? []).includes(authorName))
            .map((subKey) => {
              const sub = subtaskByKey.get(subKey)!;
              const subTt = sub.fields.timetracking;
              return {
                key: sub.key,
                summary: sub.fields.summary,
                estSecs: subTt?.originalEstimateSeconds ?? 0,
                spentSecs: subTt?.timeSpentSeconds ?? 0,
                remainSecs: subTt?.remainingEstimateSeconds ?? 0,
              };
            });

          // Find the existing story row built in Pass 1 (assignee-based) and update it,
          // or push a new story row if this is a worklog-only author (not the assignee).
          const existingStoryRow = row.stories.find((s) => s.key === story.key);
          if (existingStoryRow) {
            // Update the already-visible story row with worklog-derived data
            existingStoryRow.estSecs = tt?.originalEstimateSeconds ?? 0;
            existingStoryRow.spentSecs = tt?.timeSpentSeconds ?? 0;
            existingStoryRow.remainSecs = tt?.remainingEstimateSeconds ?? 0;
            existingStoryRow.subtasks = filteredSubtasks;
          } else {
            // Worklog-only author: story wasn't in their assignment, add it now
            row.stories.push({
              key: story.key,
              summary: story.fields.summary,
              points: pts,
              isDone,
              estSecs: tt?.originalEstimateSeconds ?? 0,
              spentSecs: tt?.timeSpentSeconds ?? 0,
              remainSecs: tt?.remainingEstimateSeconds ?? 0,
              subtasks: filteredSubtasks,
            });
          }

          // Time totals on the summary row: accumulate from story-level worklog
          row.estSecs += tt?.originalEstimateSeconds ?? 0;
          row.spentSecs += tt?.timeSpentSeconds ?? 0;
          row.remainSecs += tt?.remainingEstimateSeconds ?? 0;
        }
      }

      // Accumulate subtask time into author row for subtasks where author has a worklog
      // (covers subtasks whose parent story wasn't logged by this author).
      // Also attaches the subtask visually to the parent story row in the author's drill-down,
      // covering the case where someone logged time on a subtask but not on its parent story.
      for (const sub of subtasks) {
        const subAuthors = worklogMap.get(sub.key) ?? [];
        const tt = sub.fields.timetracking;
        const parentKey = sub.fields.parent?.key;
        const parentStory = parentKey ? stories.find((s) => s.key === parentKey) : undefined;
        for (const authorName of subAuthors) {
          const row = map.get(authorName);
          if (!row) continue;
          row.estSecs += tt?.originalEstimateSeconds ?? 0;
          row.spentSecs += tt?.timeSpentSeconds ?? 0;
          row.remainSecs += tt?.remainingEstimateSeconds ?? 0;

          // If the subtask's parent story exists, make sure this subtask appears in the
          // author's drill-down under that story — even if the author has no worklog on
          // the story itself (subtask-only contributor).
          if (parentStory) {
            let storyRow = row.stories.find((s) => s.key === parentKey);
            if (!storyRow) {
              // Author has no story-level worklog and isn't assigned — add the parent story row
              const parentPts = (parentStory.fields[storyPointsFieldKey] as number | null) ?? 0;
              const parentCat = parentStory.fields.status.statusCategory?.key ?? 'new';
              const parentTt = parentStory.fields.timetracking;
              storyRow = {
                key: parentStory.key,
                summary: parentStory.fields.summary,
                points: parentPts,
                isDone: parentCat === 'done',
                estSecs: parentTt?.originalEstimateSeconds ?? 0,
                spentSecs: parentTt?.timeSpentSeconds ?? 0,
                remainSecs: parentTt?.remainingEstimateSeconds ?? 0,
                subtasks: [],
              };
              row.stories.push(storyRow);
            }
            // Add subtask to the story row if not already present (story loop may have added it)
            if (!storyRow.subtasks.some((st) => st.key === sub.key)) {
              storyRow.subtasks.push({
                key: sub.key,
                summary: sub.fields.summary,
                estSecs: tt?.originalEstimateSeconds ?? 0,
                spentSecs: tt?.timeSpentSeconds ?? 0,
                remainSecs: tt?.remainingEstimateSeconds ?? 0,
              });
            }
          }
        }
      }
    }

    const rows = Array.from(map.values()).sort(
      (a, b) => b.points - a.points || a.name.localeCompare(b.name),
    );
    const hasTimeData = rows.some((r) => r.estSecs > 0 || r.spentSecs > 0 || r.remainSecs > 0);
    return { rows, hasTimeData };
  }, [data, storyPointsFieldKey, worklogMap]);

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
            <div
              key={i}
              data-testid="skeleton-row"
              className="h-8 rounded bg-muted animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error state — full error when no cached data */}
      {isError && !data && <ErrorState error={error} onRetry={refetch} viewName="workload" />}

      {/* Stale data banner — error with cached data still visible */}
      {isError && data && !bannerDismissed && (
        <StaleDataBanner onRetry={refetch} onDismiss={() => setBannerDismissed(true)} />
      )}

      {/* Content */}
      {!isLoading &&
        !isError &&
        (rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No workload data"
            subtitle="Team workload will appear when sprint issues have assignees"
          />
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
                      {hasTimeData && (
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {formatSeconds(row.estSecs)}
                        </td>
                      )}
                      {hasTimeData && (
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {formatSeconds(row.spentSecs)}
                        </td>
                      )}
                      {hasTimeData && (
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {formatSeconds(row.remainSecs)}
                        </td>
                      )}
                    </tr>
                    {/* Per-story rows — only shown when expanded */}
                    {isOpen &&
                      row.stories.map((story) => (
                        <React.Fragment key={story.key}>
                          <tr
                            key={story.key}
                            data-testid="workload-story-row"
                            className="bg-muted/20"
                          >
                            <td className="py-1 pl-6 pr-2 text-xs text-muted-foreground">
                              <span className="font-mono">{story.key}</span>
                              <span className="ml-2 truncate">{story.summary}</span>
                              {story.isDone && (
                                <span
                                  data-testid="done-badge"
                                  className="ml-1 text-xs text-green-600 font-medium"
                                >
                                  Done
                                </span>
                              )}
                            </td>
                            <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">
                              —
                            </td>
                            <td className="py-1 text-right tabular-nums text-xs">
                              {story.points} pts
                            </td>
                            {hasTimeData && (
                              <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">
                                {formatSeconds(story.estSecs)}
                              </td>
                            )}
                            {hasTimeData && (
                              <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">
                                {formatSeconds(story.spentSecs)}
                              </td>
                            )}
                            {hasTimeData && (
                              <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">
                                {formatSeconds(story.remainSecs)}
                              </td>
                            )}
                          </tr>
                          {/* Subtask rows — nested under parent story */}
                          {story.subtasks.map((sub) => (
                            <tr
                              key={sub.key}
                              data-testid="workload-subtask-row"
                              className="bg-muted/10"
                            >
                              <td className="py-1 pl-12 pr-2 text-xs text-muted-foreground">
                                <span className="font-mono">{sub.key}</span>
                                <span className="ml-2 truncate">{sub.summary}</span>
                              </td>
                              <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">
                                —
                              </td>
                              <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">
                                —
                              </td>
                              {hasTimeData && (
                                <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">
                                  {formatSeconds(sub.estSecs)}
                                </td>
                              )}
                              {hasTimeData && (
                                <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">
                                  {formatSeconds(sub.spentSecs)}
                                </td>
                              )}
                              {hasTimeData && (
                                <td className="py-1 text-right tabular-nums text-xs text-muted-foreground">
                                  {formatSeconds(sub.remainSecs)}
                                </td>
                              )}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ))}
    </div>
  );
}
