/**
 * dashboardMetrics.ts — Phase 83 DASH-02/03/04/05/07/08/09
 *
 * Pure derivation functions for Dashboard stat tiles and sprint health chart.
 * NO React, NO hooks. Importable in unit tests without any DOM environment.
 *
 * Single source of truth for every stat tile and the donut.
 * Downstream UI imports these functions and never re-derives inline.
 */
import type { JiraIssue } from '@/services/jira';

/**
 * A single segment in the sprint-health donut chart.
 */
export interface DonutSegment {
  name: string;
  value: number;
  fill: string;
}

/**
 * Filter out subtask issues. Uses the boolean `issuetype.subtask` field —
 * never a name comparison (admin can rename issue types).
 */
export function filterNonSubtasks(issues: JiraIssue[]): JiraIssue[] {
  return issues.filter((i) => !i.fields.issuetype.subtask);
}

/**
 * Sum of story points for DONE non-subtask issues across the whole sprint.
 * Implements D-04: subtasks excluded; parent(5 SP) + 2 subtasks(2 SP each) ⇒ 5, not 9.
 */
export function computeSpDone(issues: JiraIssue[], spKey: string): number {
  return filterNonSubtasks(issues)
    .filter((i) => i.fields.status.statusCategory?.key === 'done')
    .reduce((sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0), 0);
}

/**
 * Sum of story points for ALL non-subtask issues across the whole sprint.
 * Implements D-04: subtasks excluded.
 */
export function computeSpTotal(issues: JiraIssue[], spKey: string): number {
  return filterNonSubtasks(issues).reduce(
    (sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0),
    0,
  );
}

/**
 * Personal tile counts for the current user's non-subtask issues.
 * Implements D-03 / D-05:
 *   - open       = my non-done non-subtask issues
 *   - inProgress = my non-subtask issues with statusCategory.key === 'indeterminate'
 *   - overdue    = my non-done non-subtask issues where duedate < today AND not done
 *
 * @param issues     Sprint issue array (full sprint, including other users)
 * @param displayName The current user's Jira displayName (from auth store)
 * @param today      Today's date in YYYY-MM-DD format (timezone-safe ISO slice)
 */
export function computePersonalTileCounts(
  issues: JiraIssue[],
  displayName: string,
  today: string,
): { open: number; inProgress: number; overdue: number } {
  const myNonSubtasks = issues.filter(
    (i) =>
      !i.fields.issuetype.subtask &&
      i.fields.assignee?.displayName === displayName,
  );

  const open = myNonSubtasks.filter(
    (i) => i.fields.status.statusCategory?.key !== 'done',
  ).length;

  const inProgress = myNonSubtasks.filter(
    (i) => i.fields.status.statusCategory?.key === 'indeterminate',
  ).length;

  const overdue = myNonSubtasks.filter((i) => {
    const duedate = i.fields.duedate as string | null | undefined;
    return (
      !!duedate &&
      duedate < today &&
      i.fields.status.statusCategory?.key !== 'done'
    );
  }).length;

  return { open, inProgress, overdue };
}

/**
 * Build donut chart data segments: story points by statusCategory over non-subtask issues.
 * Implements D-07 / D-08:
 *   - Segments: to-do (chart-1), in-progress (chart-2), done (chart-3)
 *   - Segments with value === 0 are excluded (Recharts renders empty slices incorrectly)
 *   - Colors are CSS-var strings — no hardcoded hex
 */
export function computeDonutData(issues: JiraIssue[], spKey: string): DonutSegment[] {
  const nonSubtasks = filterNonSubtasks(issues);

  const spByCategory = { new: 0, indeterminate: 0, done: 0 };
  for (const issue of nonSubtasks) {
    const cat = issue.fields.status.statusCategory?.key ?? 'new';
    const sp = (issue.fields[spKey] as number | null | undefined) ?? 0;
    if (cat in spByCategory) {
      spByCategory[cat as keyof typeof spByCategory] += sp;
    } else {
      spByCategory.new += sp; // fallback for unknown categories
    }
  }

  return [
    { name: 'todo', value: spByCategory.new, fill: 'var(--chart-1)' },
    { name: 'inProgress', value: spByCategory.indeterminate, fill: 'var(--chart-2)' },
    { name: 'done', value: spByCategory.done, fill: 'var(--chart-3)' },
  ].filter((d) => d.value > 0);
}

/**
 * Days remaining until sprint end. Lifted verbatim from DashboardSprintCard.tsx lines 29–34.
 * Returns null when endDate is absent or invalid (NaN).
 * Returns 0 when the sprint ends today or earlier.
 */
export function getDaysRemaining(endDateIso: string | undefined): number | null {
  if (!endDateIso) return null;
  const ms = new Date(endDateIso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
