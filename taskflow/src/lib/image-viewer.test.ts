import { describe, expect, it } from 'vitest';
import {
  clampPan,
  fitScale,
  initialViewerState,
  isPannable,
  MAX_SCALE,
  nextFontSize,
  nextStop,
  prevFontSize,
  prevStop,
  type ViewerAction,
  type ViewerState,
  viewerReducer,
  zoomAt,
} from './image-viewer';

function run(actions: ViewerAction[], from: ViewerState = initialViewerState): ViewerState {
  return actions.reduce(viewerReducer, from);
}

const ready = (nw = 1200, nh = 800) =>
  run([
    { type: 'resize', stageW: 600, stageH: 400 },
    { type: 'loaded', naturalW: nw, naturalH: nh },
  ]);

describe('fitScale', () => {
  it('fits natural into stage', () => {
    expect(fitScale(1200, 800, 600, 400, 0)).toBe(0.5);
  });
  it('swaps dims at 90 degrees', () => {
    expect(fitScale(1200, 800, 600, 400, 90)).toBeCloseTo(1 / 3);
  });
  it('never upscales', () => {
    expect(fitScale(100, 100, 600, 400, 0)).toBe(1);
  });
});

describe('clampPan', () => {
  it('centres content smaller than the stage', () => {
    const s = ready(1200, 800);
    expect(clampPan(s, 0.5, 100, -50)).toEqual({ tx: 0, ty: 0 });
  });
  it('bounds larger content using rotated dims', () => {
    const s = ready(1200, 800);
    expect(clampPan(s, 1, 9999, -9999)).toEqual({ tx: 300, ty: -200 });
    const r = run([{ type: 'rotate', dir: 1 }], s);
    // rotated content 800x1200 at scale 1: x max (800-600)/2, y max (1200-400)/2
    expect(clampPan(r, 1, 9999, 9999)).toEqual({ tx: 100, ty: 400 });
  });
});

describe('zoomAt', () => {
  it('keeps the point under the cursor fixed', () => {
    const s = ready();
    const p = { x: 120, y: 60 };
    const a = zoomAt(s, 1, p);
    const imgPt = (st: ViewerState) => ({
      x: (p.x - st.tx) / st.scale,
      y: (p.y - st.ty) / st.scale,
    });
    expect(imgPt(a).x).toBeCloseTo(imgPt(s).x);
    expect(imgPt(a).y).toBeCloseTo(imgPt(s).y);
    expect(a.mode).toBe('free');
  });
  it('is a no-op before load', () => {
    expect(zoomAt(initialViewerState, 2)).toBe(initialViewerState);
  });
  it('clamps to max', () => {
    expect(zoomAt(ready(), 100).scale).toBe(MAX_SCALE);
  });
});

describe('ladder', () => {
  it('walks stops', () => {
    expect(nextStop(0.5)).toBe(0.67);
    expect(prevStop(0.5)).toBe(0.33);
    expect(nextStop(0.6)).toBe(0.67);
    expect(prevStop(0.6)).toBe(0.5);
    expect(nextStop(8)).toBe(8);
  });
  it('clamps scale to min(fit,0.1) .. 8', () => {
    let s = ready();
    for (let i = 0; i < 20; i++) s = run([{ type: 'zoomOut' }], s);
    expect(s.scale).toBeCloseTo(0.1);
    for (let i = 0; i < 30; i++) s = run([{ type: 'zoomIn' }], s);
    expect(s.scale).toBe(8);
  });
});

describe('viewerReducer', () => {
  it('fits on load', () => {
    const s = ready();
    expect(s.scale).toBe(0.5);
    expect(s.mode).toBe('fit');
    expect(isPannable(s)).toBe(false);
  });
  it('zoom actions are no-ops before load', () => {
    const s = run([
      { type: 'zoomIn' },
      { type: 'actual' },
      { type: 'fit' },
      { type: 'rotate', dir: 1 },
      { type: 'toggleZoom', point: { x: 0, y: 0 } },
    ]);
    expect(s).toEqual(initialViewerState);
  });
  it('zoomIn/zoomOut use the ladder and go free', () => {
    const s = run([{ type: 'zoomIn' }], ready());
    expect(s.scale).toBe(0.67);
    expect(s.mode).toBe('free');
    const b = run([{ type: 'zoomOut' }], s);
    expect(b.scale).toBe(0.5);
    expect(b.mode).toBe('fit');
  });
  it('actual and fit', () => {
    const s = run([{ type: 'actual' }], ready());
    expect(s.scale).toBe(1);
    expect(isPannable(s)).toBe(true);
    expect(run([{ type: 'fit' }], s).scale).toBe(0.5);
  });
  it('wheelZoom is factor-clamped', () => {
    const s = run([{ type: 'wheelZoom', deltaY: -1000, point: { x: 0, y: 0 } }], ready());
    expect(s.scale).toBeCloseTo(0.5 * 1.25);
    const z = run([{ type: 'wheelZoom', deltaY: -100, point: { x: 0, y: 0 } }], ready());
    expect(z.scale).toBeGreaterThan(0.5);
  });
  it('pinch sets absolute scale', () => {
    const s = run([{ type: 'pinch', scale: 1, point: { x: 10, y: 10 } }], ready());
    expect(s.scale).toBe(1);
  });
  it('pan is a no-op at fit and clamped when zoomed', () => {
    const s = ready();
    expect(run([{ type: 'pan', dx: 10, dy: 10 }], s)).toBe(s);
    const z = run([{ type: 'actual' }, { type: 'pan', dx: 1000, dy: 1000 }], s);
    expect(z.tx).toBe(300);
    expect(z.ty).toBe(200);
  });
  it('toggleZoom: fit -> 100% -> fit; 2x when fit is 1', () => {
    const s = run([{ type: 'toggleZoom', point: { x: 0, y: 0 } }], ready());
    expect(s.scale).toBe(1);
    expect(run([{ type: 'toggleZoom', point: { x: 0, y: 0 } }], s).mode).toBe('fit');
    const small = ready(100, 100);
    expect(run([{ type: 'toggleZoom', point: { x: 0, y: 0 } }], small).scale).toBe(2);
  });
  it('rotate steps and re-fits', () => {
    let s = run([{ type: 'actual' }, { type: 'rotate', dir: 1 }], ready());
    expect(s.rot).toBe(90);
    expect(s.scale).toBeCloseTo(1 / 3);
    expect(s.mode).toBe('fit');
    s = run(
      [
        { type: 'rotate', dir: -1 },
        { type: 'rotate', dir: -1 },
      ],
      s,
    );
    expect(s.rot).toBe(270);
  });
  it('resize re-fits only in fit mode', () => {
    const fit = run([{ type: 'resize', stageW: 1200, stageH: 800 }], ready());
    expect(fit.scale).toBe(1);
    const free = run([{ type: 'actual' }, { type: 'resize', stageW: 300, stageH: 200 }], ready());
    expect(free.scale).toBe(1);
    expect(free.mode).toBe('free');
  });
});

describe('font ladder', () => {
  it('steps and clamps', () => {
    expect(nextFontSize(12)).toBe(13);
    expect(prevFontSize(12)).toBe(11);
    expect(nextFontSize(24)).toBe(24);
    expect(prevFontSize(10)).toBe(10);
  });
});
