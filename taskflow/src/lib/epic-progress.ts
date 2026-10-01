import type { EpicWorklogDay, JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';

export type Metric = 'count' | 'sp' | 'time';
export type Cat = 'new' | 'indeterminate' | 'done';

export interface BurnupPoint {
  date: string;
  label: string;
  scope: number;
  done: number;
}
export interface TimeBurnupPoint {
  date: string;
  label: string;
  /** Seconds. */
  estimate: number;
  /** Seconds. */
  logged: number;
}
export interface StatusBucket {
  id: string;
  name: string;
  cat: Cat;
  count: number;
  points: number;
  /** Sum of aggregate original estimate (seconds), regardless of metric. */
  seconds: number;
  value: number;
}
export interface AssigneeBucket {
  id: string;
  name: string;
  done: number;
  inProgress: number;
  todo: number;
  remaining: number;
  /** Aggregate time logged / estimated (seconds), regardless of metric. */
  logged: number;
  estimate: number;
}
export interface TimeTotals {
  estimated: number;
  logged: number;
  remaining: number;
  pctLogged: number | null;
}
export interface Forecast {
  pctDone: number;
  finishDate: string | null;
  reason: 'done' | 'insufficient' | 'ok';
  unestimated: number;
  unassignedOpen: number;
  total: number;
  doneTotal: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CAT_ORDER: Record<Cat, number> = { done: 0, indeterminate: 1, new: 2 };
const DAY_MS = 86_400_000;

function toMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDays(key: string, n: number): string {
  return new Date(toMs(key) + n * DAY_MS).toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / DAY_MS);
}

function validKey(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const k = v.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : null;
}

function labelOf(key: string): string {
  const [, m, d] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** Format a YYYY-MM-DD key as "MMM d" (locale-independent). */
export function formatDateKey(key: string): string {
  return validKey(key) ? labelOf(key) : key;
}

export function catOf(s: JiraIssue): Cat {
  const k = s.fields.status?.statusCategory?.key;
  return k === 'done' || k === 'indeterminate' ? k : 'new';
}

function spOf(s: JiraIssue, spKey: string): number | null {
  const v = s.fields[spKey];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

type SecKey =
  | 'aggregatetimeoriginalestimate'
  | 'aggregatetimespent'
  | 'aggregatetimeestimate'
  | 'timeoriginalestimate';
function secOf(s: JiraIssue, key: SecKey): number | null {
  const v = s.fields[key];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Single source for the estimate-formula tooltip copy. */
export const ESTIMATE_FORMULA_NOTE =
  'Per story: sum of its subtask estimates; stories without estimated subtasks use their own estimate.';

/**
 * Per-story estimate (seconds): the sum of its subtasks' original estimates
 * when any exist, else the story's own original estimate.
 */
export function estimateOf(s: JiraIssue): number {
  const own = secOf(s, 'timeoriginalestimate') ?? 0;
  const subSum = Math.max(0, (secOf(s, 'aggregatetimeoriginalestimate') ?? 0) - own);
  return subSum > 0 ? subSum : own;
}

/** Per-story logged time (seconds), story + subtasks (Jira aggregate). */
export function loggedOf(s: JiraIssue): number {
  return secOf(s, 'aggregatetimespent') ?? 0;
}

export function weightOf(s: JiraIssue, metric: Metric, spKey: string): number {
  if (metric === 'count') return 1;
  if (metric === 'time') return estimateOf(s);
  return spOf(s, spKey) ?? 0;
}

/** Date key a done story was completed; null when the story is not in the done category. */
export function doneDateKey(s: JiraIssue, today: string): string | null {
  if (catOf(s) !== 'done') return null;
  const k =
    validKey(s.fields.resolutiondate) ??
    validKey(s.fields.statuscategorychangedate) ??
    validKey(s.fields.updated) ??
    today;
  // Jira timestamps carry the server offset; clamp so a late-night resolve can't land past local today.
  return k > today ? today : k;
}

/** Daily axis when the span is <= 31 days, else weekly steps plus today. */
function buildAxis(start: string, today: string): string[] {
  const dates: string[] = [];
  const span = diffDays(start, today);
  if (span <= 31) {
    for (let i = 0; i <= span; i++) dates.push(addDays(start, i));
  } else {
    for (let d = addDays(start, 6); d < today; d = addDays(d, 7)) dates.push(d);
    dates.push(today);
  }
  return dates;
}

export function deriveBurnup(
  stories: JiraIssue[],
  metric: Metric,
  spKey: string,
  epicCreated: string | undefined,
  today: string,
): BurnupPoint[] {
  const created = stories.map((s) => {
    const k = validKey(s.fields.created);
    return k !== null && k > today ? today : k;
  });
  const datedCreated = created.filter((c): c is string => c !== null);
  if (datedCreated.length === 0) return [];
  let start = datedCreated.reduce((a, b) => (a < b ? a : b));
  const epicDay = validKey(epicCreated);
  if (epicDay && epicDay < start) start = epicDay;
  if (start > today) start = today;

  const dates = buildAxis(start, today);

  const scopeItems = stories.map((s, i) => ({ k: created[i], w: weightOf(s, metric, spKey) }));
  const doneItems = stories.flatMap((s) => {
    const k = doneDateKey(s, today);
    return k ? [{ k, w: weightOf(s, metric, spKey) }] : [];
  });

  return dates.map((date) => {
    let scope = 0;
    for (const it of scopeItems) if (it.k !== null && it.k <= date) scope += it.w;
    let done = 0;
    for (const it of doneItems) if (it.k <= date) done += it.w;
    return { date, label: labelOf(date), scope, done: Math.min(done, scope) };
  });
}

export function deriveStatusBuckets(
  stories: JiraIssue[],
  metric: Metric,
  spKey: string,
): StatusBucket[] {
  const map = new Map<string, StatusBucket>();
  for (const s of stories) {
    const name = s.fields.status?.name ?? 'Unknown';
    const cat = catOf(s);
    const id = `${cat}:${name}`;
    let b = map.get(id);
    if (!b) {
      b = { id, name, cat, count: 0, points: 0, seconds: 0, value: 0 };
      map.set(id, b);
    }
    b.count += 1;
    b.points += weightOf(s, 'sp', spKey);
    b.seconds += estimateOf(s);
    b.value += weightOf(s, metric, spKey);
  }
  return [...map.values()].sort(
    (a, b) =>
      CAT_ORDER[a.cat] - CAT_ORDER[b.cat] || b.value - a.value || a.name.localeCompare(b.name),
  );
}

export function deriveAssigneeBuckets(
  stories: JiraIssue[],
  metric: Metric,
  spKey: string,
): AssigneeBucket[] {
  const map = new Map<string, AssigneeBucket>();
  for (const s of stories) {
    const a = s.fields.assignee;
    // Key by DC username so same-named users (or a user literally named "Unassigned") don't merge.
    const id = a ? `user:${a.name || a.displayName}` : 'unassigned';
    let b = map.get(id);
    if (!b) {
      b = {
        id,
        name: a?.displayName || a?.name || 'Unassigned',
        done: 0,
        inProgress: 0,
        todo: 0,
        remaining: 0,
        logged: 0,
        estimate: 0,
      };
      map.set(id, b);
    }
    b.logged += loggedOf(s);
    b.estimate += estimateOf(s);
    const w = weightOf(s, metric, spKey);
    const c = catOf(s);
    if (c === 'done') b.done += w;
    else if (c === 'indeterminate') b.inProgress += w;
    else b.todo += w;
  }
  const out = [...map.values()];
  for (const b of out) b.remaining = b.inProgress + b.todo;
  return out.sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name));
}

export function deriveForecast(
  stories: JiraIssue[],
  metric: Metric,
  spKey: string,
  today: string,
): Forecast {
  let total = 0;
  let doneTotal = 0;
  let unestimated = 0;
  let unassignedOpen = 0;
  let windowItems = 0;
  let windowValue = 0;
  const windowStart = addDays(today, -28);
  for (const s of stories) {
    const w = weightOf(s, metric, spKey);
    total += w;
    if (spOf(s, spKey) === null) unestimated += 1;
    const dk = doneDateKey(s, today);
    if (dk !== null) {
      doneTotal += w;
      if (dk > windowStart && dk <= today) {
        windowItems += 1;
        windowValue += w;
      }
    } else if (!s.fields.assignee) {
      unassignedOpen += 1;
    }
  }
  const allDone = stories.length > 0 && stories.every((s) => catOf(s) === 'done');
  const pctDone = allDone ? 100 : total > 0 ? Math.round((doneTotal / total) * 100) : 0;
  const base = { pctDone, unestimated, unassignedOpen, total, doneTotal };
  if (allDone) return { ...base, finishDate: null, reason: 'done' };
  if (windowItems < 2 || windowValue <= 0) {
    return { ...base, finishDate: null, reason: 'insufficient' };
  }
  const perWeek = windowValue / 4;
  const days = Math.ceil(((total - doneTotal) / perWeek) * 7);
  return { ...base, finishDate: addDays(today, days), reason: 'ok' };
}

export function deriveTimeTotals(stories: JiraIssue[]): TimeTotals {
  let estimated = 0;
  let logged = 0;
  let remaining = 0;
  for (const s of stories) {
    const est = estimateOf(s);
    const log = loggedOf(s);
    estimated += est;
    logged += log;
    if (catOf(s) !== 'done') remaining += Math.max(est - log, 0);
  }
  return {
    estimated,
    logged,
    remaining,
    pctLogged: estimated > 0 ? Math.round((logged / estimated) * 100) : null,
  };
}

/**
 * Worklog-based time burnup (collapse model). Logged is cumulative worklog
 * time; Estimate is, per started story, max(estimate, logged so far) while
 * open and logged so far once done.
 */
export function deriveTimeBurnup(
  stories: JiraIssue[],
  logs: Map<string, EpicWorklogDay[]>,
  epicCreated: string | undefined,
  today: string,
): TimeBurnupPoint[] {
  const items = stories.map((s) => {
    const c = validKey(s.fields.created);
    const created = c !== null && c > today ? today : c;
    const entries = (logs.get(s.key) ?? [])
      .flatMap((l) => {
        const k = validKey(l.day);
        const sec = l.seconds;
        if (k === null || !Number.isFinite(sec) || sec <= 0) return [];
        return [{ day: k > today ? today : k, seconds: sec }];
      })
      .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    // Reconcile with Jira's aggregate logged time (what the tiles use): worklogs we can't date
    // (invalid `started`, deleted authors, moved subtasks) land on today so the final gap == Remaining.
    const charted = entries.reduce((n, e) => n + e.seconds, 0);
    const unattributed = loggedOf(s) - charted;
    if (logs.size > 0 && unattributed > 0) entries.push({ day: today, seconds: unattributed });
    const first = entries.length > 0 ? entries[0].day : null;
    const startDay =
      created !== null && first !== null ? (created < first ? created : first) : (created ?? first);
    return {
      entries,
      startDay,
      doneDay: doneDateKey(s, today),
      est: estimateOf(s),
      ptr: 0,
      sum: 0,
    };
  });

  const starts = items.map((it) => it.startDay).filter((d): d is string => d !== null);
  const epicDay = validKey(epicCreated);
  const candidates = epicDay ? [...starts, epicDay] : starts;
  if (candidates.length === 0) return [];
  let axisStart = candidates.reduce((a, b) => (a < b ? a : b));
  if (axisStart > today) axisStart = today;
  for (const it of items) if (it.startDay === null) it.startDay = axisStart;

  return buildAxis(axisStart, today).map((date) => {
    let logged = 0;
    let estimate = 0;
    for (const it of items) {
      while (it.ptr < it.entries.length && it.entries[it.ptr].day <= date) {
        it.sum += it.entries[it.ptr].seconds;
        it.ptr += 1;
      }
      logged += it.sum;
      if (it.startDay !== null && it.startDay <= date) {
        const done = it.doneDay !== null && it.doneDay <= date;
        estimate += done ? it.sum : Math.max(it.est, it.sum);
      }
    }
    return { date, label: labelOf(date), estimate, logged };
  });
}

export function formatMetric(n: number, metric: Metric): string {
  if (metric === 'time') return formatDuration(n);
  const v = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  return metric === 'sp' ? `${v} SP` : v;
}
