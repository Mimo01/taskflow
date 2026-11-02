import { describe, expect, it } from 'vitest';
import { compareNullsLast, nextSort } from './table-sort';

describe('nextSort', () => {
  it('starts a new column ascending', () => {
    expect(nextSort<'a' | 'b'>({ key: null, dir: 'asc' }, 'a')).toEqual({ key: 'a', dir: 'asc' });
  });

  it('cycles asc -> desc -> off on the same column', () => {
    expect(nextSort({ key: 'a', dir: 'asc' }, 'a')).toEqual({ key: 'a', dir: 'desc' });
    expect(nextSort({ key: 'a', dir: 'desc' }, 'a')).toEqual({ key: null, dir: 'asc' });
  });

  it('switching column resets to asc', () => {
    expect(nextSort<'a' | 'b'>({ key: 'a', dir: 'desc' }, 'b')).toEqual({ key: 'b', dir: 'asc' });
  });
});

describe('compareNullsLast', () => {
  it('keeps nulls last in both directions', () => {
    expect(compareNullsLast(null, 'x', 'asc')).toBeGreaterThan(0);
    expect(compareNullsLast(null, 'x', 'desc')).toBeGreaterThan(0);
    expect(compareNullsLast('x', null, 'asc')).toBeLessThan(0);
    expect(compareNullsLast('x', null, 'desc')).toBeLessThan(0);
    expect(compareNullsLast(null, null, 'asc')).toBe(0);
  });

  it('subtracts numbers', () => {
    expect(compareNullsLast(2, 10, 'asc')).toBeLessThan(0);
    expect(compareNullsLast(2, 10, 'desc')).toBeGreaterThan(0);
  });

  it('compares strings numerically', () => {
    expect(compareNullsLast('PROJ-9', 'PROJ-10', 'asc')).toBeLessThan(0);
    expect(compareNullsLast('PROJ-9', 'PROJ-10', 'desc')).toBeGreaterThan(0);
  });
});
