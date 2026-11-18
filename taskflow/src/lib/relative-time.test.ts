import { describe, expect, it } from 'vitest';
import { exactDateTime, shortRelativeTime } from './relative-time';

describe('exactDateTime', () => {
  it('formats date and time in local locale', () => {
    const iso = '2026-10-30T14:05:09.000+0100';
    expect(exactDateTime(iso)).toBe(
      new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    );
  });

  it('includes a time component', () => {
    const iso = '2026-10-30T14:05:09.000+0100';
    expect(exactDateTime(iso)).not.toBe(new Date(iso).toLocaleDateString());
  });

  it('returns empty string for missing or invalid input', () => {
    expect(exactDateTime(null)).toBe('');
    expect(exactDateTime(undefined)).toBe('');
    expect(exactDateTime('')).toBe('');
    expect(exactDateTime('not-a-date')).toBe('');
  });
});

describe('shortRelativeTime', () => {
  const now = 1_000_000_000_000;
  const MIN = 60_000;
  it('formats compact units', () => {
    expect(shortRelativeTime(now, now)).toBe('just now');
    expect(shortRelativeTime(now - 5 * MIN, now)).toBe('5m ago');
    expect(shortRelativeTime(now - 3 * 60 * MIN, now)).toBe('3h ago');
    expect(shortRelativeTime(now - 2 * 24 * 60 * MIN, now)).toBe('2d ago');
    expect(shortRelativeTime(now - 15 * 24 * 60 * MIN, now)).toBe('2w ago');
  });
});
