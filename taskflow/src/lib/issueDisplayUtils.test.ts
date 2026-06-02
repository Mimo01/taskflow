import { describe, expect, it } from 'vitest';

import { doneSummaryClass, isDoneStatus, priorityStripeClass } from './issueDisplayUtils';

describe('isDoneStatus', () => {
  it('returns true for statusCategory with key === "done"', () => {
    expect(isDoneStatus({ key: 'done' })).toBe(true);
  });

  it('returns false for statusCategory with key === "indeterminate"', () => {
    expect(isDoneStatus({ key: 'indeterminate' })).toBe(false);
  });

  it('returns false for statusCategory with key === "new"', () => {
    expect(isDoneStatus({ key: 'new' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isDoneStatus(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isDoneStatus(undefined)).toBe(false);
  });
});

describe('doneSummaryClass', () => {
  it('returns "line-through" for done status', () => {
    expect(doneSummaryClass({ key: 'done' })).toBe('line-through');
  });

  it('returns "" for indeterminate status', () => {
    expect(doneSummaryClass({ key: 'indeterminate' })).toBe('');
  });

  it('returns "" for null', () => {
    expect(doneSummaryClass(null)).toBe('');
  });

  it('returns "" for undefined', () => {
    expect(doneSummaryClass(undefined)).toBe('');
  });
});

describe('priorityStripeClass', () => {
  it('returns correct class for "Highest"', () => {
    expect(priorityStripeClass('Highest')).toBe('border-l-red-600 dark:border-l-red-400');
  });

  it('returns correct class for "High"', () => {
    expect(priorityStripeClass('High')).toBe('border-l-orange-600 dark:border-l-orange-400');
  });

  it('returns correct WCAG-verified class for "Medium" (yellow-700 light, NOT yellow-500)', () => {
    expect(priorityStripeClass('Medium')).toBe('border-l-yellow-700 dark:border-l-yellow-500');
  });

  it('returns correct class for "Low"', () => {
    expect(priorityStripeClass('Low')).toBe('border-l-gray-500 dark:border-l-gray-400');
  });

  it('returns correct class for "Lowest"', () => {
    expect(priorityStripeClass('Lowest')).toBe('border-l-gray-600 dark:border-l-gray-300');
  });

  it('returns default class for null', () => {
    expect(priorityStripeClass(null)).toBe('border-l-gray-600 dark:border-l-gray-300');
  });

  it('returns default class for undefined', () => {
    expect(priorityStripeClass(undefined)).toBe('border-l-gray-600 dark:border-l-gray-300');
  });

  it('returns default class for unknown priority name (e.g. "Critical")', () => {
    expect(priorityStripeClass('Critical')).toBe('border-l-gray-600 dark:border-l-gray-300');
  });
});
