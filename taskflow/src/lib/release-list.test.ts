import { describe, expect, it } from 'vitest';
import type { RmWeek } from '@/lib/deployment-package';
import type { JiraFixVersion } from '@/services/jira';
import {
  breakdownTotal,
  daysBetweenKeys,
  derivePackage,
  groupReleases,
  releaseTooltipRows,
} from './release-list';

describe('daysBetweenKeys', () => {
  it('is DST-free', () => {
    expect(daysBetweenKeys('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetweenKeys('2026-10-24', '2026-10-26')).toBe(2);
  });
});

const v = (id: string, released: boolean, releaseDate?: string): JiraFixVersion => ({
  id,
  name: id,
  released,
  releaseDate,
});

describe('groupReleases', () => {
  it('orders upcoming undated first then date desc; released desc; no mutation', () => {
    const input = [
      v('r-jan', true, '2026-01-01'),
      v('u-dec', false, '2026-12-01'),
      v('A', false),
      v('u-nov', false, '2026-11-01'),
      v('r-jun', true, '2026-06-01'),
      v('B', false),
    ];
    const before = input.map((x) => x.id);
    const { upcoming, released } = groupReleases(input);
    expect(upcoming.map((x) => x.id)).toEqual(['A', 'B', 'u-dec', 'u-nov']);
    expect(released.map((x) => x.id)).toEqual(['r-jun', 'r-jan']);
    expect(input.map((x) => x.id)).toEqual(before);
  });
});

describe('release tooltip / total', () => {
  it('rows in order', () => {
    const rows = releaseTooltipRows({ done: 3, indeterminate: 2, new: 5 });
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ['Done', 3],
      ['In Progress', 2],
      ['To Do', 5],
    ]);
    expect(breakdownTotal({ done: 3, indeterminate: 2, new: 5 })).toBe(10);
  });
});

describe('derivePackage', () => {
  const week: RmWeek = {
    key: 'RM-1',
    summary: 'WEEK43 (19.10.2026 - 25.10.2026)',
    weekNo: 43,
    start: '2026-10-19',
    end: '2026-10-25',
    children: [{ key: 'RM-11', summary: 'Core deployment' }],
  };
  it('null without a date or outside weeks', () => {
    expect(derivePackage([week], undefined, 'Core', 'CORE')).toBeNull();
    expect(derivePackage([week], '2026-12-01', 'Core', 'CORE')).toBeNull();
  });
  it('week with matching child', () => {
    expect(derivePackage([week], '2026-10-20', 'Core', 'CORE')).toEqual({
      week,
      child: week.children[0],
    });
  });
  it('week without child when no project name or no match', () => {
    expect(derivePackage([week], '2026-10-20', null, null)).toEqual({ week, child: null });
    expect(derivePackage([week], '2026-10-20', 'Other', 'OTH')?.child).toBeNull();
  });
});
