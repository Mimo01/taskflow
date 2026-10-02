import { toLocalDateString } from '@/lib/local-date';
import type { EpicStatusHistory, EpicWorklogDay, JiraIssue, JiraStatus } from '@/services/jira';
import { formatDuration, formatDurationCompact } from '@/services/jira/duration';

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

/** The date key `n` calendar days after `key` (negative `n` goes back). */
export function addCalendarDays(key: string, n: number): string {
  return addDays(key, n);
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

  let axisStart = chartAxisStart(stories, epicCreated, today);
  if (axisStart === null) {
    const starts = items.map((it) => it.startDay).filter((d): d is string => d !== null);
    if (starts.length === 0) return [];
    axisStart = starts.reduce((a, b) => (a < b ? a : b));
    if (axisStart > today) axisStart = today;
  }
  // Everything before the shared axis start is counted on the first point.
  for (const it of items) {
    it.startDay = it.startDay === null || it.startDay < axisStart ? axisStart : it.startDay;
    for (const e of it.entries) if (e.day < axisStart) e.day = axisStart;
  }

  return historyDates(axisStart, today).map((date) => {
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
  done: 'Completed',
  indeterminate: 'In progress',
  new: 'To do',
};

function isWeekday(key: string): boolean {
  const d = new Date(toMs(key)).getUTCDay();
  return d !== 0 && d !== 6;
}

/**
 * Injectable working calendar: working days are Mon-Fri minus calendar holidays.
 * `holidays` are sorted Mon-Fri date keys the calendar marks as non-working.
 */
export interface WorkCalendar {
  isWorkingDay(key: string): boolean;
  holidays: readonly string[];
  source: 'tempo' | 'weekends';
}

export const DEFAULT_CALENDAR: WorkCalendar = {
  isWorkingDay: isWeekday,
  holidays: [],
  source: 'weekends',
};

const HOLIDAY_TYPES = new Set(['HOLIDAY', 'NON_WORKING_DAY']);

/**
 * Calendar from a Tempo schedule map (date -> day type). Only well-formed date keys and the
 * literal HOLIDAY / NON_WORKING_DAY types are honoured; weekends are always non-working.
 */
export function buildWorkCalendar(
  schedule: ReadonlyMap<string, string> | null | undefined,
): WorkCalendar {
  if (!schedule || schedule.size === 0) return DEFAULT_CALENDAR;
  const holidays: string[] = [];
  for (const [rawKey, type] of schedule) {
    const k = validKey(rawKey);
    if (k === null || k !== rawKey || !HOLIDAY_TYPES.has(type) || !isWeekday(k)) continue;
    holidays.push(k);
  }
  holidays.sort();
  const set = new Set(holidays);
  return {
    isWorkingDay: (key) => isWeekday(key) && !set.has(key),
    holidays,
    source: 'tempo',
  };
}

/** Number of calendar holidays d with a < d <= b. */
export function holidaysBetween(cal: WorkCalendar, a: string, b: string): number {
  let n = 0;
  for (const h of cal.holidays) if (h > a && h <= b) n += 1;
  return n;
}

/** Last working day on or before `key`. */
function prevWorkingDay(key: string, cal: WorkCalendar): string {
  let k = key;
  while (!cal.isWorkingDay(k)) k = addDays(k, -1);
  return k;
}

/** First working day on or after `key`. */
function nextWorkingDay(key: string, cal: WorkCalendar): string {
  let k = key;
  while (!cal.isWorkingDay(k)) k = addDays(k, 1);
  return k;
}

/**
 * The date `n` working days (Mon-Fri minus calendar holidays) after `key`. A weekend start
 * counts from the following Monday.
 */
export function addWorkingDays(
  key: string,
  n: number,
  cal: WorkCalendar = DEFAULT_CALENDAR,
): string {
  if (n <= 0) return key;
  // Weekday fast path: whole weeks are a plain 7-day shift; a weekend start is anchored to its Friday.
  let k = key;
  while (!isWeekday(k)) k = addDays(k, -1);
  const weeks = Math.floor(n / 5);
  k = addDays(k, weeks * 7);
  let rem = n - weeks * 5;
  while (rem > 0) {
    k = addDays(k, 1);
    if (isWeekday(k)) rem -= 1;
  }
  // Each holiday crossed pushes the date out by one more working day (bounded by the holiday count).
  let extra = holidaysBetween(cal, key, k);
  while (extra > 0) {
    k = addDays(k, 1);
    if (cal.isWorkingDay(k)) extra -= 1;
  }
  return k;
}

/** Number of working days d with a < d <= b (0 when b <= a). */
export function workingDaysBetween(
  a: string,
  b: string,
  cal: WorkCalendar = DEFAULT_CALENDAR,
): number {
  if (b <= a) return 0;
  const span = diffDays(a, b);
  const weeks = Math.floor(span / 7);
  let count = weeks * 5;
  let k = addDays(a, weeks * 7);
  while (k < b) {
    k = addDays(k, 1);
    if (isWeekday(k)) count += 1;
  }
  return Math.max(0, count - holidaysBetween(cal, a, b));
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
export function forecastFromThroughput(
  input: ThroughputInput,
  today: string,
  cal: WorkCalendar = DEFAULT_CALENDAR,
): EpicForecast {
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
      explanation: 'Remaining work is unestimated',
    };
  }
  if (input.firstActivity === null) {
    return { ...base, explanation: 'No work started yet.' };
  }

  // Working-day sampling: the anchor is today (or the previous working day on a weekend/holiday);
  // non-working events count toward the following working day, clamped to the anchor.
  const anchor = prevWorkingDay(today, cal);
  const offsetOf = (day: string): number => {
    const d = day > today ? today : day;
    let snapped = nextWorkingDay(d, cal);
    if (snapped > anchor) snapped = anchor;
    return workingDaysBetween(snapped, anchor, cal);
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
      explanation: 'Needs more completed work',
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
      explanation: 'Nothing completed yet',
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
    likely: addWorkingDays(today, nLikely, cal),
    optimistic: addWorkingDays(today, nOpt, cal),
    pessimistic: addWorkingDays(today, nPess, cal),
    nLikely,
    nOpt,
    nPess,
    confidence,
    explanation: `Last ${W} working days: ${fmtUnit(muD * 5, unit)}/wk done, +${fmtUnit(
      muS * 5,
      unit,
    )}/wk scope`,
  };
}

/** Forecast for Count/SP from the cheap story fields (no changelog needed). */
export function deriveAdaptiveForecast(
  stories: JiraIssue[],
  metric: 'count' | 'sp',
  spKey: string,
  epicCreated: string | undefined,
  today: string,
  cal: WorkCalendar = DEFAULT_CALENDAR,
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
    cal,
  );
}

