import { describe, expect, it } from 'vitest';
import { aggregateStepStats, type StepQueryResult } from './aio-step-stats';

const ok = (...statuses: string[]): StepQueryResult => ({
  data: { steps: statuses.map((status, i) => ({ id: i, step: 's', status })) },
  isPending: false,
  isError: false,
});

describe('aggregateStepStats', () => {
  it('returns zeros for empty input', () => {
    expect(aggregateStepStats([])).toEqual({
      passed: 0,
      failed: 0,
      blocked: 0,
      notRun: 0,
      executed: 0,
      total: 0,
      cases: 0,
      minPerCase: 0,
      maxPerCase: 0,
      unavailable: 0,
    });
  });

  it('counts statuses for one case', () => {
    const t = aggregateStepStats([ok('PASS', 'PASS', 'FAIL', 'BLOCKED', 'NOT_EXECUTED')]);
    expect(t).toMatchObject({
      passed: 2,
      failed: 1,
      blocked: 1,
      notRun: 1,
      executed: 4,
      total: 5,
      cases: 1,
      minPerCase: 5,
      maxPerCase: 5,
    });
  });

  it('computes min/max across cases', () => {
    const t = aggregateStepStats([ok('PASS', 'PASS', 'PASS'), ok(...Array(7).fill('PASS'))]);
    expect(t).toMatchObject({ total: 10, cases: 2, minPerCase: 3, maxPerCase: 7 });
  });

  it('excludes errored and null results and counts them unavailable', () => {
    const t = aggregateStepStats([
      ok('PASS'),
      { isPending: false, isError: true },
      { data: null, isPending: false, isError: false },
    ]);
    expect(t).toMatchObject({ cases: 1, total: 1, unavailable: 2 });
  });

  it('keeps last good data when a background refetch errors', () => {
    const t = aggregateStepStats([{ ...ok('PASS', 'FAIL'), isError: true }]);
    expect(t).toMatchObject({ cases: 1, passed: 1, failed: 1, unavailable: 0 });
  });

  it('ignores pending results without flagging them unavailable', () => {
    const t = aggregateStepStats([ok('PASS'), { isPending: true, isError: false }]);
    expect(t).toMatchObject({ cases: 1, unavailable: 0 });
  });

  it('treats IN_PROGRESS and unknown statuses as not run', () => {
    const t = aggregateStepStats([ok('IN_PROGRESS', 'weird')]);
    expect(t).toMatchObject({ notRun: 2, executed: 0 });
  });

  it('counts a zero-step case', () => {
    const t = aggregateStepStats([ok(), ok('PASS')]);
    expect(t).toMatchObject({ cases: 2, total: 1, minPerCase: 0, maxPerCase: 1 });
  });
});
