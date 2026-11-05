/**
 * One model for every per-issue time bar (My Tasks, standup, issue sidebar, Worklog, epic
 * Stories / story Subtasks rows), built on the epic helpers so rows and epic bars add up
 * (261105-dsl, sketch option A):
 *  - logged + remaining, where remaining is Jira's remaining estimate (fallback estimate −
 *    logged, 0 once done), so a forecast overrun shows before it is logged;
 *  - a story with known subtasks splits by each subtask's status (own time + every subtask);
 *  - without subtask data a story uses Jira's aggregate fields when present, else its own.
 */
import {
  deriveTimeSegments,
  estimateOf,
  loggedOf,
  remainingOf,
  type TimeSegment,
} from '@/lib/epic-progress';
import { OVERRUN_RED_RATIO } from '@/lib/time-progress';
import type { JiraIssue } from '@/services/jira';

/** Anything with Jira time-tracking fields (search results, subtask enrichment, issue detail). */
export interface TimedSource {
  key?: string;
  fields: {
    status?: { statusCategory?: unknown } | null;
    timetracking?: {
      timeSpentSeconds?: number;
      originalEstimateSeconds?: number;
      remainingEstimateSeconds?: number;
    } | null;
    aggregatetimespent?: number | null;
    aggregatetimeoriginalestimate?: number | null;
    aggregatetimeestimate?: number | null;
    /** The issue's own time spent (search/detail top-level field). */
    timespent?: number | null;
  };
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function shaped(
  src: TimedSource,
  t: { spent?: number | null; original?: number | null; remaining?: number | null },
): JiraIssue {
  const fields: Record<string, unknown> = { status: src.fields.status ?? undefined };
  if (num(t.original)) {
    fields.timeoriginalestimate = t.original;
    fields.aggregatetimeoriginalestimate = t.original;
  }
  if (num(t.spent)) fields.aggregatetimespent = t.spent;
  if (num(t.remaining)) fields.aggregatetimeestimate = t.remaining;
  return { key: src.key ?? '', fields } as unknown as JiraIssue;
}

/** The issue's OWN time (timetracking), shaped for the epic helpers. */
export function ownTimed(src: TimedSource): JiraIssue {
  const tt = src.fields.timetracking;
  return shaped(src, {
    spent: tt?.timeSpentSeconds ?? src.fields.timespent,
    original: tt?.originalEstimateSeconds,
    remaining: tt?.remainingEstimateSeconds,
  });
}

const sumOf = (xs: readonly JiraIssue[], key: string): number =>
  xs.reduce((n, s) => n + ((s.fields[key] as number | undefined) ?? 0), 0);

function hasAggregates(src: TimedSource): boolean {
  const f = src.fields;
  return num(f.aggregatetimespent) || num(f.aggregatetimeoriginalestimate);
}

/**
 * Issues a bar covers. Subtask (or no subtasks known): just the issue, using Jira's aggregate
 * fields for a story when present. Story with subtasks: own time + each subtask, so the bar
 * splits by subtask status.
 */
export function timeBarIssues(
  issue: TimedSource,
  subtasks?: readonly TimedSource[] | null,
  { isSubtask = false }: { isSubtask?: boolean } = {},
): JiraIssue[] {
  if (!isSubtask && subtasks && subtasks.length > 0) {
    const subs = subtasks.map(ownTimed);
    if (!hasAggregates(issue)) return [ownTimed(issue), ...subs];
    // Jira's aggregates are the truth for the totals (they include e.g. Tempo-logged time the
    // per-subtask fields can miss): the story's own part is the aggregate minus its subtasks.
    const f = issue.fields;
    const tt = f.timetracking;
    const residual = (agg: number | null | undefined, key: string, own: number | undefined) =>
      num(agg) ? Math.max(agg - sumOf(subs, key), 0) : own;
    const own = shaped(issue, {
      spent: residual(f.aggregatetimespent, 'aggregatetimespent', tt?.timeSpentSeconds),
      original: residual(
        f.aggregatetimeoriginalestimate,
        'aggregatetimeoriginalestimate',
        tt?.originalEstimateSeconds,
      ),
      remaining: tt?.remainingEstimateSeconds,
    });
    return [own, ...subs];
  }
  if (!isSubtask && hasAggregates(issue)) {
    const f = issue.fields;
    return [
      shaped(issue, {
        spent: f.aggregatetimespent ?? f.timespent ?? f.timetracking?.timeSpentSeconds,
        original: f.aggregatetimeoriginalestimate ?? f.timetracking?.originalEstimateSeconds,
        remaining: f.aggregatetimeestimate ?? f.timetracking?.remainingEstimateSeconds,
      }),
    ];
  }
  return [ownTimed(issue)];
}

export type Overrun = 'none' | 'amber' | 'red';

export interface TimeBarModel {
  segments: TimeSegment[];
  estimate: number;
  logged: number;
  remaining: number;
  /** Σ per issue max(logged + remaining − estimate, 0) over estimated issues. */
  over: number;
  /** Σ per issue max(estimate − logged − remaining, 0) over estimated issues. */
  under: number;
  /** Logged alone beyond the estimate (caption colour): amber up to 125%, red beyond. */
  loggedOverrun: Overrun;
}

export function timeBarModel(issues: readonly JiraIssue[]): TimeBarModel {
  let estimate = 0;
  let logged = 0;
  let remaining = 0;
  let over = 0;
  let under = 0;
  for (const s of issues) {
    const e = estimateOf(s);
    const l = loggedOf(s);
    const r = remainingOf(s);
    estimate += e;
    logged += l;
    remaining += r;
    if (e > 0) {
      over += Math.max(l + r - e, 0);
      under += Math.max(e - l - r, 0);
    }
  }
  const loggedOverrun: Overrun =
    estimate > 0 && logged > estimate
      ? logged > estimate * OVERRUN_RED_RATIO
        ? 'red'
        : 'amber'
      : 'none';
  return {
    segments: deriveTimeSegments([...issues]),
    estimate,
    logged,
    remaining,
    over,
    under,
    loggedOverrun,
  };
}
