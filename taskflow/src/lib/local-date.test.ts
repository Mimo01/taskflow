import { describe, expect, it } from 'vitest';
import { parseLocalDate, toLocalDateString } from './local-date';

describe('parseLocalDate', () => {
  it('parses a YYYY-MM-DD string into a Date with matching local calendar components', () => {
    const d = parseLocalDate('2026-09-22');
    expect(d).toBeInstanceOf(Date);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(8);
    expect(d?.getDate()).toBe(22);
  });

  it.each([
    ['', 'empty string'],
    [null, 'null'],
    [undefined, 'undefined'],
    ['nonsense', 'nonsense'],
    ['2026-9-2', 'unpadded digits'],
  ] as const)('returns undefined for %s (%s)', (input, _label) => {
    expect(parseLocalDate(input)).toBeUndefined();
  });
});

describe('toLocalDateString', () => {
  it('round-trips through parseLocalDate', () => {
    const d = parseLocalDate('2026-09-22');
    expect(d).toBeDefined();
    if (d) {
      expect(toLocalDateString(d)).toBe('2026-09-22');
    }
  });

  it('pads single-digit month/day', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
