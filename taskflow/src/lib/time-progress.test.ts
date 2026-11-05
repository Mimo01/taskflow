import { describe, expect, it } from 'vitest';
import { healthClass } from './time-progress';

describe('healthClass', () => {
  it('has no colour without an estimate', () => {
    expect(healthClass(100, 0, false)).toBeUndefined();
  });
  it('is green well under estimate, amber from 75%', () => {
    expect(healthClass(50, 100, false)).toBe('bg-green-500');
    expect(healthClass(75, 100, false)).toBe('bg-amber-500');
  });
  it('is green when done at or under estimate', () => {
    expect(healthClass(100, 100, true)).toBe('bg-green-500');
    expect(healthClass(90, 100, true)).toBe('bg-green-500');
  });
  it('is amber over estimate and red past 125%', () => {
    expect(healthClass(110, 100, true)).toBe('bg-amber-500');
    expect(healthClass(125, 100, false)).toBe('bg-amber-500');
    expect(healthClass(126, 100, false)).toBe('bg-red-500');
  });
});
