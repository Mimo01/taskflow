/**
 * Pure time-axis maths for the Logs timeline: linear scale, readable ticks, zoom and brush
 * windows. No React, no DOM.
 */

export interface TimeScale {
  x: (t: number) => number;
  invert: (px: number) => number;
}

/** Linear scale; a zero-length domain is treated as 1 ms. */
export function createTimeScale([t0, t1]: [number, number], widthPx: number): TimeScale {
  const span = t1 - t0 || 1;
  return {
    x: (t) => ((t - t0) / span) * widthPx,
    invert: (px) => t0 + (px / widthPx) * span,
  };
}

/** '0 ms', '250 ms', '1.5 s', '12 s'. */
export function formatOffset(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < 1000) return `${Math.round(ms)} ms`;
  if (abs < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 1000)} s`;
}

/** Ticks at 1/2/5 x 10^k ms steps, labelled relative to the window start. */
export function timeTicks(
  [t0, t1]: [number, number],
  targetCount = 6,
): { t: number; label: string }[] {
  const span = t1 - t0;
  if (!(span > 0)) return [{ t: t0, label: formatOffset(0) }];
  const raw = span / Math.max(1, targetCount);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: { t: number; label: string }[] = [];
  for (let k = 0; k * step <= span + 1e-9; k++) {
    const offset = k * step;
    ticks.push({ t: t0 + offset, label: formatOffset(offset) });
  }
  return ticks;
}

export const MIN_WINDOW_MS = 5;

/**
 * Zooms around `anchorT`: factor below 1 zooms in, above 1 zooms out. The span never drops below
 * 5 ms and the result is clamped to `bounds` when given.
 */
export function zoomWindow(
  [t0, t1]: [number, number],
  anchorT: number,
  factor: number,
  bounds?: [number, number],
): [number, number] {
  const span = t1 - t0 || 1;
  const ratio = Math.min(1, Math.max(0, (anchorT - t0) / span));
  let nextSpan = Math.max(MIN_WINDOW_MS, span * factor);
  if (bounds) nextSpan = Math.min(nextSpan, Math.max(MIN_WINDOW_MS, bounds[1] - bounds[0]));
  let n0 = anchorT - ratio * nextSpan;
  let n1 = n0 + nextSpan;
  if (bounds) {
    if (n0 < bounds[0]) [n0, n1] = [bounds[0], bounds[0] + nextSpan];
    if (n1 > bounds[1]) [n0, n1] = [bounds[1] - nextSpan, bounds[1]];
  }
  return [n0, n1];
}

/** [min start, max end] padded by `padRatio` of the span; null when there are no spans. */
export function fitWindow(
  spans: { start: number; end: number }[],
  padRatio = 0.03,
): [number, number] | null {
  if (spans.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of spans) {
    if (s.start < min) min = s.start;
    if (s.end > max) max = s.end;
  }
  const pad = max > min ? (max - min) * padRatio : 1;
  return [min - pad, max + pad];
}

/** Sorted window from two pixel positions; null for a drag under 4 px. */
export function brushWindow(px0: number, px1: number, scale: TimeScale): [number, number] | null {
  if (Math.abs(px1 - px0) < 4) return null;
  const [a, b] = px0 < px1 ? [px0, px1] : [px1, px0];
  return [scale.invert(a), scale.invert(b)];
}
