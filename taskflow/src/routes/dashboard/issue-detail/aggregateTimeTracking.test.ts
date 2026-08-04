import { describe, expect, it } from 'vitest';
import { aggregateTimeTracking } from './aggregateTimeTracking';

describe('aggregateTimeTracking', () => {
  it('returns only own seconds for a subtask issue, ignoring the subtasks argument', () => {
    const own = { timeSpentSeconds: 100, originalEstimateSeconds: 200 };
    const subtasks = [
      { fields: { timetracking: { timeSpentSeconds: 999, originalEstimateSeconds: 999 } } },
    ];

    const result = aggregateTimeTracking(own, subtasks, { isSubtask: true });

    expect(result).toEqual({ spentSeconds: 100, estimateSeconds: 200 });
  });

  it('sums own + all subtasks for a story/task issue', () => {
    const own = { timeSpentSeconds: 100, originalEstimateSeconds: 200 };
    const subtasks = [
      { fields: { timetracking: { timeSpentSeconds: 50, originalEstimateSeconds: 100 } } },
      { fields: { timetracking: { timeSpentSeconds: 25, originalEstimateSeconds: 75 } } },
    ];

    const result = aggregateTimeTracking(own, subtasks, { isSubtask: false });

    expect(result).toEqual({ spentSeconds: 175, estimateSeconds: 375 });
  });

  it('treats missing timetracking on the issue or any subtask as 0, never NaN', () => {
    const subtasks = [{ fields: {} }, { fields: { timetracking: { timeSpentSeconds: 10 } } }];

    const result = aggregateTimeTracking(undefined, subtasks, { isSubtask: false });

    expect(result).toEqual({ spentSeconds: 10, estimateSeconds: 0 });
    expect(Number.isNaN(result.spentSeconds)).toBe(false);
    expect(Number.isNaN(result.estimateSeconds)).toBe(false);
  });

  it('returns own values only when subtasks is undefined (enrichment still pending)', () => {
    const own = { timeSpentSeconds: 60, originalEstimateSeconds: 120 };

    const result = aggregateTimeTracking(own, undefined, { isSubtask: false });

    expect(result).toEqual({ spentSeconds: 60, estimateSeconds: 120 });
  });

  it('returns zeros when both issue and subtasks are missing timetracking', () => {
    const result = aggregateTimeTracking(undefined, undefined, { isSubtask: false });

    expect(result).toEqual({ spentSeconds: 0, estimateSeconds: 0 });
  });

  it('falls back to remainingEstimateSeconds per-subtask when originalEstimateSeconds is absent', () => {
    const own = { timeSpentSeconds: 0, originalEstimateSeconds: 0 };
    const subtasks = [
      { fields: { timetracking: { timeSpentSeconds: 10, remainingEstimateSeconds: 3600 } } },
      { fields: { timetracking: { timeSpentSeconds: 20, remainingEstimateSeconds: 7200 } } },
    ];

    const result = aggregateTimeTracking(own, subtasks, { isSubtask: false });

    expect(result).toEqual({ spentSeconds: 30, estimateSeconds: 10800 });
  });

  it('prefers originalEstimateSeconds over remainingEstimateSeconds per-subtask when both are set', () => {
    const own = { timeSpentSeconds: 0, originalEstimateSeconds: 0 };
    const subtasks = [
      {
        fields: {
          timetracking: {
            timeSpentSeconds: 0,
            originalEstimateSeconds: 1000,
            remainingEstimateSeconds: 500,
          },
        },
      },
    ];

    const result = aggregateTimeTracking(own, subtasks, { isSubtask: false });

    expect(result.estimateSeconds).toBe(1000);
  });

  it('falls back to remainingEstimateSeconds on the own value when originalEstimateSeconds is absent', () => {
    const own = { timeSpentSeconds: 0, remainingEstimateSeconds: 4500 };

    const result = aggregateTimeTracking(own, undefined, { isSubtask: false });

    expect(result.estimateSeconds).toBe(4500);
  });

  it('contributes 0 estimate for a subtask with neither originalEstimateSeconds nor remainingEstimateSeconds set', () => {
    const own = { timeSpentSeconds: 0, originalEstimateSeconds: 0 };
    const subtasks = [{ fields: { timetracking: { timeSpentSeconds: 5 } } }];

    const result = aggregateTimeTracking(own, subtasks, { isSubtask: false });

    expect(result).toEqual({ spentSeconds: 5, estimateSeconds: 0 });
  });
});
