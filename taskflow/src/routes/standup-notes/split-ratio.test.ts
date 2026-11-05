import { describe, expect, it } from 'vitest';
import { clampSplitRatio, DEFAULT_SPLIT_RATIO, MIN_PANE_PX, pxToSplitRatio } from './split-ratio';

describe('clampSplitRatio', () => {
  it('keeps an in-range ratio', () => {
    expect(clampSplitRatio(0.5, 1200)).toBe(0.5);
  });
  it('clamps to the bounds on a wide container', () => {
    expect(clampSplitRatio(0.05, 1200)).toBeCloseTo(Math.max(0.2, MIN_PANE_PX / 1200));
    expect(clampSplitRatio(0.95, 1200)).toBeCloseTo(Math.min(0.8, 1 - MIN_PANE_PX / 1200));
  });
  it('px floor dominates on a narrow container', () => {
    expect(clampSplitRatio(0.1, 700)).toBeCloseTo(MIN_PANE_PX / 700);
    expect(clampSplitRatio(0.9, 700)).toBeCloseTo(1 - MIN_PANE_PX / 700);
  });
  it('crossed bounds fall back to default', () => {
    expect(clampSplitRatio(0.3, 600)).toBe(DEFAULT_SPLIT_RATIO);
  });
  it('invalid input falls back to default', () => {
    expect(clampSplitRatio(Number.NaN, 1200)).toBe(DEFAULT_SPLIT_RATIO);
    expect(clampSplitRatio(0.4, 0)).toBe(DEFAULT_SPLIT_RATIO);
  });
});

describe('pxToSplitRatio', () => {
  it('converts and clamps', () => {
    expect(pxToSplitRatio(480, 1200)).toBeCloseTo(0.4);
    expect(pxToSplitRatio(10, 1200)).toBeCloseTo(0.2667, 3);
  });
  it('zero container -> default', () => {
    expect(pxToSplitRatio(480, 0)).toBe(DEFAULT_SPLIT_RATIO);
  });
});
