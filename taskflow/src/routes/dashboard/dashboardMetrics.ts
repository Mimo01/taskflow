/**
 * dashboardMetrics.ts — Phase 83 DASH-02/03/04/05/07/08/09 + Phase 84 DASH-04/05/06 + Phase 85 INSIGHT-01/02
 *
 * Pure derivation functions for Dashboard stat tiles, sprint health chart,
 * weekly trend chart, MR review queue grouping, and activity strip.
 * NO React, NO hooks. Importable in unit tests without any DOM environment.
 *
 * Single source of truth for every stat tile and the donut.
 * Downstream UI imports these functions and never re-derives inline.
 */
import type { GitLabCommit } from '@/services/gitlab';
import type { JiraActiveSprint, JiraActivityItem, JiraIssue } from '@/services/jira';
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

// ---------------------------------------------------------------------------
// Phase 85 — INSIGHT-01/02: Personal velocity series + burndown parser +
// hours formatter (single source of truth for burndown axis/tooltip)
// ---------------------------------------------------------------------------

/**
 * Formats decimal hours as a human-readable h+m string.
 * 1.5 → "1h 30m", 8 → "8h", 0.25 → "15m". Minutes rounded to the nearest minute.
 *
 * Single source of truth for the Phase 85 burndown hours axis/tooltip formatter.
 * Reused by WeeklyTrendChart (extracted from its local copy) and BurndownChart (85-04).
 * Unit is HOURS — never SP (Probe C: statisticField=timeestimate).
 */
export function formatHoursMinutes(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * A single data point in the personal velocity series.
 * Implements INSIGHT-01.
 */
export interface VelocityPoint {
  sprintName: string;
  /** Sum of SP for all my non-subtask issues in the closed sprint (final-assigned scope). */
  committed: number;
  /** Sum of SP for my DONE non-subtask issues in the closed sprint. */
  completed: number;
}

/**
 * Derives a personal velocity series from a list of closed sprints and their issues.
 *
 * Implements INSIGHT-01:
 *   - Personal filter: only issues where assignee.displayName === displayName (D-01)
 *   - Subtask exclusion: !issuetype.subtask (D-04)
 *   - committed = sum of SP for all my non-subtask issues (D-03)
 *   - completed = sum of SP for my DONE non-subtask issues (D-03)
 *   - Does NOT slice or reorder sprints — tail selection is the 85-02 fetcher's job (Probe A landmine)
 *   - Returns one VelocityPoint per input sprint; callers filter `committed > 0 || completed > 0`
 *     to determine qualifying sprints (drives the D-06 <3 guard)
 *
 * @param sprints         Closed sprint list (in order received — DO NOT reorder here)
 * @param issuesBySprint  Map from sprint.id to the issues in that sprint
 * @param displayName     Current user's Jira displayName (D-01 — no accountId plumbing)
 * @param spKey           Story points custom field key (e.g. 'customfield_10016')
 */
export function computePersonalVelocitySeries(
  sprints: JiraActiveSprint[],
  issuesBySprint: Map<number, JiraIssue[]>,
  displayName: string,
  spKey: string,
): VelocityPoint[] {
  return sprints.map((sprint) => {
    const issues = issuesBySprint.get(sprint.id) ?? [];
    const myNonSubtasks = issues.filter(
      (i) => !i.fields.issuetype.subtask && i.fields.assignee?.displayName === displayName,
    );

    // "Committed" here = my final-assigned sprint scope, NOT start-of-sprint commitment — mid-sprint scope additions and assignee changes are not captured. Acceptable approximation for a personal trend (probe confirmed 2026-06-15).
    const committed = myNonSubtasks.reduce(
      (sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0),
      0,
    );

    const completed = myNonSubtasks
      .filter((i) => i.fields.status.statusCategory?.key === 'done')
      .reduce((sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0), 0);

    return { sprintName: sprint.name, committed, completed };
  });
}

/**
 * A single data point in the burndown series.
 * `t` is epoch ms; `remaining` is seconds remaining (Jira timeestimate unit — divide by 3600 for hours).
 * Implements INSIGHT-02.
 */
export interface BurndownPoint {
  /** Epoch milliseconds (for XAxis domain / tick formatting). */
  t: number;
  /** Seconds remaining at this point (Jira timeestimate native unit). Divide by 3600 for hours in tooltip/axis. */
  remaining: number;
}

/**
 * Converts the GreenHopper scopechangeburndownchart `.changes` record into a sorted
 * BurndownPoint series, anchored at `startTime`.
 *
 * Implements INSIGHT-02 with V5 Input Validation (T-85-01):
 *   - `changes ?? {}` guards null/undefined input
 *   - numeric-ascending sort on epoch keys (string sort would misorder epochs)
 *   - `?? 0` on newValue/oldValue guards malformed numeric fields
 *   - `Math.max(0, running)` clamps negative remaining (Tampering mitigation T-85-01)
 *   - Entries without `statC` are skipped (shape assumption A2 is defensive)
 *
 * @param changes    Record keyed by epoch-ms string; each value is an array of change entries
 * @param startTime  Sprint start time as epoch ms — used as the first anchor point
 */
export function parseBurndownChanges(
  changes: Record<
    string,
    Array<{ key: string; statC?: { newValue: number; oldValue: number }; added?: boolean }>
  >,
  startTime: number,
): BurndownPoint[] {
  // V5: guard null/undefined .changes from malformed GreenHopper response (T-85-01)
  const safe = changes ?? {};

  // Numeric ascending sort — string sort would misorder epoch keys (e.g. '1000' < '200' lexically is wrong)
  const timestamps = Object.keys(safe)
    .map(Number)
    .sort((a, b) => a - b);

  // Seed with sprint-start anchor at remaining=0
  const points: BurndownPoint[] = [{ t: startTime, remaining: 0 }];
  let running = 0;

  for (const ts of timestamps) {
    const entries = safe[String(ts)] ?? [];
    for (const entry of entries) {
      if (entry.statC) {
        // Delta: newValue - oldValue captures the net change to remaining time (seconds)
        running += (entry.statC.newValue ?? 0) - (entry.statC.oldValue ?? 0);
      }
      // Entries without statC are skipped — defensive against partial shape (A2)
    }
    // T-85-01: clamp remaining non-negative
    points.push({ t: ts, remaining: Math.max(0, running) });
  }

  return points;
}
