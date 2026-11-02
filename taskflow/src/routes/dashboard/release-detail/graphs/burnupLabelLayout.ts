import { PLOT_MARGIN, Y_AXIS_WIDTH } from '../../issue-detail/EpicChartZoom';

/** Chart margins handed to recharts (top leaves a band for the TODAY / RELEASE labels). */
export const BURNUP_MARGIN = { ...PLOT_MARGIN, top: 14, right: 12 };
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
const MARKER_OFFSET = 3;

export type MarkerKind = 'today' | 'release';
export type MarkerLabelKind = MarkerKind | 'both';
export interface MarkerLabel {
  text: string;
  /** Which marker the label belongs to ('both' = merged TODAY + RELEASE). */
  kind: MarkerLabelKind;
  /** Anchor x (text x attribute). */
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  box: Box;
}
export interface BurnupLabelInput {
  chartWidth: number;
  chartHeight: number;
  plot: PlotBox;
  markers: { kind: MarkerKind; x: number }[];
}
export interface BurnupLabelLayout {
  markers: MarkerLabel[];
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
function markerText(
  text: string,
  kind: MarkerLabelKind,
  x: number,
  anchor: MarkerLabel['anchor'],
): MarkerLabel {
  const ax = anchor === 'start' ? x + MARKER_OFFSET : anchor === 'end' ? x - MARKER_OFFSET : x;
  return { text, kind, x: ax, y: MARKER_BASELINE_Y, anchor, box: markerBox(text, x, anchor) };
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
      if (inside(markerBox(text, m.x, a))) return [markerText(text, m.kind, m.x, a)];
    }
    return [clampMarker(text, m.kind, m.x, W)];
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
        return [markerText(ta, a.kind, a.x, pa), markerText(tb, b.kind, b.x, pb)];
      }
    }
  }
  // Same day or too tight: one merged label.
  const text = `${ta} · ${tb}`;
  const mx = b.x - a.x < 1 ? a.x : (a.x + b.x) / 2;
  for (const p of ANCHORS) {
    if (inside(markerBox(text, mx, p))) return [markerText(text, 'both', mx, p)];
  }
  return [clampMarker(text, 'both', mx, W)];
}

function clampMarker(text: string, kind: MarkerLabelKind, x: number, W: number): MarkerLabel {
  const w = markerWidth(text);
  const left = Math.min(Math.max(1, x - w / 2), W - 1 - w);
  return {
    text,
    kind,
    x: left + w / 2,
    y: MARKER_BASELINE_Y,
    anchor: 'middle',
    box: { x: left, y: MARKER_BOX_Y, w, h: MARKER_H },
  };
}

/**
 * Pure label layout for the burnup chart, in chart pixel coordinates. Marker
 * labels live in the band above the plot (merged / split-anchored when they
 * would collide, anchored against their line at the chart edges), so they never
 * sit over the series. The series carry no in-plot labels: exact values are in
 * the hover tooltip.
 */
export function layoutBurnupLabels(input: BurnupLabelInput): BurnupLabelLayout {
  return { markers: placeMarkers(input) };
}
