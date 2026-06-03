import { describe, expect, it } from 'vitest';

import {
  doneSummaryClass,
  isDoneStatus,
  prioritySeverityFromIcon,
  priorityStripeClass,
} from './issueDisplayUtils';

const RED = 'border-l-red-600 dark:border-l-red-400';
const ORANGE = 'border-l-orange-600 dark:border-l-orange-400';
const YELLOW = 'border-l-yellow-700 dark:border-l-yellow-500';
const GRAY_500 = 'border-l-gray-500 dark:border-l-gray-400';
const GRAY_600 = 'border-l-gray-600 dark:border-l-gray-300';
const icon = (token: string) => `https://jira.example.invalid/images/icons/priorities/${token}.svg`;

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

  it('returns default class for unknown priority name (e.g. "Critical") via the name-only path', () => {
    expect(priorityStripeClass('Critical')).toBe('border-l-gray-600 dark:border-l-gray-300');
  });
});

describe('prioritySeverityFromIcon', () => {
  it('extracts the severity token from a priority icon URL', () => {
    expect(prioritySeverityFromIcon(icon('major'))).toBe('major');
    expect(prioritySeverityFromIcon(icon('highest'))).toBe('highest');
    expect(prioritySeverityFromIcon(icon('medium'))).toBe('medium');
  });

  it('ignores query strings and is case-insensitive', () => {
    expect(prioritySeverityFromIcon(`${icon('major')}?v=2`)).toBe('major');
    expect(prioritySeverityFromIcon(icon('HIGH'))).toBe('high');
  });

  it('returns "" for unknown filenames, empty, null, or undefined', () => {
    expect(prioritySeverityFromIcon(icon('sombrero'))).toBe('');
    expect(prioritySeverityFromIcon('')).toBe('');
    expect(prioritySeverityFromIcon(null)).toBe('');
    expect(prioritySeverityFromIcon(undefined)).toBe('');
  });
});

describe('priorityStripeClass — icon-severity mapping (custom priority schemes)', () => {
  // Real custom scheme observed in the GreenHopper capture: names diverge from the
  // standard five, but the icon filename still encodes severity.
  it('maps a renamed top priority by icon, not name — "Must" (major.svg) → red', () => {
    expect(priorityStripeClass({ name: 'Must', iconUrl: icon('major') })).toBe(RED);
  });

  it('maps "Should"/"Critical" (highest.svg) → red', () => {
    expect(priorityStripeClass({ name: 'Should', iconUrl: icon('highest') })).toBe(RED);
    expect(priorityStripeClass({ name: 'Critical', iconUrl: icon('highest') })).toBe(RED);
  });

  it('keeps "High" (high.svg) → orange, below the red top tier', () => {
    expect(priorityStripeClass({ name: 'High', iconUrl: icon('high') })).toBe(ORANGE);
  });

  it('maps "Needed"/"Medium" (medium.svg) → yellow', () => {
    expect(priorityStripeClass({ name: 'Needed', iconUrl: icon('medium') })).toBe(YELLOW);
    expect(priorityStripeClass({ name: 'Medium', iconUrl: icon('medium') })).toBe(YELLOW);
  });

  it('maps low-severity icons → gray (low → gray-500, lowest/trivial → gray-600)', () => {
    expect(priorityStripeClass({ name: 'Low', iconUrl: icon('low') })).toBe(GRAY_500);
    expect(priorityStripeClass({ name: 'Whenever', iconUrl: icon('trivial') })).toBe(GRAY_600);
  });

  it('falls back to the standard-name palette when the icon token is unknown', () => {
    expect(priorityStripeClass({ name: 'High', iconUrl: icon('sombrero') })).toBe(ORANGE);
    expect(priorityStripeClass({ name: 'Medium', iconUrl: undefined })).toBe(YELLOW);
  });

  it('falls back to the neutral default when neither icon nor name resolves', () => {
    expect(priorityStripeClass({ name: 'Bespoke', iconUrl: undefined })).toBe(GRAY_600);
    expect(priorityStripeClass({})).toBe(GRAY_600);
  });
});
