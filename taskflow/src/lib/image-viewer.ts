// Pure zoom/pan/rotate math + reducer for the shared image viewer.
// No DOM access and no module-level mutable state (React Compiler safe).
//
// Coordinate convention: the image is laid out at its natural pixel size,
// centred in the stage, with transform-origin at its centre and
// `transform: translate(tx, ty) scale(s) rotate(rot)`. Points passed to the
// reducer are relative to the stage centre. scale 1 = 100% = 1 image px per
// CSS px.

export const MAX_SCALE = 8;
const MIN_FLOOR = 0.1;
const EPS = 1e-3;
export const ZOOM_STOPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
export const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24];
export const DEFAULT_FONT_SIZE = 12;

export type Rotation = 0 | 90 | 180 | 270;

export interface ViewerState {
  naturalW: number;
  naturalH: number;
  stageW: number;
  stageH: number;
  scale: number;
  tx: number;
  ty: number;
  rot: Rotation;
  /** rest = opening size (fit, never enlarged); fit = fill the stage (may enlarge); free = user zoom. */
  mode: 'rest' | 'fit' | 'free';
  loaded: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export type ViewerAction =
  | { type: 'loaded'; naturalW: number; naturalH: number }
  | { type: 'resize'; stageW: number; stageH: number }
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
  | { type: 'zoomTo'; scale: number; point?: Point }
  | { type: 'wheelZoom'; deltaY: number; point: Point }
  | { type: 'pinch'; scale: number; point: Point }
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'fit' }
  | { type: 'actual' }
  | { type: 'toggleZoom'; point: Point }
  | { type: 'rotate'; dir: 1 | -1 };

export const initialViewerState: ViewerState = {
  naturalW: 0,
  naturalH: 0,
  stageW: 0,
  stageH: 0,
  scale: 1,
  tx: 0,
  ty: 0,
  rot: 0,
  mode: 'rest',
  loaded: false,
};

const CENTER: Point = { x: 0, y: 0 };

function rotatedDims(naturalW: number, naturalH: number, rot: number) {
  return rot % 180 === 0 ? { w: naturalW, h: naturalH } : { w: naturalH, h: naturalW };
}

/** Scale at which the (rotated) image exactly fills the stage. May exceed 1. */
export function fillScale(
  naturalW: number,
  naturalH: number,
  stageW: number,
  stageH: number,
  rot: number,
): number {
  const { w, h } = rotatedDims(naturalW, naturalH, rot);
  if (w <= 0 || h <= 0 || stageW <= 0 || stageH <= 0) return 1;
  return Math.min(stageW / w, stageH / h);
}

/** Opening ("rest") scale: fits the stage but never enlarges past 100%. */
export function fitScale(
  naturalW: number,
  naturalH: number,
  stageW: number,
  stageH: number,
  rot: number,
): number {
  return Math.min(1, fillScale(naturalW, naturalH, stageW, stageH, rot));
}

function currentFit(s: ViewerState): number {
  return fitScale(s.naturalW, s.naturalH, s.stageW, s.stageH, s.rot);
}

function currentFill(s: ViewerState): number {
  return fillScale(s.naturalW, s.naturalH, s.stageW, s.stageH, s.rot);
}

function modeFor(s: ViewerState, scale: number): ViewerState['mode'] {
  if (Math.abs(scale - currentFit(s)) < EPS) return 'rest';
  if (Math.abs(scale - currentFill(s)) < EPS) return 'fit';
  return 'free';
}

export function minScale(fit: number): number {
  return Math.min(fit, MIN_FLOOR);
}

function clampScale(scale: number, fit: number): number {
  return Math.min(MAX_SCALE, Math.max(minScale(fit), scale));
}

/** Clamp translation so the image can't be dragged out of the stage. */
export function clampPan(
  s: ViewerState,
  scale: number,
  tx: number,
  ty: number,
): { tx: number; ty: number } {
  const { w, h } = rotatedDims(s.naturalW, s.naturalH, s.rot);
  const maxX = Math.max(0, (w * scale - s.stageW) / 2);
  const maxY = Math.max(0, (h * scale - s.stageH) / 2);
  return {
    tx: Math.min(maxX, Math.max(-maxX, tx)) || 0,
    ty: Math.min(maxY, Math.max(-maxY, ty)) || 0,
  };
}

