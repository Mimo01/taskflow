import { describe, expect, it } from 'vitest';
import { STATUS_CATEGORY_COLOR, statusCategoryColor, statusCategoryDotClass } from './statusStyles';

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
