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
  /**
   * Ideal-burndown guideline at this point (seconds). A straight reference line
   * from the peak committed scope down to 0 at `endTime`. Lets the chart read as a
   * true burndown (actual remaining vs. ideal pace) rather than a bare scope curve.
   * `undefined` when no usable sprint window (`endTime`) is supplied.
   */
  ideal?: number;
}

/**
 * Converts the GreenHopper scopechangeburndownchart `.changes` record into a sorted
 * BurndownPoint series, anchored at `startTime`.
 *
 * Remaining-work model (INSIGHT-02): the scopechangeburndownchart records every delta
 * to the tracked statistic (`timeestimate`, seconds) — scope additions raise remaining,
 * completed work lowers it. For a timeestimate statistic the per-issue delta lives in
 * `timeC: { oldEstimate, newEstimate }` (CONFIRMED live 2026-06-15); the running cumulative
 * of `newEstimate - oldEstimate` reconstructs the TRUE remaining-work line across the sprint,
 * including scope changes. `statC: { newValue, oldValue }` is the fallback for boards whose
 * statistic is not time (e.g. story points).
 * The series legitimately rises when scope is added and falls as work burns down; for a
 * normal sprint the committed scope is added at activation, so remaining jumps to the
 * committed total near the start and then descends. This is correct scope-change-burndown
 * behaviour — do NOT "fix" it to a monotone decrease (that would discard scope creep).
 *
 * Sprint windowing (UAT-4b): `.changes` holds each in-sprint issue's ENTIRE estimate
 * history (often a year+ of pre-sprint edits). Changes BEFORE `startTime` are folded into
 * the baseline — the committed remaining anchored at `startTime` — but emit no visible
 * points. Only `[startTime, endTime]` changes are plotted, so the x-axis is the sprint, not
 * the issues' whole lifetimes. With no `endTime`, the upper bound is open (active sprint).
 *
 * The dashed ideal guideline is built SEPARATELY by `buildIdealGuideline` (its own dense
 * daily series, flat across weekends) — this function only produces the actual `remaining`
 * series. `endTime` here is used solely to bound the plotted window (above).
 *
 * V5 Input Validation (T-85-01):
 *   - `changes ?? {}` guards null/undefined input
 *   - non-finite epoch keys are dropped, then numeric-ascending sort (string sort misorders epochs)
 *   - `?? 0` on the estimate/value fields guards malformed numeric fields
 *   - `Math.max(0, running)` clamps negative remaining (Tampering mitigation T-85-01)
 *   - Entries without `timeC` or `statC` are skipped (shape is defensive/all-optional)
 *
 * @param changes    Record keyed by epoch-ms string; each value is an array of change entries
 * @param startTime  Sprint start time as epoch ms — the first anchor point
 * @param endTime    Sprint end time as epoch ms — upper bound of the plotted window.
 *                   Omit (or pass a value ≤ startTime) for an open-ended (active) window.
 */
