import { describe, expect, it } from 'vitest';
import { isDoneStatus, OVERRUN_RED_RATIO } from './time-progress';

describe('OVERRUN_RED_RATIO', () => {
  it('is 125%', () => {
    expect(OVERRUN_RED_RATIO).toBe(1.25);
  });
});

describe('isDoneStatus', () => {
  it('is true only for done', () => {
    expect(isDoneStatus('done')).toBe(true);
    expect(isDoneStatus('indeterminate')).toBe(false);
    expect(isDoneStatus(undefined)).toBe(false);
  });
});
