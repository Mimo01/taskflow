import { PLOT_MARGIN, Y_AXIS_WIDTH } from '../../issue-detail/EpicChartZoom';

/** Chart margins handed to recharts (top leaves a band for the TODAY / RELEASE labels). */
export const BURNUP_MARGIN = { ...PLOT_MARGIN, top: 14, right: 40 };
/** XAxis height (tick row below the plot); tighter than recharts' default 30. */
export const X_AXIS_HEIGHT = 22;
/** End-point dot radius and the width of its background ring. */
export const DOT_R = 3;
export const DOT_RING = 1.5;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface PlotBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Inner plot rectangle in chart (SVG) coordinates for a chart of `width` x `height`. */
export function burnupPlotBox(width: number, height: number): PlotBox {
  return {
    left: Y_AXIS_WIDTH + BURNUP_MARGIN.left,
    right: width - BURNUP_MARGIN.right,
    top: BURNUP_MARGIN.top,
    bottom: height - X_AXIS_HEIGHT,
  };
}

/** 10px uppercase tracking-wide marker label. */
export const MARKER_CHAR_W = 7;
export const MARKER_PAD = 4;
export const MARKER_H = 12;
export const MARKER_BASELINE_Y = 10;
const MARKER_BOX_Y = 1;
/** 11px end label (matches the old CHAR_W). */
export const END_CHAR_W = 5.9;
export const END_PAD = 6;
export const END_H = 13;
/** Baseline offset inside an end label box (box.y + END_BASELINE). */
export const END_BASELINE = 10;
/** Clear of the end-point dot (radius + ring). */
const END_OFFSET = DOT_R + DOT_RING + 2.5;
const MARKER_OFFSET = 3;

export type MarkerKind = 'today' | 'release';
export interface MarkerLabel {
  text: string;
  /** Anchor x (text x attribute). */
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  box: Box;
}
export interface EndLabel {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  color: 'scope' | 'done';
  box: Box;
}
export interface BurnupLabelInput {
  chartWidth: number;
  chartHeight: number;
  plot: PlotBox;
  markers: { kind: MarkerKind; x: number }[];
  end: { x: number; scopeY: number; doneY: number; scope: number; done: number };
}
export interface BurnupLabelLayout {
  markers: MarkerLabel[];
  ends: EndLabel[];
}

const MARKER_TEXT: Record<MarkerKind, string> = { today: 'TODAY', release: 'RELEASE' };

function intersects(a: Box, b: Box, gap = 0): boolean {
  return (
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
  );
}
const markerWidth = (text: string) => text.length * MARKER_CHAR_W + MARKER_PAD;

function markerBox(text: string, x: number, anchor: MarkerLabel['anchor']): Box {
  const w = markerWidth(text);
  const left =
    anchor === 'middle'
      ? x - w / 2
      : anchor === 'start'
        ? x + MARKER_OFFSET
        : x - MARKER_OFFSET - w;
  return { x: left, y: MARKER_BOX_Y, w, h: MARKER_H };
}
function markerText(text: string, x: number, anchor: MarkerLabel['anchor']): MarkerLabel {
  const ax = anchor === 'start' ? x + MARKER_OFFSET : anchor === 'end' ? x - MARKER_OFFSET : x;
  return { text, x: ax, y: MARKER_BASELINE_Y, anchor, box: markerBox(text, x, anchor) };
}

const ANCHORS: MarkerLabel['anchor'][] = ['middle', 'end', 'start'];

function placeMarkers(input: BurnupLabelInput): MarkerLabel[] {
  const W = input.chartWidth;
  const inside = (b: Box) => b.x >= 1 && b.x + b.w <= W - 1;
  const ms = [...input.markers].sort((a, b) => a.x - b.x);
  if (ms.length === 0) return [];
  if (ms.length === 1) {
    const m = ms[0];
    const text = MARKER_TEXT[m.kind];
    for (const a of ANCHORS) {
      if (inside(markerBox(text, m.x, a))) return [markerText(text, m.x, a)];
    }
    return [clampMarker(text, m.x, W)];
  }
  const [a, b] = ms;
  const ta = MARKER_TEXT[a.kind];
  const tb = MARKER_TEXT[b.kind];
  if (b.x - a.x >= 1) {
    for (const pa of ANCHORS) {
      for (const pb of ANCHORS) {
        const ba = markerBox(ta, a.x, pa);
        const bb = markerBox(tb, b.x, pb);
        if (!inside(ba) || !inside(bb) || intersects(ba, bb, 4)) continue;
        // A label must not run over the other marker's line.
        if (b.x > ba.x - 2 && b.x < ba.x + ba.w + 2) continue;
        if (a.x > bb.x - 2 && a.x < bb.x + bb.w + 2) continue;
        return [markerText(ta, a.x, pa), markerText(tb, b.x, pb)];
      }
    }
  }
  // Same day or too tight: one merged label.
  const text = `${ta} · ${tb}`;
  const mx = b.x - a.x < 1 ? a.x : (a.x + b.x) / 2;
  for (const p of ANCHORS) {
    if (inside(markerBox(text, mx, p))) return [markerText(text, mx, p)];
  }
  return [clampMarker(text, mx, W)];
}