export function parseBurndownChanges(
  changes: Record<
    string,
    Array<{
      key?: string;
      timeC?: { oldEstimate?: number; newEstimate?: number; timeSpent?: number };
      statC?: { newValue?: number; oldValue?: number };
      added?: boolean;
    }>
  >,
  startTime: number,
  endTime?: number,
): BurndownPoint[] {
  // V5: guard null/undefined .changes from malformed GreenHopper response (T-85-01)
  const safe = changes ?? {};

  // Drop non-finite keys (defensive), then numeric ascending sort — string sort would
  // misorder epoch keys (e.g. '1000' < '200' lexically is wrong).
  const timestamps = Object.keys(safe)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  // Sprint window upper bound. GreenHopper `.changes` carries each in-sprint issue's ENTIRE
  // time-estimate history — often a year+ of pre-sprint edits. Bounding to [startTime, endTime]
  // keeps the chart to the sprint, not the issues' whole lifetimes (UAT-4b 2026-06-15).
  const windowEnd = endTime && endTime > startTime ? endTime : Number.POSITIVE_INFINITY;

  // Helper: net delta a change entry applies to remaining (seconds for timeC; raw for statC).
  const delta = (entry: {
    timeC?: { oldEstimate?: number; newEstimate?: number };
    statC?: { newValue?: number; oldValue?: number };
  }): number => {
    if (entry.timeC) return (entry.timeC.newEstimate ?? 0) - (entry.timeC.oldEstimate ?? 0);
    if (entry.statC) return (entry.statC.newValue ?? 0) - (entry.statC.oldValue ?? 0);
    return 0; // neither shape present — skipped (defensive)
  };

  // Fold all PRE-sprint-start changes into the baseline: the committed remaining at sprint
  // start. These telescope per issue (Σ newEstimate-oldEstimate = estimate at that point), so
  // the running total at startTime is the total scope on board when the sprint began. We do
  // NOT emit points for them — they establish the anchor height, not visible history.
  let running = 0;
  for (const ts of timestamps) {
    if (ts >= startTime) break; // ascending — remaining are in-window
    for (const entry of safe[String(ts)] ?? []) running += delta(entry);
  }

  // Anchor at sprint start with the baseline scope (was hardcoded 0 — that flattened the curve
  // and discarded committed scope). T-85-01: clamp remaining non-negative.
  const points: BurndownPoint[] = [{ t: startTime, remaining: Math.max(0, running) }];

  for (const ts of timestamps) {
    if (ts < startTime) continue; // already folded into baseline
    if (ts > windowEnd) break; // past sprint end — outside the window
    for (const entry of safe[String(ts)] ?? []) running += delta(entry);
    // Skip a change landing exactly on startTime collapsing into a duplicate anchor point.
    if (ts === startTime) {
      points[0].remaining = Math.max(0, running);
      continue;
    }
    points.push({ t: ts, remaining: Math.max(0, running) });
  }

  return points;
}

/**
 * Build the dashed ideal-burndown guideline as its OWN dense daily series (UAT-4d).
 *
 * The ideal line burns the committed scope (`peak`, seconds) down to 0, but only on WORKING
 * days (Mon–Fri) — it stays FLAT across weekends, since no work is expected then. A naive
 * straight calendar-time line slopes through Sat/Sun; even per-point working-day math on the
 * sparse actual series would slope across the Fri→Mon gap. So this returns an explicit anchor
 * at every calendar-day boundary in `[startTime, endTime]`, giving the chart a genuinely flat
 * weekend step. Rendered via its own `<Line data={…}>` (NOT mixed into the remaining series,
 * whose area would fragment on the extra points).
 *
 * Weekend detection uses LOCAL day-of-week (what the user sees on the axis). Returns `[]` when
 * there is no usable window or no committed scope — the chart then omits the dashed line.
 *
 * @param peak       Committed scope at sprint start, in SECONDS (max remaining of the actual series)
 * @param startTime  Sprint start (epoch ms) — ideal = peak here
 * @param endTime    Sprint end (epoch ms) — ideal reaches 0 here
 */
export function buildIdealGuideline(
  peak: number,
  startTime: number,
  endTime?: number,
): BurndownPoint[] {
  if (!(peak > 0) || endTime == null || endTime <= startTime) return [];

  const DAY = 86_400_000;
  const isWorkingDay = (t: number): boolean => {
    const dow = new Date(t).getDay(); // 0 = Sun, 6 = Sat (local)
    return dow !== 0 && dow !== 6;
  };
  const startOfDay = (t: number): number => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  // Total working days spanned by the sprint window — the divisor for the burn step.
  let totalWorking = 0;
  for (let t = startOfDay(startTime); t < endTime; t += DAY) {
    if (isWorkingDay(t)) totalWorking++;
  }
  if (totalWorking === 0) totalWorking = 1; // degenerate all-weekend window — avoid /0

  const points: BurndownPoint[] = [{ t: startTime, remaining: 0, ideal: peak }];

  // Emit one anchor per day boundary. A day's burn is credited only if the day that just
  // ENDED was a working day → consecutive weekend anchors share the prior ideal (flat step).
  let workingElapsed = 0;
  const lastDay = startOfDay(endTime);
  for (let t = startOfDay(startTime) + DAY; t <= lastDay; t += DAY) {
    if (isWorkingDay(t - DAY)) workingElapsed++;
    points.push({
      t,
      remaining: 0,
      ideal: Math.max(0, peak * (1 - workingElapsed / totalWorking)),
    });
  }

  // Final anchor exactly at sprint end → 0.
  points.push({ t: endTime, remaining: 0, ideal: 0 });
  return points;
}
