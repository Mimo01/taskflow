import { describe, expect, it } from 'vitest';

import { doneSummaryClass, isDoneStatus, issueTypeStripeClass } from './issueDisplayUtils';

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

describe('issueTypeStripeClass', () => {
  const BUG = 'border-l-red-500 dark:border-l-red-400';
  const STORY = 'border-l-green-600 dark:border-l-green-400';
  const BLUE = 'border-l-blue-500 dark:border-l-blue-400';
  const EPIC = 'border-l-purple-500 dark:border-l-purple-400';

  it('returns red for "Bug"', () => {
    expect(issueTypeStripeClass({ name: 'Bug' })).toBe(BUG);
  });

  it('returns green for "Story"', () => {
    expect(issueTypeStripeClass({ name: 'Story' })).toBe(STORY);
  });

  it('returns blue for "Subtask"', () => {
    expect(issueTypeStripeClass({ name: 'Subtask' })).toBe(BLUE);
  });

  it('returns blue for "Sub-task"', () => {
    expect(issueTypeStripeClass({ name: 'Sub-task' })).toBe(BLUE);
  });

  it('returns purple for "Epic"', () => {
    expect(issueTypeStripeClass({ name: 'Epic' })).toBe(EPIC);
  });

  it('returns blue (default) for "Task"', () => {
    expect(issueTypeStripeClass({ name: 'Task' })).toBe(BLUE);
  });

  it('returns blue (default) for an unknown type name', () => {
    expect(issueTypeStripeClass({ name: 'Spike' })).toBe(BLUE);
  });

  it('returns blue (default) for null', () => {
    expect(issueTypeStripeClass(null)).toBe(BLUE);
  });

  it('returns blue (default) for undefined', () => {
    expect(issueTypeStripeClass(undefined)).toBe(BLUE);
  });

  it('uses the subtask flag over the name — { name: "Bug", subtask: true } → blue', () => {
    expect(issueTypeStripeClass({ name: 'Bug', subtask: true })).toBe(BLUE);
  });

  it('uses the subtask flag for a renamed subtask type — { name: "Custom", subtask: true } → blue', () => {
    expect(issueTypeStripeClass({ name: 'Custom', subtask: true })).toBe(BLUE);
  });
});
