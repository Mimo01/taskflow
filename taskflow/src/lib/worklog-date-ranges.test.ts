import { describe, expect, it } from 'vitest';
import {
  getLast7DaysRange,
  getLastMonthToDateRange,
  getThisMonthRange,
  getThisWeekRange,
  normalizeDatePreset,
} from './worklog-date-ranges';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 10);

describe('getLast7DaysRange', () => {
  it('returns today-6..today', () => {
    expect(getLast7DaysRange(d(2026, 9, 29))).toEqual({ from: '2026-09-23', to: '2026-09-29' });
  });
  it('wraps across month', () => {
    expect(getLast7DaysRange(d(2026, 3, 3))).toEqual({ from: '2026-02-25', to: '2026-03-03' });
  });
  it('is correct on EU DST day', () => {
    expect(getLast7DaysRange(d(2026, 3, 29))).toEqual({ from: '2026-03-23', to: '2026-03-29' });
  });
});

describe('getLastMonthToDateRange', () => {
  it.each([
    [d(2026, 9, 29), '2026-08-29', '2026-09-29'],
    [d(2026, 3, 31), '2026-02-28', '2026-03-31'],
    [d(2028, 3, 31), '2028-02-29', '2028-03-31'],
    [d(2026, 1, 15), '2025-12-15', '2026-01-15'],
    [d(2026, 5, 31), '2026-04-30', '2026-05-31'],
    [d(2026, 3, 3), '2026-02-03', '2026-03-03'],
  ])('%s', (today, from, to) => {
    expect(getLastMonthToDateRange(today)).toEqual({ from, to });
  });
});

describe('getThisWeekRange', () => {
  it('Wednesday -> Mon..Sun', () => {
    expect(getThisWeekRange(d(2026, 9, 30))).toEqual({ from: '2026-09-28', to: '2026-10-04' });
  });
  it('Sunday -> preceding Monday..that Sunday', () => {
    expect(getThisWeekRange(d(2026, 10, 4))).toEqual({ from: '2026-09-28', to: '2026-10-04' });
  });
});

describe('getThisMonthRange', () => {
  it('first of month..today', () => {
    expect(getThisMonthRange(d(2026, 9, 29))).toEqual({ from: '2026-09-01', to: '2026-09-29' });
  });
});

describe('normalizeDatePreset', () => {
  it.each([
    'this-week',
    'last-7-days',
    'this-month',
    'last-month-to-date',
    'custom',
  ])('passes through %s', (p) => {
    expect(normalizeDatePreset(p)).toBe(p);
  });
  it.each([
    'last-week',
    'last-month',
    'last-working-day',
    undefined,
    'garbage',
  ])('maps %s to this-week', (p) => {
    expect(normalizeDatePreset(p)).toBe('this-week');
  });
});