/** Time-mode forecast: daily logged-time rate against remaining (estimate - logged). */
export function deriveTimeForecast(
  stories: JiraIssue[],
  logs: Map<string, EpicWorklogDay[]>,
  today: string,
  cal: WorkCalendar = DEFAULT_CALENDAR,
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
    cal,
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

// ── Status bands (generic over Count / SP / Time) ───────────────────────────

export interface Bands {
  done: number;
  inProgress: number;
  todo: number;
}

/** Display order of the three status bands and their status categories. */
export const BANDS: readonly { key: keyof Bands; cat: Cat }[] = [
  { key: 'done', cat: 'done' },
  { key: 'inProgress', cat: 'indeterminate' },
  { key: 'todo', cat: 'new' },
];

export function bandTotal(b: Bands): number {
  return b.done + b.inProgress + b.todo;
}

export function bandPct(b: Bands, key: keyof Bands): number {
  const t = bandTotal(b);
  return t > 0 ? Math.round((b[key] / t) * 100) : 0;
}

export function summaryBands(s: EpicSummary): Bands {
  return { done: s.doneTotal, inProgress: s.inProgressTotal, todo: s.todoTotal };
}

/** Chip text: duration for time, plain integer / 1-decimal number otherwise. */
export function formatChip(n: number, metric: Metric): string {
  if (metric === 'time') return formatDurationCompact(n);
  return String(Number.isInteger(n) ? n : Math.round(n * 10) / 10);
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

interface Segment {
  day: string;
  cat: Cat;
}

function clampDay(day: string, lo: string, hi: string): string {
  return day < lo ? lo : day > hi ? hi : day;
}

/**
 * Shared chart x-axis start: the epic's created day when valid and not in the future, else the
 * earliest valid story created day (clamped to today), else null.
 */
export function chartAxisStart(
  stories: JiraIssue[],
  epicCreated: string | undefined,
  today: string,
): string | null {
  const epicDay = validKey(epicCreated);
  if (epicDay !== null && epicDay <= today) return epicDay;
  let start: string | null = null;
  for (const s of stories) {
    const k = validKey(s.fields.created);
    if (k === null) continue;
    const c = k > today ? today : k;
    if (start === null || c < start) start = c;
  }
  return start;
}

/**
 * History sampling: every calendar day from `start` to `today` inclusive, at any span. The chart
 * thins only the visible window (viewSample), so zooming in shows daily detail.
 */
export function historyDates(start: string, today: string): string[] {
  const span = diffDays(start, today);
  const dates: string[] = [];
  for (let i = 0; i <= span; i++) dates.push(addDays(start, i));
  return dates;
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
  const axisStartOrNull = chartAxisStart(stories, epicCreated, today);
  if (axisStartOrNull === null) return { points: [], approximate: history === null };
  const axisStart = axisStartOrNull;

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

  const dates = historyDates(axisStart, today);

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
  /** Working days from today. */
  wd: number;
  workingDay: boolean;
}

/** The slice of a forecast that deriveProjection reads (EpicForecast and AveragedForecast both fit). */
export type ProjectionSource = Pick<
  EpicForecast,
  'state' | 'remaining' | 'nLikely' | 'nOpt' | 'nPess' | 'likely' | 'optimistic' | 'pessimistic'
>;

const PROJECTION_MIN_CAP_DAYS = 60;
/** Upper bound on projected chart points (one per calendar day, thinned beyond this). */
export const PROJECTION_MAX_POINTS = 260;

/** Latest projected date: today plus the longer of the minimum cap and the history span. */
export function projectionCap(today: string, historyStart: string | null): string {
  const span = historyStart !== null ? Math.max(0, diffDays(historyStart, today)) : 0;
  return addDays(today, Math.max(PROJECTION_MIN_CAP_DAYS, span));
}

/**
 * One projected point per calendar day from today to the (clipped) latest date. Values are
 * a function of working days elapsed, so non-working days are flat. Very long horizons are
 * thinned to at most PROJECTION_MAX_POINTS while keeping the optimistic/likely/latest dates.
 */
export function deriveProjection(
  forecast: ProjectionSource,
  today: string,
  historyStart: string | null,
  cal: WorkCalendar = DEFAULT_CALENDAR,
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
  const cap = projectionCap(today, historyStart);
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
    const wd = workingDaysBetween(today, date, cal);
    return {
      date,
      t: toMs(date),
      forecast: Math.max(0, R - rateLikely * wd),
      band: [Math.max(0, R - rateOpt * wd), Math.max(0, R - rateScenarioPess * wd)],
      wd,
      workingDay: cal.isWorkingDay(date),
    };
  };
  const optDate = clip(forecast.optimistic);
  const likelyDate = clip(forecast.likely);
  const end = clip(forecast.pessimistic);
  const byDate = new Map<string, ProjectionPoint>();
  byDate.set(today, {
    date: today,
    t: toMs(today),
    forecast: R,
    band: [R, R],
    wd: 0,
    workingDay: cal.isWorkingDay(today),
  });
  const days = Math.max(0, diffDays(today, end));
  // Budget leaves room for the three always-kept key dates plus today.
  const stride =
    days <= PROJECTION_MAX_POINTS - 1 ? 1 : Math.ceil(days / (PROJECTION_MAX_POINTS - 4));
  for (let i = stride; i <= days; i += stride) {
    const d = addDays(today, i);
    byDate.set(d, at(d));
  }
  for (const d of [optDate, likelyDate, end]) if (!byDate.has(d) && d > today) byDate.set(d, at(d));
  return {
    points: [...byDate.values()].sort((a, b) => a.t - b.t),
    clippedAfter,
  };
}

/**
 * Merge a projection into chart points: the today point gets forecast = remaining
 * (a zero-width band), and future points are appended with every other series null.
 * Rows carry `wd` (working days from today) and `workingDay` for the hover tooltip;
 * history rows other than today are null.
 */
export function withProjection<
  T extends { date: string; t: number; label?: string; remaining?: number | null },
>(
  points: T[],
  projection: { points: ProjectionPoint[] },
): (T & {
  forecast: number | null;
  band: [number, number] | null;
  wd: number | null;
  workingDay: boolean | null;
})[] {
  const proj = projection.points;
  if (proj.length === 0 || points.length === 0) {
    return points.map((p) => ({ ...p, forecast: null, band: null, wd: null, workingDay: null }));
  }
  const todayDate = proj[0].date;
  const out = points.map((p) => {
    if (p.date === todayDate) {
      const r = typeof p.remaining === 'number' ? p.remaining : proj[0].forecast;
      return {
        ...p,
        forecast: r,
        band: [r, r] as [number, number],
        wd: 0,
        workingDay: proj[0].workingDay,
      };
    }
    return { ...p, forecast: null, band: null, wd: null, workingDay: null };
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
      wd: pp.wd,
      workingDay: pp.workingDay,
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * Every chart projects the ONE averaged forecast from its own current remaining, in its own
 * unit: same dates and working-day counts everywhere, only the vertical scale differs.
 * Empty unless the averaged state is 'ok' and remaining > 0.
 */
export function projectFinish(
  finish: AveragedForecast,
  remaining: number,
  today: string,
  historyStart: string | null,
  cal: WorkCalendar = DEFAULT_CALENDAR,
): { points: ProjectionPoint[]; clippedAfter: string | null } {
  return deriveProjection({ ...finish, remaining }, today, historyStart, cal);
}

// ── Averaged forecast ────────────────────────────────────────────────────────

export const METRIC_LABEL: Record<Metric, string> = {
  count: 'Items',
  sp: 'SP',
  time: 'Time',
};

/** Contributors disagree when their likely spread exceeds this share of the mean likely. */
export const AVERAGE_DISAGREE_SPREAD = 0.5;

export interface ForecastPart {
  metric: Metric;
  forecast: EpicForecast | null;
  pending?: 'loading' | 'error';
}

export interface AveragedForecast {
  state: ForecastState;
  likely: string | null;
  optimistic: string | null;
  pessimistic: string | null;
  nLikely: number | null;
  nOpt: number | null;
  nPess: number | null;
  confidence: Confidence | null;
  disagree: boolean;
  parts: {
    metric: Metric;
    forecast: EpicForecast | null;
    included: boolean;
    reason: string | null;
  }[];
  explanation: string;
}

const CONF_ORDER: Confidence[] = ['low', 'medium', 'high'];

function isUsable(f: EpicForecast | null): f is EpicForecast {
  return (
    f !== null &&
    f.state === 'ok' &&
    f.nLikely !== null &&
    f.nLikely > 0 &&
    f.nOpt !== null &&
    f.nPess !== null &&
    f.likely !== null
  );
}

function exclusionReason(part: ForecastPart): string {
  const f = part.forecast;
  if (f === null) {
    if (part.pending === 'loading') return 'loading';
    return 'unavailable';
  }
  switch (f.state) {
    case 'ok':
      return 'no estimates';
    case 'too-early':
      return part.metric === 'time' && f.completions === 0 ? 'no logged time' : 'too early';
    case 'stalled':
      return 'stalled';
    case 'not-converging':
      return 'no end date';
    case 'done':
      return 'complete';
  }
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/**
 * Average the available metric forecasts. Averaging is done on working-day offsets from
 * today (earliest, likely, latest separately) and mapped back through the calendar, never
 * on raw calendar dates.
 */
export function averageForecasts(
  parts: ForecastPart[],
  today: string,
  cal: WorkCalendar = DEFAULT_CALENDAR,
): AveragedForecast {
  const rows = parts.map((p) => {
    const included = isUsable(p.forecast);
    return {
      metric: p.metric,
      forecast: p.forecast,
      included,
      reason: included ? null : exclusionReason(p),
    };
  });
  const used = rows.flatMap((r) => (r.included && r.forecast ? [r] : []));
  const empty = {
    likely: null,
    optimistic: null,
    pessimistic: null,
    nLikely: null,
    nOpt: null,
    nPess: null,
    confidence: null,
    disagree: false,
    parts: rows,
  };

  if (used.length === 0) {
    const fs = parts.flatMap((p) => (p.forecast ? [p.forecast] : []));
    if (fs.some((f) => f.state === 'done')) {
      return { ...empty, state: 'done', explanation: 'All work is done.' };
    }
    for (const state of ['stalled', 'not-converging', 'too-early'] as const) {
      const hit = fs.find((f) => f.state === state);
      if (hit) return { ...empty, state, explanation: hit.explanation };
    }
    return {
      ...empty,
      state: 'too-early',
      explanation: 'Not enough data yet',
    };
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const likelies = used.map((r) => r.forecast?.nLikely ?? 0);
  const nLikely = Math.max(1, Math.round(mean(likelies)));
  const nOpt = Math.min(
    nLikely,
    Math.max(1, Math.round(mean(used.map((r) => r.forecast?.nOpt ?? 0)))),
  );
  const nPess = Math.max(nLikely, Math.round(mean(used.map((r) => r.forecast?.nPess ?? 0))));
  const disagree =
    used.length >= 2 &&
    Math.max(...likelies) - Math.min(...likelies) > AVERAGE_DISAGREE_SPREAD * mean(likelies);
  let level = Math.min(...used.map((r) => CONF_ORDER.indexOf(r.forecast?.confidence ?? 'low')));
  if (disagree) level = Math.max(0, level - 1);
  const labels = used.map((r) => METRIC_LABEL[r.metric]);
  return {
    state: 'ok',
    likely: addWorkingDays(today, nLikely, cal),
    optimistic: addWorkingDays(today, nOpt, cal),
    pessimistic: addWorkingDays(today, nPess, cal),
    nLikely,
    nOpt,
    nPess,
    confidence: CONF_ORDER[level],
    disagree,
    parts: rows,
    explanation: `Average of ${joinLabels(labels)} forecasts.`,
  };
}

export const FINISH_STATE_TEXT: Record<Exclude<ForecastState, 'ok'>, string> = {
  done: 'Complete',
  'too-early': 'Too early',
  stalled: 'Stalled',
  'not-converging': 'No end date',
};

/** Short reason shown under a non-ok Finish value; null when the forecast is ok. */
export function finishStateSub(finish: AveragedForecast): string | null {
  switch (finish.state) {
    case 'ok':
      return null;
    case 'done':
      return 'All work done';
    case 'too-early':
      return 'Needs more completed work';
    case 'not-converging':
      return 'Scope grows faster than done';
    case 'stalled': {
      const part = finish.parts.find((p) => p.forecast?.state === 'stalled');
      const text = part?.forecast?.explanation.replace(/\.$/, '');
      return text || 'No recent progress';
    }
  }
}

/** Month-day, plus the year when it differs from today's. */
export function formatFinishDate(key: string, today: string): string {
  const base = formatDateKey(key);
  return key.slice(0, 4) !== today.slice(0, 4) ? `${base}, ${key.slice(0, 4)}` : base;
}

/** Likely / Earliest / Latest rows shared by the Finish tooltip and the chart tooltips. */
export function finishDateRows(finish: AveragedForecast): {
  key: 'likely' | 'optimistic' | 'pessimistic';
  label: 'Likely' | 'Earliest' | 'Latest';
  date: string;
  n: number;
}[] {
  if (
    finish.state !== 'ok' ||
    finish.likely === null ||
    finish.optimistic === null ||
    finish.pessimistic === null ||
    finish.nLikely === null ||
    finish.nOpt === null ||
    finish.nPess === null
  ) {
    return [];
  }
  return [
    { key: 'likely', label: 'Likely', date: finish.likely, n: finish.nLikely },
    { key: 'optimistic', label: 'Earliest', date: finish.optimistic, n: finish.nOpt },
    { key: 'pessimistic', label: 'Latest', date: finish.pessimistic, n: finish.nPess },
  ];
}

// ── Risks ────────────────────────────────────────────────────────────────────

export type RiskKey = 'overdue' | 'late' | 'stalled' | 'scope' | 'unestimated' | 'unassigned';

export interface EpicRisk {
  key: RiskKey;
  severity: 'warning' | 'info';
  /** Full text: the card button's aria-label and the popover header (e.g. '3 unestimated'). */
  text: string;
  /** Readable card label, ~16 chars (CSS truncates longer, e.g. 'Overdue 1000 days'), a substring of text. */
  short: string;
  /** Compact pill text ('3d', '+4d', '2'); null for stalled / scope. */
  token: string | null;
  count: number | null;
  detail: string;
  /** Affected issues (unestimated / unassigned only), numerically sorted by key. */
  issues: RiskIssue[];
}

export interface RiskIssue {
  key: string;
  summary: string;
}

/** Scope growth is "significant" at this share of the done rate. */
const RISK_SCOPE_RATIO = 0.5;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function issuesOf(stories: JiraIssue[]): { issues: RiskIssue[] } {
  return {
    issues: stories
      .map((s) => ({ key: s.key, summary: s.fields.summary?.trim() || '(no summary)' }))
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
  };
}

function daysText(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/** Drop a trailing period so a forecast explanation reads as a popover detail line. */
function noPeriod(text: string): string {
  return text.replace(/\.$/, '');
}

/**
 * Risks are tab-independent. Stalled / Scope duplicate the Finish card, so they appear only
 * when Finish is not already saying it; at most 4 risks result by construction
 * (overdue|late, stalled|scope, unestimated, unassigned).
 */
export function deriveRisks(args: {
  stories: JiraIssue[];
  spKey: string;
  finish: AveragedForecast;
  dueDate: string | null | undefined;
  today: string;
}): EpicRisk[] {
  const { stories, spKey, finish, today } = args;
  const open = stories.filter((s) => catOf(s) !== 'done');
  const warnings: EpicRisk[] = [];
  const infos: EpicRisk[] = [];
  const due = validKey(args.dueDate);

  if (due !== null && open.length > 0) {
    if (due < today) {
      const n = diffDays(due, today);
      warnings.push({
        key: 'overdue',
        severity: 'warning',
        text: `Overdue ${daysText(n)}`,
        short: `Overdue ${daysText(n)}`,
        token: `${n}d`,
        count: null,
        detail: `Was due ${formatDateKey(due)} \u00b7 ${open.length} ${open.length === 1 ? 'item' : 'items'} open`,
        // The Stories list below already shows the open items.
        issues: [],
      });
    } else if (finish.state === 'ok' && finish.likely !== null && finish.likely > due) {
      const n = diffDays(due, finish.likely);
      warnings.push({
        key: 'late',
        severity: 'warning',
        text: `Finishes ${daysText(n)} late`,
        short: `${daysText(n)} late`,
        token: `+${n}d`,
        count: null,
        detail: `Due ${formatDateKey(due)} \u00b7 forecast ${formatDateKey(finish.likely)}`,
        issues: [],
      });
    }
  }

  const stalled =
    finish.state === 'ok' ? finish.parts.find((p) => p.forecast?.state === 'stalled') : undefined;
  if (stalled?.forecast) {
    warnings.push({
      key: 'stalled',
      severity: 'warning',
      text: 'Stalled',
      short: 'Stalled',
      token: null,
      count: null,
      detail: noPeriod(stalled.forecast.explanation),
      issues: [],
    });
  } else {
    const countPart = finish.parts.find((p) => p.metric === 'count')?.forecast;
    const diverging = finish.parts.find((p) => p.forecast?.state === 'not-converging');
    const detailFor = (): string | null => {
      if (
        countPart &&
        countPart.state === 'ok' &&
        countPart.ratePerWeek !== undefined &&
        countPart.scopeRatePerWeek > 0
      ) {
        return `+${round1(countPart.scopeRatePerWeek)} items/wk added vs ${round1(countPart.ratePerWeek)}/wk done`;
      }
      return diverging?.forecast ? noPeriod(diverging.forecast.explanation) : null;
    };
    if (diverging?.forecast && finish.state !== 'not-converging') {
      warnings.push({
        key: 'scope',
        severity: 'warning',
        text: 'Scope growing',
        short: 'Scope growing',
        token: null,
        count: null,
        detail: detailFor() ?? '',
        issues: [],
      });
    } else if (
      !diverging &&
      countPart &&
      countPart.state === 'ok' &&
      countPart.scopeRatePerWeek > 0 &&
      countPart.scopeRatePerWeek >= RISK_SCOPE_RATIO * countPart.ratePerWeek
    ) {
      infos.push({
        key: 'scope',
        severity: 'info',
        text: 'Scope growing',
        short: 'Scope growing',
        token: null,
        count: null,
        detail: detailFor() ?? '',
        issues: [],
      });
    }
  }

  // Neither story points nor a time estimate (same in every tab).
  const unestimated = open.filter((s) => spOf(s, spKey) === null && estimateOf(s) === 0);
  if (unestimated.length > 0) {
    infos.push({
      key: 'unestimated',
      severity: 'info',
      text: `${unestimated.length} unestimated`,
      short: `${unestimated.length} unestimated`,
      token: `${unestimated.length}`,
      count: unestimated.length,
      detail: 'Open items with no points or time estimate',
      ...issuesOf(unestimated),
    });
  }

  const unassigned = open.filter((s) => !s.fields.assignee);
  if (unassigned.length > 0) {
    infos.push({
      key: 'unassigned',
      severity: 'info',
      text: `${unassigned.length} unassigned`,
      short: `${unassigned.length} unassigned`,
      token: `${unassigned.length}`,
      count: unassigned.length,
      detail: 'Open items with no assignee',
      ...issuesOf(unassigned),
    });
  }

  return [...warnings, ...infos];
}

// ── Chart axis and zoom ──────────────────────────────────────────────────────

export interface ChartRange {
  from: string;
  to: string;
}

/** UTC ms of a YYYY-MM-DD key. */
export function dateKeyMs(key: string): number {
  return toMs(key);
}

/**
 * The one x-domain both charts share: axis start to max(today, clipped latest forecast date).
 * Null without a start.
 */
export function chartDomain(
  start: string | null,
  today: string,
  finish: AveragedForecast,
): (ChartRange & { clippedAfter: string | null }) | null {
  if (start === null) return null;
  let to = today;
  let clippedAfter: string | null = null;
  if (finish.state === 'ok' && finish.pessimistic !== null && finish.pessimistic > today) {
    const cap = projectionCap(today, start);
    if (finish.pessimistic > cap) {
      to = cap;
      clippedAfter = cap;
    } else to = finish.pessimistic;
  }
  return { from: start < to ? start : to, to, clippedAfter };
}

/** Append one blank row at `to` so the data spans the whole domain. */
export function padToDomain<T extends { date: string; t: number }>(points: T[], to: string): T[] {
  if (points.length === 0) return points;
  const template = points[points.length - 1];
  if (template.date >= to) return points;
  const blank = Object.fromEntries(Object.keys(template).map((k) => [k, null])) as unknown as T;
  return [
    ...points,
    {
      ...blank,
      date: to,
      t: toMs(to),
      ...('label' in template ? { label: labelOf(to) } : {}),
    },
  ];
}

export type ZoomPreset = 'all' | '6m' | '3m' | '1m' | '2w' | 'forecast';

export const ZOOM_PRESETS: readonly { key: ZoomPreset; label: string; days: number | null }[] = [
  { key: 'all', label: 'All', days: null },
  { key: '6m', label: '6M', days: 182 },
  { key: '3m', label: '3M', days: 91 },
  { key: '1m', label: '1M', days: 30 },
  { key: '2w', label: '2W', days: 14 },
  { key: 'forecast', label: 'Forecast', days: null },
];

const FORECAST_PRESET_LOOKBACK_DAYS = 14;

/** Visible range for a preset, clamped to the domain; null when the preset is unavailable. */
export function presetRange(
  preset: ZoomPreset,
  domain: ChartRange,
  today: string,
): ChartRange | null {
  if (preset === 'all') return domain;
  const maxKey = (a: string, b: string) => (a > b ? a : b);
  if (preset === 'forecast') {
    if (domain.to <= today) return null;
    return {
      from: maxKey(domain.from, addDays(today, -FORECAST_PRESET_LOOKBACK_DAYS)),
      to: domain.to,
    };
  }
  const days = ZOOM_PRESETS.find((p) => p.key === preset)?.days ?? 0;
  return { from: maxKey(domain.from, addDays(today, -days)), to: today };
}

/** Smallest visible span (calendar days) the navigator lets the user select. */
export const ZOOM_MIN_SPAN_DAYS = 7;

/** Zoom chrome only appears for domains longer than this: 4 x ZOOM_MIN_SPAN_DAYS. */
export const ZOOM_MIN_DAYS = 28;

/** Domains up to this many days offer only the short preset set. */
export const PRESET_SHORT_MAX_DAYS = 90;
/** Domains up to this many days offer the medium preset set; longer ones the long set. */
export const PRESET_MEDIUM_MAX_DAYS = 240;

/** Calendar days from `r.from` to `r.to`. */
export function spanDays(r: ChartRange): number {
  return diffDays(r.from, r.to);
}

export function zoomEnabled(domain: ChartRange): boolean {
  return spanDays(domain) > ZOOM_MIN_DAYS;
}

/**
 * Presets worth showing: 'all' plus the length-appropriate candidates that actually cut off part
 * of the domain. Empty when zoom is disabled or only 'All' would remain (a lone "All" is useless).
 */
export function visiblePresets(domain: ChartRange, today: string): ZoomPreset[] {
  if (!zoomEnabled(domain)) return [];
  const span = spanDays(domain);
  const candidates: ZoomPreset[] =
    span <= PRESET_SHORT_MAX_DAYS
      ? ['2w', 'forecast']
      : span <= PRESET_MEDIUM_MAX_DAYS
        ? ['1m', '2w', 'forecast']
        : ['6m', '3m', '1m', 'forecast'];
  const out: ZoomPreset[] = ['all'];
  for (const key of candidates) {
    const r = presetRange(key, domain, today);
    if (r && r.from > domain.from) out.push(key);
  }
  return out.length > 1 ? out : [];
}

/**
 * Clamp both ends into the domain, guaranteeing from < to (else the whole domain). When the
 * clamped span is shorter than `minSpan` days, extend `to` toward the domain end, then pull
 * `from` back if still short.
 */
export function clampRange(range: ChartRange, domain: ChartRange, minSpan = 0): ChartRange {
  const clamp = (k: string) => (k < domain.from ? domain.from : k > domain.to ? domain.to : k);
  let from = clamp(range.from);
  let to = clamp(range.to);
  if (!(from < to)) return { from: domain.from, to: domain.to };
  if (diffDays(from, to) < minSpan) {
    const wanted = addDays(from, minSpan);
    to = wanted > domain.to ? domain.to : wanted;
    if (diffDays(from, to) < minSpan) {
      const back = addDays(to, -minSpan);
      from = back < domain.from ? domain.from : back;
    }
  }
  return { from, to };
}

/** Whole-day offsets of a range from the domain start (the navigator's slider values). */
export function rangeToOffsets(range: ChartRange, domain: ChartRange): [number, number] {
  return [diffDays(domain.from, range.from), diffDays(domain.from, range.to)];
}

/** Inverse of rangeToOffsets. */
export function offsetsToRange([a, b]: [number, number], domain: ChartRange): ChartRange {
  return { from: addDays(domain.from, a), to: addDays(domain.from, b) };
}

/** Shift both ends by `deltaDays`, sliding against the domain edges so the span is kept. */
export function panRange(range: ChartRange, domain: ChartRange, deltaDays: number): ChartRange {
  const total = spanDays(domain);
  const span = spanDays(range);
  if (span >= total) return { from: domain.from, to: domain.to };
  const [start] = rangeToOffsets(range, domain);
  const from = Math.min(Math.max(0, start + deltaDays), total - span);
  return offsetsToRange([from, from + span], domain);
}

/**
 * Pointer-pan math: days to shift for a drag from `startX` to `clientX` across a track of
 * `trackWidth` px that represents `domainDays` days. Rounded to whole days; 0 for a zero-width track.
 */
export function panDeltaDays(
  clientX: number,
  startX: number,
  trackWidth: number,
  domainDays: number,
): number {
  if (!(trackWidth > 0)) return 0;
  return Math.round(((clientX - startX) / trackWidth) * domainDays);
}

/**
 * Keep a range pinned to the domain end when the domain end moves (e.g. new forecast), then
 * clamp into the new domain with `minSpan`.
 */
export function rebaseRange(
  range: ChartRange,
  prevDomainTo: string,
  domain: ChartRange,
  minSpan: number,
): ChartRange {
  const pinned = range.to === prevDomainTo ? { from: range.from, to: domain.to } : range;
  return clampRange(pinned, domain, minSpan);
}

// ── Visible-window sampling and calendar ticks ───────────────────────────────

/** Rendered-point budget for the visible window. */
export const VIEW_MAX_POINTS = 250;

/**
 * Thin the visible window to a point budget. Rows are sorted by date. Keeps every in-window row
 * when there are <= max of them; otherwise every ceil(n / (max - 1))-th one. Always keeps the first
 * and last in-window rows, one neighbour on each side of the window and every date in `keep`.
 * Result is sorted and unique, length <= max + keep.length + 2.
 */
export function viewSample<T extends { date: string }>(
  rows: T[],
  range: ChartRange,
  max = VIEW_MAX_POINTS,
  keep: readonly string[] = [],
): T[] {
  let first = -1;
  let last = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].date >= range.from && rows[i].date <= range.to) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return rows.filter((r) => keep.includes(r.date));
  const n = last - first + 1;
  const step = n <= max ? 1 : Math.ceil(n / Math.max(1, max - 1));
  const keepSet = new Set(keep);
  const out: T[] = [];
  for (let i = 0; i < rows.length; i++) {
    const inWindow = i >= first && i <= last;
    const take =
      i === first - 1 ||
      i === last + 1 ||
      keepSet.has(rows[i].date) ||
      (inWindow && (i === first || i === last || (i - first) % step === 0));
    if (take) out.push(rows[i]);
  }
  return out;
}

export interface AxisTick {
  t: number;
  label: string;
}

/** Ticks per px: one tick per this many px of chart width. */
const TICK_PX = 72;

type TickUnit = (ms: number, y: number, m: number, d: number) => boolean;

const mondayOf = (ms: number) => (Math.floor(ms / DAY_MS) + 3) % 7 === 0;
const dayNo = (ms: number) => Math.floor(ms / DAY_MS);
const monthStart =
  (months: readonly number[] | null): TickUnit =>
  (_ms, _y, m, d) =>
    d === 1 && (months === null || months.includes(m));

const MONTH_UNIT_START = 4;

const TICK_LADDER: TickUnit[] = [
  () => true,
  (ms) => dayNo(ms) % 2 === 0,
  (ms) => mondayOf(ms),
  // Mondays on even week numbers since 1970-01-05 (day 4)
  (ms) => mondayOf(ms) && ((dayNo(ms) - 4) / 7) % 2 === 0,
  monthStart(null),
  monthStart([0, 2, 4, 6, 8, 10]),
  monthStart([0, 3, 6, 9]),
  monthStart([0, 6]),
  monthStart([0]),
];

/**
 * Calendar-aligned axis ticks within [from, to]: days, Mondays, month starts, quarters... chosen
 * as the finest ladder unit with <= max(3, floor(widthPx / 72)) ticks. Ticks depend only on the
 * calendar, so they stay put while panning. Labels carry the year on the first tick when the
 * range crosses a year, and on any tick whose year differs from the previous one.
 */
export function timeTicks(from: string, to: string, widthPx: number): AxisTick[] {
  const target = Math.max(3, Math.floor(widthPx / TICK_PX));
  const span = Math.max(0, diffDays(from, to));
  const days: { ms: number; y: number; m: number; d: number }[] = [];
  for (let i = 0; i <= span; i++) {
    const ms = toMs(from) + i * DAY_MS;
    const dt = new Date(ms);
    days.push({ ms, y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() });
  }
  let picked: typeof days = [];
  let unitIdx = 0;
  for (let u = 0; u < TICK_LADDER.length; u++) {
    const unit = TICK_LADDER[u];
    const hits = days.filter((x) => unit(x.ms, x.y, x.m, x.d));
    if (hits.length >= 1) {
      picked = hits;
      unitIdx = u;
    }
    if (hits.length >= 1 && hits.length <= target) break;
  }
  if (picked.length === 0) picked = days.slice(0, 1);
  const crosses = days[0].y !== days[days.length - 1].y;
  const monthUnit = unitIdx >= MONTH_UNIT_START;
  return picked.map((x, i) => {
    const withYear = (i === 0 && crosses) || (i > 0 && picked[i - 1].y !== x.y);
    const base = monthUnit ? MONTHS[x.m] : `${MONTHS[x.m]} ${x.d}`;
    return { t: x.ms, label: withYear ? `${base} ${x.y}` : base };
  });
}

/** "Mar 2026". */
export function formatMonthYear(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/**
 * Compact date range: "Oct 9 – 28" within a month, else "Oct 9 – Nov 2"; the end date gets a
 * " '27" suffix when its year differs from today's.
 */
export function formatDateRange(a: string, b: string, today: string): string {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const yy = (y: number) => ` '${String(y).slice(2)}`;
  // A range across years names both years ("Dec 28 '26 – Jan 3 '27").
  if (ay !== by) return `${labelOf(a)}${yy(ay)} \u2013 ${MONTHS[bm - 1]} ${bd}${yy(by)}`;
  const end = am === bm ? `${bd}` : `${MONTHS[bm - 1]} ${bd}`;
  const suffix = String(by) !== today.slice(0, 4) ? ` '${String(by).slice(2)}` : '';
  return `${labelOf(a)} \u2013 ${end}${suffix}`;
}

// ── Confidence reason ────────────────────────────────────────────────────────

/** Max length of the single-line confidence reason. */
export const CONFIDENCE_REASON_MAX = 60;

/**
 * Plain-language reason behind the averaged confidence, a single line of at most
 * CONFIDENCE_REASON_MAX characters; null unless the forecast is ok.
 */
export function confidenceReason(finish: AveragedForecast): string | null {
  if (finish.state !== 'ok' || finish.confidence === null) return null;
  const included = finish.parts.flatMap((p) => (p.included && p.forecast ? [p] : []));
  if (included.length === 0) return null;
  if (finish.disagree) {
    const ns = included.map((p) => p.forecast?.nLikely ?? 0);
    return `Views disagree by ${Math.max(...ns) - Math.min(...ns)} working days`;
  }
  let weakest = included[0];
  for (const p of included) {
    if (
      CONF_ORDER.indexOf(p.forecast?.confidence ?? 'low') <
      CONF_ORDER.indexOf(weakest.forecast?.confidence ?? 'low')
    )
      weakest = p;
  }
  const f = weakest.forecast;
  if (!f) return null;
  const W = f.windowDays;
  const c = f.completions;
  const noun = weakest.metric === 'time' ? 'logged days' : c === 1 ? 'completion' : 'completions';
  const shortHistory = `Only ${W} working days of history`;
  const fewEvents = `Only ${c} ${noun} in ${W} working days`;
  switch (f.confidence) {
    case 'high':
      return `Steady pace over ${W} working days`;
    case 'low':
      return W < 10 ? shortHistory : fewEvents;
    default:
      return W < 20
        ? shortHistory
        : c < 8
          ? fewEvents
          : `Wide range: ${f.nOpt}–${f.nPess} working days`;
  }
}

// ── Data sources ─────────────────────────────────────────────────────────────

export type HistorySource = 'real' | 'partial' | 'loading' | 'unavailable';
export type WorklogSource = 'loaded' | 'loading' | 'unavailable';

export const HISTORY_SOURCE_TEXT: Record<HistorySource, string> = {
  real: 'From Jira status history',
  partial: 'Approximate for some items',
  loading: 'Approximate: status history loading',
  unavailable: 'Approximate: no status history',
};

export const WORKLOG_SOURCE_TEXT: Record<WorklogSource, string> = {
  loaded: 'From Jira worklogs',
  loading: 'Approximate: worklogs loading',
  unavailable: 'Worklogs unavailable',
};

/**
 * One short hero-tooltip note (at most 2 tokens) naming only non-default / approximate data
 * sources; null when everything is real.
 */
export function sourceNote(args: {
  metric: Metric;
  history: HistorySource;
  worklogs: WorklogSource;
  calendar: WorkCalendar;
}): string | null {
  const tokens: string[] = [];
  if (args.metric === 'time') {
    if (args.worklogs === 'loading') tokens.push('Worklogs loading');
    else if (args.worklogs === 'unavailable') tokens.push('Worklogs unavailable');
  } else if (args.history === 'partial') tokens.push('Partial status history');
  else if (args.history === 'loading') tokens.push('Status history loading');
  else if (args.history === 'unavailable') tokens.push('No status history');
  if (args.calendar.source !== 'tempo') tokens.push('No holiday calendar');
  return tokens.length > 0 ? tokens.join(' \u00b7 ') : null;
}
