import { describe, expect, it } from 'vitest';
import { compareDefectPriority, priorityRank } from './aio-defect-sort';

describe('priorityRank', () => {
  it('orders the custom scheme Blocker < Must < Critical < Highest < Should < High < Medium < Low < Lowest < Minor', () => {
    const names = [
      'Blocker',
      'Must',
      'Critical',
      'Highest',
      'Should',
      'High',
      'Medium',
      'Low',
      'Lowest',
      'Minor',
    ];
    const ranks = names.map((name) => priorityRank({ name }));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(new Set(ranks).size).toBe(names.length);
  });

  it('keeps High < Medium < Low', () => {
    expect(compareDefectPriority({ name: 'High' }, { name: 'Medium' })).toBeLessThan(0);
    expect(compareDefectPriority({ name: 'Medium' }, { name: 'Low' })).toBeLessThan(0);
  });

  it('ranks unknown names after all known names, by numeric id', () => {
    const known = priorityRank({ name: 'Minor' });
    expect(priorityRank({ name: 'Whatever', id: '2' })).toBeGreaterThan(known);
    expect(priorityRank({ name: 'Whatever', id: '2' })).toBeLessThan(
      priorityRank({ name: 'Other', id: '7' }),
    );
    expect(priorityRank({ name: 'NoId' })).toBeGreaterThan(priorityRank({ name: 'X', id: '7' }));
  });

  it('ranks a null/undefined priority last', () => {
    expect(priorityRank(null)).toBeGreaterThan(priorityRank({ name: 'NoId' }));
    expect(priorityRank(undefined)).toBe(priorityRank(null));
  });
});
