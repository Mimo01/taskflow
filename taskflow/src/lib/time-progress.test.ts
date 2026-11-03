import { describe, expect, it } from 'vitest';
import { isDoneStatus, timeProgress } from './time-progress';

const H = 3600;
const tp = (spent: number, est: number | undefined, isDone: boolean) =>
  timeProgress({
    spentSeconds: spent * H,
    estimateSeconds: est === undefined ? undefined : est * H,
    isDone,
  });

describe('timeProgress', () => {
  it('returns no bar without a positive estimate', () => {
    for (const est of [undefined, 0, -1]) {
      expect(tp(1, est, false)).toEqual({ fillPct: 0, indicatorClass: undefined, overrun: false });
    }
  });
  it('not done: green below 75%, amber from 75%', () => {
    expect(tp(1, 4, false)).toMatchObject({ fillPct: 25, indicatorClass: 'bg-green-500' });
    expect(tp(3, 4, false).indicatorClass).toBe('bg-amber-500');
    expect(tp(2.9, 4, false).indicatorClass).toBe('bg-green-500');
  });
  it('not done at/near estimate is amber, not overrun', () => {
    expect(tp(4, 4, false)).toEqual({
      fillPct: 100,
      indicatorClass: 'bg-amber-500',
      overrun: false,
    });
    expect(tp(3.99, 4, false)).toMatchObject({
      fillPct: 100,
      indicatorClass: 'bg-amber-500',
      overrun: false,
    });
  });
  it('done: green under and at estimate', () => {
    expect(tp(2, 4, true)).toMatchObject({ fillPct: 50, indicatorClass: 'bg-green-500' });
    expect(tp(3.5, 4, true).indicatorClass).toBe('bg-green-500');
    expect(tp(4, 4, true)).toMatchObject({ fillPct: 100, indicatorClass: 'bg-green-500' });
  });
  it('over estimate is red regardless of status, capped at 100', () => {
    for (const d of [true, false]) {
      expect(tp(5, 4, d)).toEqual({ fillPct: 100, indicatorClass: 'bg-red-500', overrun: true });
    }
  });
  it('zero spent is green and empty', () => {
    expect(tp(0, 4, false)).toMatchObject({ fillPct: 0, indicatorClass: 'bg-green-500' });
  });
});

describe('isDoneStatus', () => {
  it('is true only for done', () => {
    expect(isDoneStatus('done')).toBe(true);
    expect(isDoneStatus('indeterminate')).toBe(false);
    expect(isDoneStatus(undefined)).toBe(false);
  });
});