/** True when the scaled image overflows the stage, so there is something to pan. */
export function isPannable(s: ViewerState): boolean {
  return s.loaded && s.scale > currentFill(s) + EPS;
}

function restState(s: ViewerState): ViewerState {
  return { ...s, scale: currentFit(s), tx: 0, ty: 0, mode: 'rest' };
}

function fillState(s: ViewerState): ViewerState {
  return { ...s, scale: clampScale(currentFill(s), currentFit(s)), tx: 0, ty: 0, mode: 'fit' };
}

/** Scale a click zooms to from a non-overflowing view: actual pixels first, then doubling. */
export function clickZoomTarget(scale: number): number {
  return Math.min(MAX_SCALE, scale < 1 - EPS ? 1 : scale * 2);
}

/** Zoom to `newScale` keeping the image pixel under `point` fixed. */
export function zoomAt(s: ViewerState, newScale: number, point: Point = CENTER): ViewerState {
  if (!s.loaded) return s;
  const fit = currentFit(s);
  const next = clampScale(newScale, fit);
  const ratio = next / s.scale;
  const rawX = point.x - (point.x - s.tx) * ratio;
  const rawY = point.y - (point.y - s.ty) * ratio;
  if (Math.abs(next - fit) < EPS) return restState(s);
  const { tx, ty } = clampPan(s, next, rawX, rawY);
  return { ...s, scale: next, tx, ty, mode: modeFor(s, next) };
}

export function nextStop(scale: number): number {
  return ZOOM_STOPS.find((z) => z > scale + EPS) ?? MAX_SCALE;
}

export function prevStop(scale: number): number {
  for (let i = ZOOM_STOPS.length - 1; i >= 0; i--) {
    const z = ZOOM_STOPS[i];
    if (z !== undefined && z < scale - EPS) return z;
  }
  return ZOOM_STOPS[0] ?? MIN_FLOOR;
}

export function nextFontSize(size: number): number {
  return FONT_SIZES.find((f) => f > size) ?? (FONT_SIZES[FONT_SIZES.length - 1] as number);
}

export function prevFontSize(size: number): number {
  for (let i = FONT_SIZES.length - 1; i >= 0; i--) {
    const f = FONT_SIZES[i];
    if (f !== undefined && f < size) return f;
  }
  return FONT_SIZES[0] as number;
}

export function viewerReducer(s: ViewerState, a: ViewerAction): ViewerState {
  switch (a.type) {
    case 'loaded':
      return restState({ ...s, naturalW: a.naturalW, naturalH: a.naturalH, rot: 0, loaded: true });
    case 'resize': {
      const next = { ...s, stageW: a.stageW, stageH: a.stageH };
      if (!next.loaded) return next;
      if (next.mode === 'rest') return restState(next);
      if (next.mode === 'fit') return fillState(next);
      const fit = currentFit(next);
      const scale = clampScale(next.scale, fit);
      const { tx, ty } = clampPan(next, scale, next.tx, next.ty);
      return { ...next, scale, tx, ty };
    }
    case 'zoomIn':
      return zoomAt(s, nextStop(s.scale));
    case 'zoomOut':
      return zoomAt(s, prevStop(s.scale));
    case 'zoomTo':
      return zoomAt(s, a.scale, a.point);
    case 'wheelZoom': {
      const factor = Math.min(1.25, Math.max(0.8, Math.exp(-a.deltaY * 0.01)));
      return zoomAt(s, s.scale * factor, a.point);
    }
    case 'pinch':
      return zoomAt(s, a.scale, a.point);
    case 'pan': {
      if (!isPannable(s)) return s;
      const { tx, ty } = clampPan(s, s.scale, s.tx + a.dx, s.ty + a.dy);
      return { ...s, tx, ty };
    }
    case 'fit':
      return s.loaded ? fillState(s) : s;
    case 'actual':
      return zoomAt(s, 1, CENTER);
    case 'toggleZoom': {
      // Click: zoom in toward the point until the image overflows; once it does, return to rest.
      if (!s.loaded) return s;
      if (isPannable(s)) return restState(s);
      return zoomAt(s, clickZoomTarget(s.scale), a.point);
    }
    case 'rotate': {
      if (!s.loaded) return s;
      const rot = ((s.rot + 90 * a.dir + 360) % 360) as Rotation;
      return restState({ ...s, rot });
    }
    default:
      return s;
  }
}
