import type { JiraIssue } from '@/services/jira';

export type Metric = 'count' | 'sp';
export type Cat = 'new' | 'indeterminate' | 'done';

export interface BurnupPoint {
  date: string;
  label: string;
  scope: number;
  done: number;
}
export interface StatusBucket {
  id: string;
  name: string;
  cat: Cat;
  count: number;
  points: number;
  value: number;
}
export interface AssigneeBucket {
  id: string;
  name: string;
  done: number;
  inProgress: number;
  todo: number;
  remaining: number;
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

export function weightOf(s: JiraIssue, metric: Metric, spKey: string): number {
  if (metric === 'count') return 1;
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

  const dates: string[] = [];
  const span = diffDays(start, today);
  if (span <= 31) {
    for (let i = 0; i <= span; i++) dates.push(addDays(start, i));
  } else {
    for (let d = addDays(start, 6); d < today; d = addDays(d, 7)) dates.push(d);
    dates.push(today);
  }

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
      b = { id, name, cat, count: 0, points: 0, value: 0 };
      map.set(id, b);
    }
    b.count += 1;
    b.points += weightOf(s, 'sp', spKey);
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
      };
      map.set(id, b);
    }
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
