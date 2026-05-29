import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatTimeAgo, formatTimeAgoStrict } from './formatTimeAgo';

const NOW = new Date('2026-05-29T12:00:00Z').getTime();

describe('formatTimeAgoStrict', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns Ns for diffs < 60 seconds', () => {
    expect(formatTimeAgoStrict(NOW - 30_000)).toBe('30s');
  });

  it('returns Nm for diffs < 1 hour', () => {
    expect(formatTimeAgoStrict(NOW - 90_000)).toBe('1m');
  });

  it('returns Nh for diffs < 1 day', () => {
    expect(formatTimeAgoStrict(NOW - 3_900_000)).toBe('1h');
  });

  it('returns Nd for diffs >= 1 day', () => {
    expect(formatTimeAgoStrict(NOW - 90_000_000)).toBe('1d');
  });

  it('returns 0s on the boundary (Date.now())', () => {
    expect(formatTimeAgoStrict(NOW)).toBe('0s');
  });

  it('clamps future timestamps to 0s', () => {
    expect(formatTimeAgoStrict(NOW + 60_000)).toBe('0s');
  });

  it('handles 90 days', () => {
    expect(formatTimeAgoStrict(NOW - 90 * 86_400_000)).toBe('90d');
  });

  it('does not throw on boundary inputs (0, Date.now() - 1)', () => {
    expect(() => formatTimeAgoStrict(0)).not.toThrow();
    expect(() => formatTimeAgoStrict(NOW - 1)).not.toThrow();
  });
});

describe('formatTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a non-empty string for day-scale diffs containing "day" or "yesterday"', () => {
    const out = formatTimeAgo(NOW - 90_000_000);
    expect(out).toBeTruthy();
    expect(out.toLowerCase()).toMatch(/day|yesterday/);
  });

  it('returns a non-empty string for hour-scale diffs containing "hour"', () => {
    const out = formatTimeAgo(NOW - 3_900_000);
    expect(out).toBeTruthy();
    expect(out.toLowerCase()).toMatch(/hour/);
  });

  it('returns a non-empty string for minute-scale diffs containing "minute"', () => {
    const out = formatTimeAgo(NOW - 90_000);
    expect(out).toBeTruthy();
    expect(out.toLowerCase()).toMatch(/minute/);
  });

  it('returns "now" for future timestamps (clamp)', () => {
    expect(formatTimeAgo(NOW + 60_000).toLowerCase()).toContain('now');
  });

  it('returns "now" at exactly Date.now()', () => {
    expect(formatTimeAgo(NOW).toLowerCase()).toContain('now');
  });

  it('does not throw on boundary inputs', () => {
    expect(() => formatTimeAgo(0)).not.toThrow();
    expect(() => formatTimeAgo(NOW - 1)).not.toThrow();
  });
});
