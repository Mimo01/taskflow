import { describe, expect, it } from 'vitest';
import { exactDateTime } from './relative-time';

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
