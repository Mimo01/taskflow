import { breakdownTotal, daysBetweenKeys, type StatusBreakdown } from '@/lib/release-list';
import type { JiraFixVersion } from '@/services/jira';

export type TimelineWindow = { start: string; end: string };

/** Pixel tops of the three chip lanes (from the approved F5 sketch). */
export const CHIP_LANE_TOP = [4, 86, 45] as const;

export function timelineWeeks(widthPx: number): number {
  return Math.min(8, Math.max(3, Math.floor(widthPx / 115)));
}

/** Add n whole days to a YYYY-MM-DD key (UTC arithmetic, DST-free). */
export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function timelineWindow(opts: {
  today: string;
  weeks: number;
  earliestOverdue: string | null | undefined;
  offset: number;
}): TimelineWindow {
  const { today, weeks, earliestOverdue, offset } = opts;
  const anchor = earliestOverdue && earliestOverdue < today ? earliestOverdue : today;
  const base = weeks <= 5 ? addDaysKey(anchor, -3) : addDaysKey(today, -21);
  const start = addDaysKey(base, offset * 7 * Math.max(1, weeks - 2));
  return { start, end: addDaysKey(start, weeks * 7 + 2) };
}

export function timelinePercent(key: string, win: TimelineWindow): number {
  return (daysBetweenKeys(win.start, key) / daysBetweenKeys(win.start, win.end)) * 100;
}

/** Dated unreleased versions plus the single most recent released one, ascending by date. */
export function timelineReleases(versions: readonly JiraFixVersion[]): JiraFixVersion[] {
  const dated = versions.filter((v) => v.releaseDate);
  const unreleased = dated.filter((v) => !v.released);
  const released = dated
    .filter((v) => v.released)
    .sort((a, b) => (b.releaseDate as string).localeCompare(a.releaseDate as string))
    .slice(0, 1);
  return [...released, ...unreleased].sort((a, b) =>
    (a.releaseDate as string).localeCompare(b.releaseDate as string),
  );
}

export function laterCount(versions: readonly JiraFixVersion[], win: TimelineWindow): number {
  return versions.filter((v) => v.releaseDate && v.releaseDate > win.end).length;
}

export function placeTickRows(
  items: readonly { id: string; x: number; label: string }[],
): Map<string, 0 | 1 | null> {
  const out = new Map<string, 0 | 1 | null>();
  const lastEnd = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    const w = it.label.length * 6.2;
    const left = it.x - w / 2;
    const end = it.x + w / 2 + 4;
    if (left > lastEnd[0]) {
      lastEnd[0] = end;
      out.set(it.id, 0);
    } else if (left > lastEnd[1]) {
      lastEnd[1] = end;
      out.set(it.id, 1);
    } else {
      out.set(it.id, null);
    }
  }
  return out;
}

export function placeChipLanes(
  items: readonly { id: string; x: number }[],
  nextId: string | null,
): Map<string, 0 | 1 | 2> {
  const lanes: [number, number][][] = [[], [], []];
  const out = new Map<string, 0 | 1 | 2>();
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const order = [
    ...sorted.filter((i) => i.id === nextId),
    ...sorted.filter((i) => i.id !== nextId),
  ];
  for (const it of order) {
    const w = (it.id === nextId ? 104 : 98) + 4;
    const lo = it.x - w / 2;
    const hi = it.x + w / 2;
    const free = lanes.findIndex((l) => l.every(([a, b]) => hi < a || lo > b));
    if (free === -1) {
      out.set(it.id, 0);
    } else {
      lanes[free].push([lo, hi]);
      out.set(it.id, free as 0 | 1 | 2);
    }
  }
  return out;
}

export function chipStatus(b: StatusBreakdown | undefined, released: boolean): string | null {
  if (released) return '✓ done';
  if (!b) return null;
  const total = breakdownTotal(b);
  if (total === 0) return 'No issues';
  if (b.done + b.indeterminate > 0) return `${b.done}/${total} done`;
  return `${total} to do`;
}

export function chipShortName(name: string): string {
  const i = name.indexOf(' - ');
  return i === -1 ? name : name.slice(i + 3).trim();
}

function utcDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function shortDate(key: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(utcDate(key))
    .replace('Sept', 'Sep');
}

export function formatRange(win: TimelineWindow, later: number): string {
  const base = `${shortDate(win.start)} – ${shortDate(win.end)}`;
  return later > 0 ? `${base} · +${later} later` : base;
}

export function tickLabel(key: string): string {
  const wd = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
    utcDate(key),
  );
  return `${wd} ${shortDate(key)}`;
}
