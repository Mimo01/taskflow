import { describe, expect, it } from 'vitest';
import {
  brushWindow,
  createTimeScale,
  fitWindow,
  formatOffset,
  timeTicks,
  zoomWindow,
} from './time-scale';

describe('createTimeScale', () => {
  it('x and invert are inverses', () => {
    const s = createTimeScale([1000, 3000], 500);
    expect(s.x(2000)).toBe(250);
    expect(s.invert(s.x(1234))).toBeCloseTo(1234);
  });

  it('treats a zero-length domain as 1 ms', () => {
    expect(createTimeScale([5, 5], 100).x(6)).toBe(100);
  });
});

describe('formatOffset', () => {
  it('formats ms and s', () => {
    expect(formatOffset(0)).toBe('0 ms');
    expect(formatOffset(250)).toBe('250 ms');
    expect(formatOffset(1500)).toBe('1.5 s');
    expect(formatOffset(12_000)).toBe('12 s');
  });
});

describe('timeTicks', () => {
  it('uses 1/2/5 steps relative to the window start', () => {
    const ticks = timeTicks([0, 1000]);
    expect(ticks.map((t) => t.t)).toEqual([0, 200, 400, 600, 800, 1000]);
    expect(ticks[0].label).toBe('0 ms');
    expect(ticks[1].label).toBe('200 ms');
  });

  it('is relative to a non-zero start', () => {
    const ticks = timeTicks([5000, 6000]);
    expect(ticks[0]).toEqual({ t: 5000, label: '0 ms' });
  });
});

describe('zoomWindow', () => {
  it('zooms in around the anchor', () => {
    const [a, b] = zoomWindow([0, 1000], 500, 0.8);
    expect(a).toBeCloseTo(100);
    expect(b).toBeCloseTo(900);
  });

  it('zooms out and clamps to bounds', () => {
    expect(zoomWindow([100, 900], 500, 1.25, [0, 1000])).toEqual([0, 1000]);
  });

  it('never goes below 5 ms', () => {
    const [a, b] = zoomWindow([0, 6], 3, 0.1);
    expect(b - a).toBeCloseTo(5);
  });
});

describe('fitWindow', () => {
  it('pads the extent', () => {
    expect(
      fitWindow([
        { start: 0, end: 100 },
        { start: 100, end: 1000 },
      ]),
    ).toEqual([-30, 1030]);
  });

  it('returns null when empty', () => {
    expect(fitWindow([])).toBeNull();
  });
});

describe('brushWindow', () => {
  const scale = createTimeScale([0, 1000], 1000);
  it('maps pixels to a window, in either drag direction', () => {
    expect(brushWindow(100, 300, scale)).toEqual([100, 300]);
    expect(brushWindow(300, 100, scale)).toEqual([100, 300]);
  });

  it('ignores drags under 4 px', () => {
    expect(brushWindow(100, 103, scale)).toBeNull();
  });
});
