/**
 * Pure model for the Logs timeline: grouping requests into page loads, page and request labels,
 * row status, bar geometry, ticks and tooltip text. No React, no DOM, no module-level state.
 */
import { SIDEBAR_NAV_ITEMS } from '../../components/app/sidebar-items';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { entryEnd, entryStart, isPending } from './log-entry';
import { urlPath } from './log-stats';
import { queueSplit } from './queue-handoff';

/** Requests separated by more than this much idle time (nothing in flight) start a new load. */
export const LOAD_GAP_MS = 1500;

export type RowTone = 'ok' | 'warn' | 'error' | 'pending';

export interface Load {
  id: string;
  route?: string;
  name: string;
  /** Earliest queuedAt ?? start in the load. */
  start: number;
  /** Latest end among finished requests (the load start when none finished). */
  doneEnd: number;
  hasPending: boolean;
  /** Sorted by start ascending, ties by id. */
  entries: ApiLogEntry[];
}

const cmpId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sortKey = (e: ApiLogEntry) => e.queuedAt ?? entryStart(e);

/** Groups requests into page loads, newest first. Memoizable on entries alone (no `now`). */
export function groupLoads(entries: ApiLogEntry[], gapMs = LOAD_GAP_MS): Load[] {
  const sorted = [...entries].sort((a, b) => sortKey(a) - sortKey(b) || cmpId(a.id, b.id));
  const loads: Load[] = [];
  let cur: Load | null = null;
  let prevRoute: string | undefined;
  for (const e of sorted) {
    const key = sortKey(e);
    const routeChanged =
      cur !== null && prevRoute !== undefined && e.route !== undefined && e.route !== prevRoute;
    const idle = cur !== null && !cur.hasPending && key - cur.doneEnd > gapMs;
    if (cur === null || routeChanged || idle) {
      cur = {
        id: `load-${e.id}`,
        route: e.route,
        name: loadName(e.route),
        start: key,
        doneEnd: key,
        hasPending: false,
        entries: [],
      };
      loads.push(cur);
    }
    cur.entries.push(e);
    cur.start = Math.min(cur.start, key);
    if (isPending(e)) cur.hasPending = true;
    else cur.doneEnd = Math.max(cur.doneEnd, entryEnd(e, 0));
    prevRoute = e.route ?? prevRoute;
  }
  for (const l of loads) {
    l.entries.sort((a, b) => entryStart(a) - entryStart(b) || cmpId(a.id, b.id));
  }
  return loads.reverse();
}

export function loadSpan(load: Load, now: number): number {
  const end = load.hasPending ? Math.max(load.doneEnd, now) : load.doneEnd;
  return Math.max(1, end - load.start);
}

const titleCase = (s: string) =>
  s
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** Human page name for an app route ('/backlog' -> 'Backlog', '/issue/PROJ-1' -> 'Issue PROJ-1'). */
export function loadName(route: string | undefined): string {
  if (!route) return 'Unknown page';
  const seg = route.split('/').filter(Boolean);
  if (seg.length === 0) return 'Home';
  const [first, a, b, c, d] = seg;
  switch (first) {
    case 'issue':
      if (a) return `Issue ${a}`;
      break;
    case 'mr':
      if (b) return `Merge request !${b}`;
      break;
    case 'release':
      if (a) return `Release ${a}`;
      break;
    case 'aio-project':
      if (a) return `AIO project ${a}`;
      break;
    case 'aio-cycle':
      if (c === 'run' && d) return `AIO test run ${d}`;
      if (b) return `AIO cycle ${b}`;
      break;
    case 'dev-tools':
      return 'Developer Tools';
    case 'settings':
      return 'Settings';
  }
  const nav = SIDEBAR_NAV_ITEMS.find((i) => i.path === `/${first}`);
  return nav ? nav.label : titleCase(first);
}

/** Decoded pathname + query, host stripped. */
function decodedPath(url: string): string {
  let out = url;
  try {
    const u = new URL(url);
    out = `${u.pathname}${u.search}`;
  } catch {
    // keep raw
  }
  try {
    return decodeURIComponent(out);
  } catch {
    return out;
  }
}

const ISSUE_KEY = /^[A-Z][A-Z0-9]+-\d+$/;
/** Segments that are ids or API plumbing rather than the resource being fetched. */
const NOISE_SEGMENT = /^(\d+|v\d+|rest|api|agile|latest)$/i;

