/**
 * dashboardMetrics.ts — Phase 83 DASH-02/03/04/05/07/08/09 + Phase 84 DASH-04/05/06
 *
 * Pure derivation functions for Dashboard stat tiles, sprint health chart,
 * weekly trend chart, MR review queue grouping, and activity strip.
 * NO React, NO hooks. Importable in unit tests without any DOM environment.
 *
 * Single source of truth for every stat tile and the donut.
 * Downstream UI imports these functions and never re-derives inline.
 */
import type { GitLabCommit } from '@/services/gitlab';
import type { JiraActivityItem, JiraIssue } from '@/services/jira';
import type { TempoWorklog } from '@/services/tempo/types';

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
    (i) => !i.fields.issuetype.subtask && i.fields.assignee?.displayName === displayName,
  );

  const open = myNonSubtasks.filter((i) => i.fields.status.statusCategory?.key !== 'done').length;

  const inProgress = myNonSubtasks.filter(
    (i) => i.fields.status.statusCategory?.key === 'indeterminate',
  ).length;

  const overdue = myNonSubtasks.filter((i) => {
    const duedate = i.fields.duedate as string | null | undefined;
    return !!duedate && duedate < today && i.fields.status.statusCategory?.key !== 'done';
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

// ---------------------------------------------------------------------------
// Phase 84 — DASH-04/06: Trend chart bucketing + MR role grouping
// ---------------------------------------------------------------------------

/**
 * A single Mon–Fri bucket for the weekly trend chart.
 * Implements DASH-04 criterion 1 (timezone-safe bucketing).
 */
export interface WeekBucket {
  /** Calendar date as YYYY-MM-DD (no timezone shift). */
  day: string;
  /** Short weekday label for chart axis. */
  label: string;
  /** Hours logged in this bucket (summed from matching worklogs). */
  hours: number;
}

/**
 * Daily logged-hours target (8h). Exported for chart reference-line use.
 */
export const DAILY_TARGET_HOURS = 8;

/**
 * Add N calendar days to a YYYY-MM-DD string.
 * Uses Date.UTC for arithmetic only — input and output are calendar dates with no timezone shift.
 *
 * The toISOString() below is the ONE sanctioned use in this module: it reads back a Date that
 * was *UTC-constructed* via Date.UTC, so the UTC write and UTC read cancel exactly — there is no
 * local-timezone component to shift (DST-immune). This is NOT the banned pattern, which is calling
 * toISOString() on a *locally*-constructed Date (new Date(y,m,d) / new Date()). Do not "simplify"
 * Date.UTC → new Date here: that would reintroduce the off-by-one this construction avoids.
 */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Date.UTC treats its arguments as calendar components in UTC — safe for date arithmetic.
  const utcMs = Date.UTC(y, m - 1, d + n);
  return new Date(utcMs).toISOString().slice(0, 10);
}

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

/**
 * Build 5 Mon–Fri buckets for the week starting at `weekStart` (Monday).
 * Zero-fills all buckets; then sums worklog hours into the bucket whose
 * `day` equals `worklog.dateStarted` via direct string equality.
 *
 * Implements DASH-04 criterion 1: bucketing uses the pre-normalized
 * `dateStarted` field (already YYYY-MM-DD from fetchWorklogs) — never
 * re-derives from a raw ISO timestamp to avoid UTC-shift bugs.
 *
 * @param worklogs  Array of TempoWorklog — `dateStarted` already YYYY-MM-DD
 * @param weekStart Monday of the target week as YYYY-MM-DD
 */
export function buildWeekBuckets(worklogs: TempoWorklog[], weekStart: string): WeekBucket[] {
  // Build zero-filled buckets for Mon–Fri.
  const buckets: WeekBucket[] = WEEK_LABELS.map((label, i) => ({
    day: addDays(weekStart, i),
    label,
    hours: 0,
  }));

  // Match each worklog to its bucket by direct string equality on the pre-normalized date field.
  for (const wl of worklogs) {
    const bucket = buckets.find((b) => b.day === wl.dateStarted);
    if (bucket) {
      bucket.hours += wl.timeSpentSeconds / 3600;
    }
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// Phase 84 — DASH-05: Activity strip interleaving
// ---------------------------------------------------------------------------

/**
 * A discriminated-union entry in the merged activity timeline.
 * Implements DASH-05 criterion 2.
 */
export type ActivityEntry =
  | { type: 'jira'; at: string; item: JiraActivityItem }
  | { type: 'commit'; at: string; item: GitLabCommit };

/**
 * Merge Jira activity items and GitLab commits into a single newest-first
 * timeline, capped at `cap` entries.
 *
 * Each Jira item's `transitions` array is flatMapped into individual entries
 * (one per transition). Commits map 1-to-1 using `authored_date`.
 *
 * Sort uses ISO 8601 string comparison (`b.at.localeCompare(a.at)`) — no
 * Date construction needed because ISO strings sort correctly lexicographically.
 *
 * Implements DASH-05 (criterion 2 interleave) per D-10.
 *
 * @param jiraItems  Array of JiraActivityItem from fetchYesterdayJiraActivity
 * @param commits    Array of GitLabCommit from fetchUserCommits
 * @param cap        Maximum number of entries to return
 */
export function mergeActivityEntries(
  jiraItems: JiraActivityItem[],
  commits: GitLabCommit[],
  cap: number,
): ActivityEntry[] {
  const jiraEntries: ActivityEntry[] = jiraItems.flatMap((item) =>
    item.transitions.map((t) => ({ type: 'jira' as const, at: t.at, item })),
  );

  const commitEntries: ActivityEntry[] = commits.map((c) => ({
    type: 'commit' as const,
    at: c.authored_date,
    item: c,
  }));

  return [...jiraEntries, ...commitEntries].sort((a, b) => b.at.localeCompare(a.at)).slice(0, cap);
}