function clampMarker(text: string, x: number, W: number): MarkerLabel {
  const w = markerWidth(text);
  const left = Math.min(Math.max(1, x - w / 2), W - 1 - w);
  return {
    text,
    x: left + w / 2,
    y: MARKER_BASELINE_Y,
    anchor: 'middle',
    box: { x: left, y: MARKER_BOX_Y, w, h: MARKER_H },
  };
}

function endCandidates(
  text: string,
  lastX: number,
  side: 'right' | 'left',
  plot: PlotBox,
  W: number,
  lineYs: number[],
): Box[] {
  const w = text.length * END_CHAR_W + END_PAD;
  const x = side === 'right' ? lastX + END_OFFSET : lastX - END_OFFSET - w;
  if (x < plot.left || x + w > W - 1) return [];
  const lo = plot.top;
  const hi = plot.bottom - END_H;
  if (hi < lo) return [];
  const step = END_H + 3;
  const ys = new Set<number>([lo, hi]);
  for (const ly of lineYs) {
    for (const base of [ly - END_H / 2, ly - END_H - 2, ly + 2]) {
      for (let k = -2; k <= 2; k++) ys.add(Math.min(hi, Math.max(lo, base + k * step)));
    }
  }
  return [...ys].map((y) => ({ x, y, w, h: END_H }));
}

function placeEnds(input: BurnupLabelInput): EndLabel[] {
  const { plot, chartWidth: W, end } = input;
  const merged = end.scope === end.done;
  const scopeText = merged ? `${end.scope} scope · done` : `${end.scope} scope`;
  const doneText = `${end.done} done`;
  const lineXs = input.markers.map((m) => m.x);
  const crosses = (b: Box) => lineXs.filter((x) => x > b.x && x < b.x + b.w).length;
  const centre = (b: Box) => b.y + b.h / 2;
  // On the left of the last point the label lies over the lines; keep it off them.
  const onLine = (b: Box) => {
    const ys = merged ? [end.scopeY] : [end.scopeY, end.doneY];
    return ys.filter((y) => y > b.y - 2 && y < b.y + b.h + 2).length;
  };
  // Left of the last point both series rise towards it, so only the area above a
  // line is free of that line: keep the label above its own final value.
  const notAbove = (b: Box, lineY: number, side: 'right' | 'left') =>
    side === 'left' && b.y + b.h > lineY - 1 ? 1 : 0;
  const make = (
    text: string,
    box: Box,
    side: 'right' | 'left',
    color: 'scope' | 'done',
  ): EndLabel => ({
    text,
    x: side === 'right' ? box.x + END_PAD / 2 : box.x + box.w - END_PAD / 2,
    y: box.y + END_BASELINE,
    anchor: side === 'right' ? 'start' : 'end',
    color,
    box,
  });
  const ideal = (b: Box, lineY: number, side: 'right' | 'left') =>
    side === 'right'
      ? Math.abs(centre(b) - lineY)
      : Math.abs(centre(b) - (lineY - (END_H / 2 + 2)));

  for (const side of ['right', 'left'] as const) {
    const sideCost = side === 'left' ? 100 : 0;
    const sc = endCandidates(scopeText, end.x, side, plot, W, [end.scopeY, end.doneY]);
    if (sc.length === 0) continue;
    if (merged) {
      let best: Box | null = null;
      let bestCost = Number.POSITIVE_INFINITY;
      for (const b of sc) {
        const c =
          ideal(b, end.scopeY, side) +
          crosses(b) * 20 +
          (onLine(b) + notAbove(b, end.scopeY, side)) * 1000;
        if (c < bestCost) {
          bestCost = c;
          best = b;
        }
      }
      if (best) return [make(scopeText, best, side, 'scope')];
      continue;
    }
    const dc = endCandidates(doneText, end.x, side, plot, W, [end.scopeY, end.doneY]);
    if (dc.length === 0) continue;
    let best: { s: Box; d: Box } | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const s of sc) {
      const cs =
        ideal(s, end.scopeY, side) +
        crosses(s) * 20 +
        (onLine(s) + notAbove(s, end.scopeY, side)) * 1000;
      if (cs + sideCost >= bestCost) continue;
      for (const d of dc) {
        if (intersects(s, d, 2)) continue;
        let c =
          cs +
          ideal(d, end.doneY, side) +
          crosses(d) * 20 +
          (onLine(d) + notAbove(d, end.doneY, side)) * 1000 +
          sideCost;
        if (centre(s) > centre(d)) c += 40;
        if (c < bestCost) {
          bestCost = c;
          best = { s, d };
        }
      }
    }
    if (best) return [make(scopeText, best.s, side, 'scope'), make(doneText, best.d, side, 'done')];
  }
  return [];
}

/**
 * Pure label layout for the burnup chart, in chart pixel coordinates. Marker
 * labels live in the band above the plot (merged / split-anchored when they
 * would collide, anchored against their line at the chart edges); end labels live
 * inside the plot box, so they can never meet a marker label or the tick row.
 */
export function layoutBurnupLabels(input: BurnupLabelInput): BurnupLabelLayout {
  return { markers: placeMarkers(input), ends: placeEnds(input) };
}