/**
 * Row label: the operation when present, else the resource the path names in plain words
 * ("Merge requests", "Worklogs"), with an issue key appended when the path has one
 * ("Remotelink · PROJ-1").
 */
export function requestLabel(e: Pick<ApiLogEntry, 'operation' | 'url'>): string {
  const op = e.operation?.trim();
  if (op) return op;
  const path = urlPath(e.url);
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return path;
  }
  const seg = decoded.split('/').filter(Boolean);
  if (seg.length === 0) return '/';
  const key = seg.find((s) => ISSUE_KEY.test(s));
  const resource = [...seg].reverse().find((s) => !ISSUE_KEY.test(s) && !NOISE_SEGMENT.test(s));
  if (!resource) return key ?? seg[seg.length - 1];
  const words = resource.replace(/[_-]+/g, ' ').trim();
  const name = words.charAt(0).toUpperCase() + words.slice(1);
  return key ? `${name} · ${key}` : name;
}

export function rowStatus(
  e: ApiLogEntry,
): { text: string; tone: 'warn' | 'error' | 'pending' } | null {
  if (isPending(e)) return { text: 'loading', tone: 'pending' };
  if (e.status === null) return { text: 'error', tone: 'error' };
  if (e.status >= 500) return { text: String(e.status), tone: 'error' };
  if (e.status >= 400) return { text: String(e.status), tone: 'warn' };
  return null;
}

/** '0 ms', '412 ms', '1.2 s', '12 s'. */
export function formatMs(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < 1000) return `${Math.round(ms)} ms`;
  if (abs < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 1000)} s`;
}

const TICK_STEPS = [100, 250, 500, 1000, 2000, 5000, 10_000, 20_000, 30_000, 60_000];
const DOMAIN_PAD = 1.02;

export function loadTicks(spanMs: number): { t: number; pct: number; label: string }[] {
  const step = TICK_STEPS.find((s) => spanMs / s <= 4) ?? Math.ceil(spanMs / 4 / 60_000) * 60_000;
  const out: { t: number; pct: number; label: string }[] = [];
  for (let t = step; t < spanMs; t += step) {
    out.push({ t, pct: (t / (spanMs * DOMAIN_PAD)) * 100, label: formatMs(t) });
  }
  return out;
}

export function barGeometry(
  e: ApiLogEntry,
  load: Load,
  spanMs: number,
  now: number,
): {
  left: number;
  width: number;
  wait: { left: number; width: number } | null;
  tone: RowTone;
} {
  const domain = spanMs * DOMAIN_PAD;
  const start = entryStart(e);
  const left = ((start - load.start) / domain) * 100;
  const width = Math.max(0.4, ((entryEnd(e, now) - start) / domain) * 100);
  const wait =
    e.queuedAt !== undefined && e.queuedAt < start
      ? {
          left: ((e.queuedAt - load.start) / domain) * 100,
          width: ((start - e.queuedAt) / domain) * 100,
        }
      : null;
  return { left, width, wait, tone: rowStatus(e)?.tone ?? 'ok' };
}

export function tooltipLines(e: ApiLogEntry, load: Load, now: number): [string, string, string] {
  const { queuedMs, networkMs } = queueSplit(e);
  const start = entryStart(e);
  const wait =
    queuedMs !== null && queuedMs > 0 ? ` after waiting ${formatMs(queuedMs)} for a Jira slot` : '';
  const took = isPending(e)
    ? `Still loading (${formatMs(now - start)} so far)${wait}`
    : `Took ${formatMs(networkMs)}${wait}`;
  return [
    `${e.method} ${decodedPath(e.url)}`,
    took,
    `Started ${formatMs(start - load.start)} after the page opened`,
  ];
}

/** An explicit user choice wins; otherwise only the newest load (index 0) is open. */
export function isLoadOpen(loadOpen: Record<string, boolean>, id: string, index: number): boolean {
  return loadOpen[id] ?? index === 0;
}

/** Request ids of open loads in render order. */
export function visibleRequestIds(loads: Load[], loadOpen: Record<string, boolean>): string[] {
  return loads.flatMap((l, i) => (isLoadOpen(loadOpen, l.id, i) ? l.entries.map((e) => e.id) : []));
}
