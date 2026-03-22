import { describe, expect, it } from 'vitest';
import { formatDuration, parseDuration } from './duration';

describe('parseDuration', () => {
  it('parses hours and minutes', () => {
    const result = parseDuration('2h 30m');
    expect(result).toEqual({ seconds: 9000, display: '2h 30m' });
  });

  it('parses single day (1d = 8h)', () => {
    const result = parseDuration('1d');
    expect(result).toEqual({ seconds: 28800, display: '8h' });
  });

  it('parses minutes only', () => {
    const result = parseDuration('45m');
    expect(result).toEqual({ seconds: 2700, display: '45m' });
  });

  it('parses weeks (1w = 40h)', () => {
    const result = parseDuration('1w');
    expect(result).toEqual({ seconds: 144000, display: '40h' });
  });

  it('parses compound day + hours (1d 4h = 12h)', () => {
    const result = parseDuration('1d 4h');
    expect(result).toEqual({ seconds: 43200, display: '12h' });
  });

  it('returns null for empty string', () => {
    expect(parseDuration('')).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(parseDuration('abc')).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(parseDuration('   ')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(9000)).toBe('2h 30m');
  });

  it('formats exact hours', () => {
    expect(formatDuration(3600)).toBe('1h');
  });

  it('formats minutes only', () => {
    expect(formatDuration(2700)).toBe('45m');
  });

  it('formats zero as 0m', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats negative as 0m', () => {
    expect(formatDuration(-100)).toBe('0m');
  });
});
