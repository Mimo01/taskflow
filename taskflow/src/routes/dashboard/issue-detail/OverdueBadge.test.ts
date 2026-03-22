import { describe, expect, it, vi } from 'vitest';
import { isOverdue } from './OverdueBadge';

describe('isOverdue', () => {
  it('returns true for past date with no status category', () => {
    expect(isOverdue('2024-01-01', undefined)).toBe(true);
  });

  it('returns false for done issues (done category key)', () => {
    expect(isOverdue('2024-01-01', 'done')).toBe(false);
  });

  it('returns false when duedate is null', () => {
    expect(isOverdue(null, undefined)).toBe(false);
  });

  it('returns false for future date', () => {
    expect(isOverdue('2099-12-31', undefined)).toBe(false);
  });

  it('returns true for past date with indeterminate status', () => {
    expect(isOverdue('2024-01-01', 'indeterminate')).toBe(true);
  });

  it('returns true for past date with new status', () => {
    expect(isOverdue('2024-01-01', 'new')).toBe(true);
  });
});
