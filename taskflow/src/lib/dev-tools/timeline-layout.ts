/**
 * Pure layout maths for the Logs timeline and waterfall: lane packing, burst grouping, in-flight
 * and queued step series, and the waterfall bar segment. No React, no DOM.
 */

/** Requests separated by more than this much idle time belong to different bursts. */
export const BURST_GAP_MS = 1500;

export interface Span {
  id: string;
  start: number;
  end: number;
}

const byStartThenId = (a: Span, b: Span) =>
  a.start - b.start || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Greedy lane packing, sorted by start (ties by id). A span goes into the lowest lane whose last
 * end is at or before its start; otherwise it opens a new lane.
 */
export function packLanes(spans: Span[]): { lane: Map<string, number>; laneCount: number } {
  const lane = new Map<string, number>();
  const laneEnds: number[] = [];
  for (const s of [...spans].sort(byStartThenId)) {
    let i = laneEnds.findIndex((end) => end <= s.start);
    if (i === -1) {
      i = laneEnds.length;
      laneEnds.push(s.end);
    } else {
      laneEnds[i] = s.end;
    }
    lane.set(s.id, i);
  }
  return { lane, laneCount: laneEnds.length };
}

export interface Burst {
  id: string;
  start: number;
  end: number;
  ids: string[];
  route: string;
  count: number;
  totalMs: number;
}

/** Groups requests into bursts separated by more than `gapMs` of idle time. Newest first. */
export function groupBursts(
  items: { id: string; start: number; end: number; route?: string }[],
  gapMs = BURST_GAP_MS,
): Burst[] {
  const sorted = [...items].sort(byStartThenId);
  const bursts: Burst[] = [];
  let cur: Burst | null = null;
  for (const it of sorted) {
    if (cur === null || it.start - cur.end > gapMs) {
      cur = {
        id: `burst-${it.id}`,
        start: it.start,
        end: it.end,
        ids: [it.id],
        route: it.route || '(unknown)',
        count: 1,
        totalMs: it.end - it.start,
      };
      bursts.push(cur);
    } else {
      cur.ids.push(it.id);
      cur.count++;
      if (it.end > cur.end) cur.end = it.end;
      cur.totalMs = cur.end - cur.start;
    }
  }
  return bursts.reverse();
}

interface Interval {
  from: number;
  to: number;
}

/**
 * Step series of overlapping intervals clipped to the window. At one instant, ends are applied
 * before starts and same-instant events collapse into one point, so a hand-off never double counts.
 */
function stepSeries(
  intervals: Interval[],
  [w0, w1]: [number, number],
): { points: [number, number][]; peak: number; peakAt: number | null } {
  const events: [number, number][] = [];
  for (const iv of intervals) {
    if (!(iv.to > iv.from)) continue;
    events.push([iv.from, 1], [iv.to, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  let count = 0;
  let i = 0;
  while (i < events.length && events[i][0] <= w0) count += events[i++][1];

  const points: [number, number][] = [[w0, count]];
  let peak = count;
  let peakAt: number | null = count > 0 ? w0 : null;
  while (i < events.length && events[i][0] < w1) {
    const t = events[i][0];
    while (i < events.length && events[i][0] === t) count += events[i++][1];
    points.push([t, count]);
    if (count > peak) {
      peak = count;
      peakAt = t;
    }
  }
  points.push([w1, count]);
  return { points, peak, peakAt };
}

export function concurrencySeries(
  spans: { start: number; end: number }[],
  window: [number, number],
): { points: [number, number][]; peak: number; peakAt: number | null } {
  return stepSeries(
    spans.map((s) => ({ from: s.start, to: s.end })),
    window,
  );
}

/** Step series of requests waiting for a slot (queuedAt to start); spans never queued contribute nothing. */
export function queuedSeries(
  spans: { start: number; queuedAt?: number }[],
  window: [number, number],
): { points: [number, number][]; peak: number } {
  const { points, peak } = stepSeries(
    spans.flatMap((s) => (s.queuedAt === undefined ? [] : [{ from: s.queuedAt, to: s.start }])),
    window,
  );
  return { points, peak };
}

/** Bar geometry (percent of the burst width) for one request inside its burst. */
export function waterfallSegment(
  start: number,
  end: number,
  burst: { start: number; end: number },
): { leftPct: number; widthPct: number } {
  const span = burst.end - burst.start || 1;
  const leftPct = Math.min(100, Math.max(0, ((start - burst.start) / span) * 100));
  const widthPct = Math.max(0.5, Math.min(((end - start) / span) * 100, 100 - leftPct));
  return { leftPct, widthPct };
}
