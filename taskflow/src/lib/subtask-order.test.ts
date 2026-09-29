import { describe, expect, it } from 'vitest';
import {
  compareIssueKeysNumeric,
  orderSubtaskKeys,
  orderSubtasks,
  orderSubtasksWithinParents,
} from './subtask-order';

describe('compareIssueKeysNumeric', () => {
  it('sorts X-99 before X-100', () => {
    expect(compareIssueKeysNumeric('X-99', 'X-100')).toBeLessThan(0);
  });
  it('compares prefix first', () => {
    expect(compareIssueKeysNumeric('A-5', 'B-1')).toBeLessThan(0);
  });
  it('is deterministic for non-numeric suffixes', () => {
    const r = compareIssueKeysNumeric('ESHOP-10-S1', 'ESHOP-10-S2');
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBeLessThan(0);
  });
});

describe('orderSubtaskKeys', () => {
  it('sequence wins over numeric', () => {
    expect(orderSubtaskKeys(['X-3', 'X-1', 'X-2'], ['X-2', 'X-3', 'X-1'])).toEqual([
      'X-2',
      'X-3',
      'X-1',
    ]);
  });
  it('unlisted keys follow listed ones numerically', () => {
    expect(orderSubtaskKeys(['X-100', 'X-5', 'X-99', 'X-7'], ['X-7'])).toEqual([
      'X-7',
      'X-5',
      'X-99',
      'X-100',
    ]);
  });
  it('accepts {key} objects and empty/undefined sequences', () => {
    expect(orderSubtaskKeys(['X-2', 'X-1'], [{ key: 'X-2' }, { key: 'X-1' }])).toEqual([
      'X-2',
      'X-1',
    ]);
    expect(orderSubtaskKeys(['X-100', 'X-99'], [])).toEqual(['X-99', 'X-100']);
    expect(orderSubtaskKeys(['X-100', 'X-99'])).toEqual(['X-99', 'X-100']);
  });
  it('does not mutate input', () => {
    const input = ['X-2', 'X-1'];
    orderSubtaskKeys(input);
    expect(input).toEqual(['X-2', 'X-1']);
  });
});

describe('orderSubtasks', () => {
  it('returns a new ordered array', () => {
    const input = [{ key: 'X-3' }, { key: 'X-1' }];
    const out = orderSubtasks(input, ['X-3', 'X-1']);
    expect(out.map((s) => s.key)).toEqual(['X-3', 'X-1']);
    expect(out).not.toBe(input);
    expect(input.map((s) => s.key)).toEqual(['X-3', 'X-1']);
  });
});

describe('orderSubtasksWithinParents', () => {
  it('is group-stable and orders within groups', () => {
    const flat = [
      { key: 's-9', p: 'P2' },
      { key: 's-3', p: 'P1' },
      { key: 's-4', p: 'P2' },
      { key: 's-1', p: 'P1' },
    ];
    const out = orderSubtasksWithinParents(
      flat,
      () => undefined,
      (s) => s.p,
    );
    expect(out.map((s) => s.key)).toEqual(['s-4', 's-9', 's-1', 's-3']);
  });
  it('uses parent sequence and keeps parentless items in slot', () => {
    const flat = [
      { key: 'a-1', p: undefined as string | undefined },
      { key: 's-1', p: 'P1' },
      { key: 's-2', p: 'P1' },
    ];
    const out = orderSubtasksWithinParents(
      flat,
      (pk) => (pk === 'P1' ? ['s-2', 's-1'] : undefined),
      (s) => s.p,
    );
    expect(out.map((s) => s.key)).toEqual(['a-1', 's-2', 's-1']);
  });
});
