// Release train (261103-jqy): the Progress slot's thin-history variant for an
// upcoming release. TODAY sits at the left, RELEASE at the right, and every
// unreleased dated fix version in between is a proportionally placed tick. The
// previous version (same one the burnup axis starts at) opens this release's
// window. Pure, React-free.
import { dateKeyMs } from '@/lib/epic-progress';
import type { JiraFixVersion } from '@/services/jira';
import { previousVersion } from './releaseBurnup';

const DAY_MS = 86_400_000;

export interface TrainTick {
  id: string;
  name: string;
  date: string;
  /** Position on the track, 0..1. */
  f: number;
  /** True only for the previous version: this release's window opens there. */
  windowStart: boolean;
}

export interface ReleaseTrain {
  start: string;
  end: string;
  todayF: number;
  windowStartF: number | null;
  windowOpen: boolean;
  ticks: TrainTick[];
  aheadCount: number;
  windowDays: number | null;
  daysToRelease: number;
  releaseName: string;
  previousName: string | null;
}

function dayKey(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const k = v.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : null;
}

function days(from: string, to: string): number {
  return Math.round((dateKeyMs(to) - dateKeyMs(from)) / DAY_MS);
}

function frac(day: string, start: string, end: string): number {
  const span = dateKeyMs(end) - dateKeyMs(start);
  if (!(span > 0)) return 0;
  const f = (dateKeyMs(day) - dateKeyMs(start)) / span;
  return Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0;
}

/**
 * Null when the caller should keep the plain track: undated, released, or past
 * due (release date before today).
 */
export function deriveReleaseTrain(args: {
  version: JiraFixVersion;
  fixVersions: readonly JiraFixVersion[] | undefined;
  today: string;
}): ReleaseTrain | null {
  const { version, fixVersions, today } = args;
  const end = dayKey(version.releaseDate);
  if (!end || version.released || end < today) return null;
  const prev = previousVersion(fixVersions, version);
  const prevDate = dayKey(prev?.releaseDate);
  const common = {
    end,
    windowDays: prevDate ? days(prevDate, end) : null,
    daysToRelease: days(today, end),
    releaseName: version.name,
    previousName: prev?.name ?? null,
  };

  if (prev && prevDate && prevDate <= today) {
    // Window already open: the track spans the window and TODAY sits inside it.
    return {
      ...common,
      start: prevDate,
      todayF: frac(today, prevDate, end),
      windowStartF: 0,
      windowOpen: true,
      ticks: [{ id: prev.id, name: prev.name, date: prevDate, f: 0, windowStart: true }],
      aheadCount: 0,
    };
  }

  const start = today;
  const seen = new Set<string>();
  const ticks: TrainTick[] = [];
  let aheadCount = 0;
  for (const v of fixVersions ?? []) {
    if (v.id === version.id || seen.has(v.id)) continue;
    const d = dayKey(v.releaseDate);
    if (!d || d <= today || d >= end) continue;
    const isPrev = prev?.id === v.id;
    if (v.released && !isPrev) continue;
    seen.add(v.id);
    if (!v.released) aheadCount += 1;
    ticks.push({ id: v.id, name: v.name, date: d, f: frac(d, start, end), windowStart: isPrev });
  }
  ticks.sort((a, b) =>
    a.date === b.date ? a.name.localeCompare(b.name) : a.date < b.date ? -1 : 1,
  );
  return {
    ...common,
    start,
    todayF: 0,
    windowStartF: prevDate ? frac(prevDate, start, end) : null,
    windowOpen: false,
    ticks,
    aheadCount,
  };
}

/** "1 release ahead · window 14 d · in 28 d", omitting unknown or zero parts. */
export function formatTrainSummary(train: ReleaseTrain): string {
  const parts: string[] = [];
  if (train.aheadCount > 0)
    parts.push(`${train.aheadCount} release${train.aheadCount === 1 ? '' : 's'} ahead`);
  if (train.windowDays !== null && train.windowDays > 0) parts.push(`window ${train.windowDays} d`);
  parts.push(train.daysToRelease > 0 ? `in ${train.daysToRelease} d` : 'due today');
  return parts.join(' · ');
}

export interface TrainLabelItem {
  key: string;
  f: number;
  text: string;
  /** Higher wins a collision. */
  priority: number;
  maxPx: number;
}

export interface PlacedTrainLabel extends TrainLabelItem {
  visible: boolean;
  /** Estimated box, clamped inside [0, trackPx]. */
  x0: number;
  x1: number;
  /**
   * How to position the rendered label: `start` -> left edge at x0, `end` ->
   * right edge at x1, `center` -> centred on the tick.
   */
  align: 'start' | 'center' | 'end';
}

const LABEL_GAP = 6;

/** Lay labels out on one row; colliding lower-priority labels become invisible. */
export function placeTrainLabels(items: TrainLabelItem[], trackPx: number): PlacedTrainLabel[] {
  const track = Math.max(0, trackPx);
  const placed = items.map((it): PlacedTrainLabel => {
    const w = Math.min(it.maxPx, it.text.length * 6.5 + 4, track);
    const x = it.f * track;
    let align: PlacedTrainLabel['align'] = it.f < 0.12 ? 'start' : it.f > 0.88 ? 'end' : 'center';
    let x0 = align === 'start' ? x : align === 'end' ? x - w : x - w / 2;
    if (x0 < 0) {
      x0 = 0;
      align = 'start';
    } else if (x0 + w > track) {
      x0 = track - w;
      align = 'end';
    }
    return { ...it, visible: false, x0, x1: x0 + w, align };
  });
  const order = placed
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.priority - a.p.priority || a.i - b.i);
  const kept: PlacedTrainLabel[] = [];
  for (const { p } of order) {
    const hit = kept.some((k) => p.x0 < k.x1 + LABEL_GAP && k.x0 < p.x1 + LABEL_GAP);
    if (hit) continue;
    p.visible = true;
    kept.push(p);
  }
  return placed;
}
