import { describe, expect, it } from 'vitest';
import {
  aioTestCaseStatusPillClass,
  aioTestCaseStatusTone,
  aioRunStatusPillClass,
  STATUS_CATEGORY_COLOR,
  statusCategoryColor,
  statusCategoryDotClass,
} from './statusStyles';

describe('STATUS_CATEGORY_COLOR', () => {
  it.each(['new', 'indeterminate', 'done'] as const)('matches the dot class colour for %s', (k) => {
    const m = /^var\(--color-([a-z]+-\d+)\)$/.exec(STATUS_CATEGORY_COLOR[k]);
    expect(m).not.toBeNull();
    expect(statusCategoryDotClass(k)).toBe(`bg-${m?.[1]}`);
  });

  it('falls back to the new colour for unknown categories', () => {
    expect(statusCategoryColor(undefined)).toBe(STATUS_CATEGORY_COLOR.new);
    expect(statusCategoryColor('bogus')).toBe(STATUS_CATEGORY_COLOR.new);
    expect(statusCategoryColor('done')).toBe(STATUS_CATEGORY_COLOR.done);
  });
});

describe('aioRunStatusPillClass', () => {
  it('colours IN_PROGRESS blue', () => {
    expect(aioRunStatusPillClass('IN_PROGRESS')).toContain('text-blue-600');
  });
});

describe('aioTestCaseStatusTone', () => {
  it.each([
    ['Published', 'green'],
    ['Approved', 'green'],
    ['In Review', 'amber'],
    ['Draft', 'blue'],
    ['Deprecated', 'orange'],
    ['Archived', 'muted'],
    [undefined, 'muted'],
  ])('%s → %s', (name, tone) => {
    expect(aioTestCaseStatusTone(name)).toBe(tone);
  });

  it('pill class includes layout + tone colour', () => {
    expect(aioTestCaseStatusPillClass('Published')).toContain('bg-green-500/15');
    expect(aioTestCaseStatusPillClass('Published')).toContain('min-w-[5.5rem]');
  });
});
