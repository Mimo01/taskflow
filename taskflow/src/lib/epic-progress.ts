import { toLocalDateString } from '@/lib/local-date';
import type { EpicStatusHistory, EpicWorklogDay, JiraIssue, JiraStatus } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';

export type Metric = 'count' | 'sp' | 'time';
export type Cat = 'new' | 'indeterminate' | 'done';

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
  /** Jira avatar (48x48) of the assignee; null for Unassigned or a missing/empty url. */
  avatarUrl: string | null;
}
export interface TimeTotals {
  estimated: number;
  logged: number;
  remaining: number;
  pctLogged: number | null;
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

function avatarOf(a: JiraIssue['fields']['assignee']): string | null {
  const url = a?.avatarUrls?.['48x48'];
  return typeof url === 'string' && url !== '' ? url : null;
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
        avatarUrl: avatarOf(a),
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

// ── Working days ─────────────────────────────────────────────────────────────

export const CAT_LABEL: Record<Cat, string> = {
  done: 'Done',
  indeterminate: 'In progress',
  new: 'To do',
};

function isWorkingDay(key: string): boolean {
  const d = new Date(toMs(key)).getUTCDay();
  return d !== 0 && d !== 6;
}

/** Last Mon-Fri day on or before `key`. */
function prevWorkingDay(key: string): string {
  let k = key;
  while (!isWorkingDay(k)) k = addDays(k, -1);
  return k;
}

/** First Mon-Fri day on or after `key`. */
function nextWorkingDay(key: string): string {
  let k = key;
  while (!isWorkingDay(k)) k = addDays(k, 1);
  return k;
}

/** The date `n` working days (Mon-Fri) after `key`. A weekend start counts from the following Monday. */
export function addWorkingDays(key: string, n: number): string {
  if (n <= 0) return key;
  // From a weekday, whole weeks are a plain 7-day shift; a weekend start is anchored to its Friday.
  let k = prevWorkingDay(key);
  const weeks = Math.floor(n / 5);
  k = addDays(k, weeks * 7);
  let rem = n - weeks * 5;
  while (rem > 0) {
    k = addDays(k, 1);
    if (isWorkingDay(k)) rem -= 1;
  }
  return k;
}

/** Number of Mon-Fri days d with a < d <= b (0 when b <= a). */
export function workingDaysBetween(a: string, b: string): number {
  if (b <= a) return 0;
  const span = diffDays(a, b);
  const weeks = Math.floor(span / 7);
  let count = weeks * 5;
  let k = addDays(a, weeks * 7);
  while (k < b) {
    k = addDays(k, 1);
    if (isWorkingDay(k)) count += 1;
  }
  return count;
}

// ── Adaptive forecast ────────────────────────────────────────────────────────

export const FORECAST_MIN_WINDOW = 3;
export const FORECAST_MAX_WINDOW = 30;
/** Working days without progress before an epic counts as stalled. */
export const FORECAST_STALL_WD = 10;
/** z-score for the 80% range. */
export const FORECAST_Z = 1.28;
export const FORECAST_MIN_EVENTS = 2;

export type ForecastState = 'done' | 'too-early' | 'stalled' | 'not-converging' | 'ok';
export type Confidence = 'low' | 'medium' | 'high';

export interface EpicForecast {
  state: ForecastState;
  likely: string | null;
  optimistic: string | null;
  pessimistic: string | null;
  nLikely: number | null;
  nOpt: number | null;
  nPess: number | null;
  /** Remaining work in the active unit. */
  remaining: number;
  ratePerWeek: number;
  scopeRatePerWeek: number;
  windowDays: number;
  completions: number;
  confidence: Confidence | null;
  explanation: string;
}

export interface ThroughputInput {
  completions: { day: string; w: number }[];
  scopeAdds: { day: string; w: number }[];
  remaining: number;
  allDone: boolean;
  firstActivity: string | null;
  eventCount: number;
  unit: Metric;
}

function fmtUnit(n: number, unit: Metric): string {
  if (unit === 'time') return formatDuration(Math.round(n));
  const v = Math.round(n * 10) / 10;
  return unit === 'sp' ? `${v} SP` : String(v);
}

/** ceil that survives float noise (e.g. 20.000000000000004 stays 20). */
function ceilWd(n: number): number {
  return Math.max(1, Math.ceil(n - 1e-9));
}

/**
 * Pure forecast core. Rates are measured per working day over a window that
 * adapts to the epic's age (clamp(age, 3, 30) working days), EWMA-weighted so
 * recent days count more, net of scope growth. The range is an analytic
 * normal approximation (no Monte Carlo): deterministic and testable.
 */
export function forecastFromThroughput(input: ThroughputInput, today: string): EpicForecast {
  const { unit } = input;
  const base: EpicForecast = {
    state: 'too-early',
    likely: null,
    optimistic: null,
    pessimistic: null,
    nLikely: null,
    nOpt: null,
    nPess: null,
    remaining: Math.max(input.remaining, 0),
    ratePerWeek: 0,
    scopeRatePerWeek: 0,
    windowDays: 0,
    completions: 0,
    confidence: null,
    explanation: '',
  };

  if (input.allDone)
    return { ...base, state: 'done', remaining: 0, explanation: 'All work is done.' };
  if (input.remaining <= 0) {
    return {
      ...base,
      state: 'ok',
      likely: today,
      optimistic: today,
      pessimistic: today,
      nLikely: 0,
      nOpt: 0,
      nPess: 0,
      confidence: 'low',
      explanation: 'Remaining work is unestimated, so no rate-based date can be projected.',
    };
  }
  if (input.firstActivity === null) {
    return { ...base, explanation: 'No work started yet.' };
  }

  // Working-day sampling: the anchor is today (or the previous Friday on a weekend); weekend
  // events count toward the following Monday, clamped to the anchor.
  const anchor = prevWorkingDay(today);
  const offsetOf = (day: string): number => {
    const d = day > today ? today : day;
    let snapped = nextWorkingDay(d);
    if (snapped > anchor) snapped = anchor;
    return workingDaysBetween(snapped, anchor);
  };

  const firstOffset = offsetOf(input.firstActivity);
  const age = firstOffset + 1;
  const W = Math.min(FORECAST_MAX_WINDOW, Math.max(FORECAST_MIN_WINDOW, age));
  const h = Math.max(2, W / 3);
  const weight = (i: number) => 0.5 ** (i / h);

  const done = new Array<number>(W).fill(0);
  const scope = new Array<number>(W).fill(0);
  let completions = 0;
  let lastCompletionOffset: number | null = null;
  for (const c of input.completions) {
    const o = offsetOf(c.day);
    if (lastCompletionOffset === null || o < lastCompletionOffset) lastCompletionOffset = o;
    if (o < W && Number.isFinite(c.w)) {
      done[o] += c.w;
      completions += 1;
    }
  }
  // Scope added before the first activity is initial grooming, not growth; very young
  // epics (age < 5) never count growth at all.
  if (age >= 5) {
    for (const a of input.scopeAdds) {
      if (a.day <= input.firstActivity || !Number.isFinite(a.w)) continue;
      const o = offsetOf(a.day);
      if (o < W) scope[o] += a.w;
    }
  }

  let wSum = 0;
  let mdSum = 0;
  let msSum = 0;
  for (let i = 0; i < W; i++) {
    const w = weight(i);
    wSum += w;
    mdSum += w * done[i];
    msSum += w * scope[i];
  }
  const muD = mdSum / wSum;
  const muS = msSum / wSum;
  const mu = muD - muS;
  let varSum = 0;
  for (let i = 0; i < W; i++) {
    const y = done[i] - scope[i];
    varSum += weight(i) * (y - mu) ** 2;
  }
  const sigmaRaw = Math.sqrt(varSum / wSum) * (1 + 2 / W);
  const sigma = Math.max(sigmaRaw, 0.15 * Math.max(mu, 0));

  const common = {
    ...base,
    ratePerWeek: muD * 5,
    scopeRatePerWeek: muS * 5,
    windowDays: W,
    completions,
  };

  if (input.eventCount < FORECAST_MIN_EVENTS && age < FORECAST_STALL_WD) {
    return {
      ...common,
      state: 'too-early',
      explanation: 'Needs a little more completed work to project a date.',
    };
  }

  const since = lastCompletionOffset ?? firstOffset;
  if (since >= FORECAST_STALL_WD && age >= FORECAST_STALL_WD) {
    return {
      ...common,
      state: 'stalled',
      explanation: `No progress in ${since} working days.`,
    };
  }

  // No completions at all is "too early" (or stalled, above) — never "scope grew faster".
  if (muD <= 0) {
    return {
      ...common,
      state: 'too-early',
      explanation: 'Nothing has been completed yet, so there is no pace to project from.',
    };
  }

  if (mu <= 0 || mu < 0.1 * muD) {
    return {
      ...common,
      state: 'not-converging',
      explanation: `Scope grew ${fmtUnit(muS * 5, unit)}/wk vs ${fmtUnit(muD * 5, unit)}/wk done.`,
    };
  }

  const R = input.remaining;
  const n = R / mu;
  const zs = FORECAST_Z * sigma;
  const root = Math.sqrt(zs * zs + 4 * mu * R);
  const sPess = (zs + root) / (2 * mu);
  const sOpt = (-zs + root) / (2 * mu);
  const nLikely = ceilWd(n);
  const nPess = Math.max(nLikely, ceilWd(sPess * sPess));
  const nOpt = Math.min(nLikely, ceilWd(sOpt * sOpt));

  let confidence: Confidence = 'low';
  if (W >= 20 && completions >= 8 && (sPess * sPess - sOpt * sOpt) / n <= 0.5) confidence = 'high';
  else if (W >= 10 && completions >= 4) confidence = 'medium';

  return {
    ...common,
    state: 'ok',
    likely: addWorkingDays(today, nLikely),
    optimistic: addWorkingDays(today, nOpt),
    pessimistic: addWorkingDays(today, nPess),
    nLikely,
    nOpt,
    nPess,
    confidence,
    explanation: `Based on the last ${W} working days (recent days weigh more): ${fmtUnit(
      muD * 5,
      unit,
    )} done/wk, scope +${fmtUnit(muS * 5, unit)}/wk.`,
  };
}

/** Forecast for Count/SP from the cheap story fields (no changelog needed). */
export function deriveAdaptiveForecast(
  stories: JiraIssue[],
  metric: 'count' | 'sp',
  spKey: string,
  epicCreated: string | undefined,
  today: string,
): EpicForecast {
  const epicDay = validKey(epicCreated);
  const completions: { day: string; w: number }[] = [];
  const scopeAdds: { day: string; w: number }[] = [];
  let total = 0;
  let doneTotal = 0;
  let eventCount = 0;
  let firstActivity: string | null = null;
  const consider = (d: string) => {
    if (firstActivity === null || d < firstActivity) firstActivity = d;
  };
  for (const s of stories) {
    const w = weightOf(s, metric, spKey);
    total += w;
    const dk = doneDateKey(s, today);
    if (dk !== null) {
      doneTotal += w;
      eventCount += 1;
      completions.push({ day: dk, w });
      consider(dk);
    } else if (catOf(s) === 'indeterminate') {
      const k = validKey(s.fields.statuscategorychangedate);
      if (k !== null) consider(k > today ? today : k);
    }
    const c = validKey(s.fields.created);
    let enter = c !== null ? (c > today ? today : c) : (epicDay ?? null);
    if (enter !== null && epicDay !== null && enter < epicDay) enter = epicDay;
    if (enter !== null) scopeAdds.push({ day: enter, w });
  }
  const allDone = stories.length > 0 && stories.every((s) => catOf(s) === 'done');
  return forecastFromThroughput(
    {
      completions,
      scopeAdds,
      remaining: total - doneTotal,
      allDone,
      firstActivity,
      eventCount,
      unit: metric,
    },
    today,
  );
}

/** Time-mode forecast: daily logged-time rate against remaining (estimate - logged). */
export function deriveTimeForecast(
  stories: JiraIssue[],
  logs: Map<string, EpicWorklogDay[]>,
  today: string,
): EpicForecast {
  const perDay = new Map<string, number>();
  for (const s of stories) {
    for (const l of logs.get(s.key) ?? []) {
      const k = validKey(l.day);
      if (k === null || !Number.isFinite(l.seconds) || l.seconds <= 0) continue;
      const day = k > today ? today : k;
      perDay.set(day, (perDay.get(day) ?? 0) + l.seconds);
    }
  }
  const completions = [...perDay.entries()].map(([day, w]) => ({ day, w }));
  let firstActivity: string | null = null;
  for (const c of completions)
    if (firstActivity === null || c.day < firstActivity) firstActivity = c.day;
  const allDone = stories.length > 0 && stories.every((s) => catOf(s) === 'done');
  return forecastFromThroughput(
    {
      completions,
      scopeAdds: [],
      remaining: deriveTimeTotals(stories).remaining,
      allDone,
      firstActivity,
      eventCount: completions.length,
      unit: 'time',
    },
    today,
  );
}

// ── Summary ──────────────────────────────────────────────────────────────────

export interface EpicSummary {
  count: number;
  doneCount: number;
  inProgressCount: number;
  todoCount: number;
  /** Active-metric totals. */
  total: number;
  doneTotal: number;
  inProgressTotal: number;
  todoTotal: number;
  pctDone: number;
  remainingCount: number;
  remainingSp: number;
  remainingSeconds: number;
  /** Stories with no story-point value. */
  unestimatedSp: number;
  /** Open stories with no time estimate. */
  unestimatedTime: number;
  unassignedOpen: number;
}

export function deriveSummary(stories: JiraIssue[], metric: Metric, spKey: string): EpicSummary {
  const r: EpicSummary = {
    count: stories.length,
    doneCount: 0,
    inProgressCount: 0,
    todoCount: 0,
    total: 0,
    doneTotal: 0,
    inProgressTotal: 0,
    todoTotal: 0,
    pctDone: 0,
    remainingCount: 0,
    remainingSp: 0,
    remainingSeconds: deriveTimeTotals(stories).remaining,
    unestimatedSp: 0,
    unestimatedTime: 0,
    unassignedOpen: 0,
  };
  for (const s of stories) {
    const w = weightOf(s, metric, spKey);
    const c = catOf(s);
    r.total += w;
    if (spOf(s, spKey) === null) r.unestimatedSp += 1;
    if (c === 'done') {
      r.doneCount += 1;
      r.doneTotal += w;
      continue;
    }
    r.remainingCount += 1;
    r.remainingSp += spOf(s, spKey) ?? 0;
    if (estimateOf(s) === 0) r.unestimatedTime += 1;
    if (!s.fields.assignee) r.unassignedOpen += 1;
    if (c === 'indeterminate') {
      r.inProgressCount += 1;
      r.inProgressTotal += w;
    } else {
      r.todoCount += 1;
      r.todoTotal += w;
    }
  }
  const allDone = stories.length > 0 && r.doneCount === stories.length;
  r.pctDone = allDone ? 100 : r.total > 0 ? Math.round((r.doneTotal / r.total) * 100) : 0;
  return r;
}

// ── Cumulative flow diagram ──────────────────────────────────────────────────

function catKey(k: string | undefined): Cat {
  return k === 'done' || k === 'indeterminate' ? k : 'new';
}

/**
 * Resolves a status to its category: id via the status list, then name via the
 * status list, then name via the current stories, else 'new'.
 */
export function buildStatusCategoryLookup(
  statusList: JiraStatus[] | undefined,
  stories: JiraIssue[],
): (id: string | null, name: string | null) => Cat {
  const byId = new Map<string, Cat>();
  const byName = new Map<string, Cat>();
  for (const st of statusList ?? []) {
    const c = catKey(st.statusCategory?.key);
    byId.set(String(st.id), c);
    if (!byName.has(st.name)) byName.set(st.name, c);
  }
  const storyByName = new Map<string, Cat>();
  for (const s of stories) {
    const st = s.fields.status;
    if (st?.name && st.statusCategory?.key && !storyByName.has(st.name)) {
      storyByName.set(st.name, catKey(st.statusCategory.key));
    }
  }
  return (id, name) => {
    if (id !== null) {
      const c = byId.get(id);
      if (c) return c;
    }
    if (name !== null) {
      const c = byName.get(name) ?? storyByName.get(name);
      if (c) return c;
    }
    return 'new';
  };
}

export interface CfdPoint {
  date: string;
  /** UTC ms of the date (numeric time axis). */
  t: number;
  label: string;
  done: number | null;
  inProgress: number | null;
  todo: number | null;
  remaining: number | null;
  forecast?: number | null;
  band?: [number, number] | null;
}

const CFD_MAX_DAILY = 120;

interface Segment {
  day: string;
  cat: Cat;
}

function clampDay(day: string, lo: string, hi: string): string {
  return day < lo ? lo : day > hi ? hi : day;
}

/**
 * Cumulative flow from status history. Weights are each story's CURRENT weight
 * (SP edits are not replayed). Transition days use the LOCAL calendar day of the
 * timestamp (matching local `today`); the worklog/done paths use the server-offset
 * slice instead. Falls back to a current-state approximation per story when its
 * history is missing.
 */
export function deriveCfd(args: {
  stories: JiraIssue[];
  history: Map<string, EpicStatusHistory> | null;
  lookup: (id: string | null, name: string | null) => Cat;
  metric: Metric;
  spKey: string;
  epicCreated: string | undefined;
  today: string;
}): { points: CfdPoint[]; approximate: boolean } {
  const { stories, history, lookup, metric, spKey, epicCreated, today } = args;
  const createdOf = stories.map((s) => {
    const k = validKey(s.fields.created);
    return k !== null && k > today ? today : k;
  });
  const epicDay = validKey(epicCreated);
  let start: string | null = null;
  if (epicDay !== null && epicDay <= today) start = epicDay;
  else {
    for (const c of createdOf) if (c !== null && (start === null || c < start)) start = c;
  }
  if (start === null) return { points: [], approximate: history === null };
  const axisStart = start;

  let approximate = history === null;
  const items = stories.map((s, i) => {
    const w = weightOf(s, metric, spKey);
    const h = history?.get(s.key);
    let enter = clampDay(createdOf[i] ?? axisStart, axisStart, today);
    const segs: Segment[] = [];
    if (h) {
      if (h.joinedAt) {
        const j = clampDay(toLocalDateString(new Date(h.joinedAt)), axisStart, today);
        if (j > enter) enter = j;
      }
      const first = h.transitions.length > 0 ? h.transitions[0] : null;
      const initial: Cat = first ? lookup(first.fromId, first.fromName) : catOf(s);
      segs.push({ day: enter, cat: initial });
      for (const t of h.transitions) {
        const at = new Date(t.at);
        if (Number.isNaN(at.getTime())) continue;
        segs.push({
          day: clampDay(toLocalDateString(at), enter, today),
          cat: lookup(t.toId, t.toName),
        });
      }
      // Current status is authoritative for today: replayed transitions can end on an unmapped
      // status (lookup falls back to 'new'), which would disagree with the hero and the forecast.
      const current = catOf(s);
      if (segs[segs.length - 1].cat !== current) segs.push({ day: today, cat: current });
    } else {
      approximate = true;
      segs.push({ day: enter, cat: 'new' });
      const c = catOf(s);
      if (c === 'indeterminate') {
        const k = validKey(s.fields.statuscategorychangedate);
        segs.push({ day: clampDay(k ?? enter, enter, today), cat: 'indeterminate' });
      } else if (c === 'done') {
        const k = doneDateKey(s, today) ?? today;
        segs.push({ day: clampDay(k, enter, today), cat: 'done' });
      }
    }
    return { w: Number.isFinite(w) ? w : 0, enter, segs };
  });

  const span = diffDays(axisStart, today);
  const dates: string[] = [];
  if (span <= CFD_MAX_DAILY) {
    for (let i = 0; i <= span; i++) dates.push(addDays(axisStart, i));
  } else {
    const step = Math.ceil(span / CFD_MAX_DAILY);
    for (let d = axisStart; d < today; d = addDays(d, step)) dates.push(d);
    dates.push(today);
  }

  const points = dates.map((date): CfdPoint => {
    let done = 0;
    let inProgress = 0;
    let todo = 0;
    for (const it of items) {
      if (it.enter > date) continue;
      let cat: Cat = it.segs[0].cat;
      for (const sg of it.segs) if (sg.day <= date) cat = sg.cat;
      if (cat === 'done') done += it.w;
      else if (cat === 'indeterminate') inProgress += it.w;
      else todo += it.w;
    }
    return {
      date,
      t: toMs(date),
      label: labelOf(date),
      done,
      inProgress,
      todo,
      remaining: inProgress + todo,
    };
  });
  return { points, approximate };
}

// ── Projection ───────────────────────────────────────────────────────────────

export interface ProjectionPoint {
  date: string;
  t: number;
  forecast: number;
  band: [number, number];
}

const PROJECTION_MIN_CAP_DAYS = 60;

export function deriveProjection(
  forecast: EpicForecast,
  today: string,
  historyStart: string | null,
): { points: ProjectionPoint[]; clippedAfter: string | null } {
  if (
    forecast.state !== 'ok' ||
    forecast.remaining <= 0 ||
    forecast.nLikely === null ||
    forecast.nOpt === null ||
    forecast.nPess === null ||
    forecast.likely === null ||
    forecast.optimistic === null ||
    forecast.pessimistic === null
  ) {
    return { points: [], clippedAfter: null };
  }
  const R = forecast.remaining;
  const span = historyStart !== null ? Math.max(0, diffDays(historyStart, today)) : 0;
  const cap = addDays(today, Math.max(PROJECTION_MIN_CAP_DAYS, span));
  let clippedAfter: string | null = null;
  const clip = (d: string) => {
    if (d > cap) {
      clippedAfter = cap;
      return cap;
    }
    return d;
  };
  const rateLikely = R / forecast.nLikely;
  const rateOpt = R / forecast.nOpt;
  const rateScenarioPess = R / forecast.nPess;
  const at = (date: string): ProjectionPoint => {
    const wd = workingDaysBetween(today, date);
    return {
      date,
      t: toMs(date),
      forecast: Math.max(0, R - rateLikely * wd),
      band: [Math.max(0, R - rateOpt * wd), Math.max(0, R - rateScenarioPess * wd)],
    };
  };
  const byDate = new Map<string, ProjectionPoint>();
  byDate.set(today, { date: today, t: toMs(today), forecast: R, band: [R, R] });
  for (const d of [forecast.optimistic, forecast.likely, forecast.pessimistic]) {
    const c = clip(d);
    if (!byDate.has(c)) byDate.set(c, at(c));
  }
  return {
    points: [...byDate.values()].sort((a, b) => a.t - b.t),
    clippedAfter,
  };
}

/**
 * Merge a projection into chart points: the today point gets forecast = remaining
 * (a zero-width band), and future points are appended with every other series null.
 */
export function withProjection<
  T extends { date: string; t: number; label?: string; remaining?: number | null },
>(
  points: T[],
  projection: { points: ProjectionPoint[] },
): (T & { forecast: number | null; band: [number, number] | null })[] {
  const proj = projection.points;
  if (proj.length === 0 || points.length === 0) {
    return points.map((p) => ({ ...p, forecast: null, band: null }));
  }
  const todayDate = proj[0].date;
  const out = points.map((p) => {
    if (p.date === todayDate) {
      const r = typeof p.remaining === 'number' ? p.remaining : proj[0].forecast;
      return { ...p, forecast: r, band: [r, r] as [number, number] };
    }
    return { ...p, forecast: null, band: null };
  });
  const template = points[points.length - 1];
  const lastDate = template.date;
  for (const pp of proj) {
    if (pp.date <= lastDate) continue;
    const blank = Object.fromEntries(Object.keys(template).map((k) => [k, null])) as unknown as T;
    out.push({
      ...blank,
      date: pp.date,
      t: pp.t,
      ...('label' in template ? { label: labelOf(pp.date) } : {}),
      forecast: pp.forecast,
      band: pp.band,
    });
  }
  return out.sort((a, b) => a.t - b.t);
}
