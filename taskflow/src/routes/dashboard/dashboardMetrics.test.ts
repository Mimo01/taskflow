/**
 * dashboardMetrics.test.ts — Phase 83 DASH-02/03
 *
 * Unit tests for pure derivation functions in dashboardMetrics.ts.
 * MANDATED test (criterion-2 gate): parent(5 SP) + 2 subtasks(2 SP each) ⇒ 5, not 9.
 */
import { describe, expect, it } from 'vitest';

import {
  computeDonutData,
  computePersonalTileCounts,
  computeSpDone,
  computeSpTotal,
  filterNonSubtasks,
  getDaysRemaining,
} from './dashboardMetrics';
import type { JiraIssue } from '@/services/jira';

const SP_KEY = 'customfield_10016';

/**
 * Minimal JiraIssue factory — adapted from my-tasks-sort.test.ts pattern.
 */
function makeIssue(overrides: {
  subtask: boolean;
  sp: number;
  statusCategory: 'new' | 'indeterminate' | 'done';
  assignee?: string | null;
  duedate?: string | null;
}): JiraIssue {
  return {
    id: '1',
    key: 'TEST-1',
    fields: {
      summary: 'Test issue',
      status: {
        id: '1',
        name: 'Status',
        statusCategory: { key: overrides.statusCategory },
      },
      assignee:
        overrides.assignee === undefined
          ? null
          : overrides.assignee === null
            ? null
            : {
                displayName: overrides.assignee,
                accountId: 'acc-1',
                emailAddress: '',
                avatarUrl: '',
              },
      issuetype: {
        id: '10001',
        name: overrides.subtask ? 'Sub-task' : 'Story',
        subtask: overrides.subtask,
      },
      duedate: overrides.duedate ?? null,
      [SP_KEY]: overrides.sp,
    },
  } as unknown as JiraIssue;
}

// ---------------------------------------------------------------------------
// MANDATED criterion-2 gate — FIRST test in file
// ---------------------------------------------------------------------------

describe('computeSpDone — subtask exclusion (DASH-02, criterion 2)', () => {
  it('excludes subtask SPs: parent(5) + sub(2) + sub(2) = 5, not 9', () => {
    const parent = makeIssue({ subtask: false, sp: 5, statusCategory: 'done' });
    const sub1 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done' });
    const sub2 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done' });
    expect(computeSpDone([parent, sub1, sub2], SP_KEY)).toBe(5);
  });

  it('returns 0 when no done non-subtask issues', () => {
    const sub = makeIssue({ subtask: true, sp: 10, statusCategory: 'done' });
    expect(computeSpDone([sub], SP_KEY)).toBe(0);
  });

  it('sums only done non-subtask SPs', () => {
    const done = makeIssue({ subtask: false, sp: 3, statusCategory: 'done' });
    const inprog = makeIssue({ subtask: false, sp: 5, statusCategory: 'indeterminate' });
    expect(computeSpDone([done, inprog], SP_KEY)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// computeSpTotal
// ---------------------------------------------------------------------------

describe('computeSpTotal', () => {
  it('total SP excludes subtasks', () => {
    const parent = makeIssue({ subtask: false, sp: 5, statusCategory: 'new' });
    const sub = makeIssue({ subtask: true, sp: 2, statusCategory: 'new' });
    expect(computeSpTotal([parent, sub], SP_KEY)).toBe(5);
  });

  it('sums all non-subtask SPs regardless of status', () => {
    const a = makeIssue({ subtask: false, sp: 3, statusCategory: 'done' });
    const b = makeIssue({ subtask: false, sp: 4, statusCategory: 'indeterminate' });
    const c = makeIssue({ subtask: false, sp: 2, statusCategory: 'new' });
    expect(computeSpTotal([a, b, c], SP_KEY)).toBe(9);
  });

  it('returns 0 for empty array', () => {
    expect(computeSpTotal([], SP_KEY)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// filterNonSubtasks
// ---------------------------------------------------------------------------

describe('filterNonSubtasks', () => {
  it('drops every issue where issuetype.subtask is true', () => {
    const parent = makeIssue({ subtask: false, sp: 5, statusCategory: 'new' });
    const sub = makeIssue({ subtask: true, sp: 2, statusCategory: 'new' });
    expect(filterNonSubtasks([parent, sub])).toHaveLength(1);
    expect(filterNonSubtasks([parent, sub])[0]).toBe(parent);
  });
});

// ---------------------------------------------------------------------------
// computePersonalTileCounts
// ---------------------------------------------------------------------------

describe('computePersonalTileCounts', () => {
  const TODAY = '2026-06-15';
  const ME = 'Alice';
  const OTHER = 'Bob';

  it('counts open: my non-done non-subtask issues', () => {
    const myOpen = makeIssue({ subtask: false, sp: 0, statusCategory: 'new', assignee: ME });
    const myDone = makeIssue({ subtask: false, sp: 0, statusCategory: 'done', assignee: ME });
    const otherOpen = makeIssue({ subtask: false, sp: 0, statusCategory: 'new', assignee: OTHER });
    const { open } = computePersonalTileCounts([myOpen, myDone, otherOpen], ME, TODAY);
    expect(open).toBe(1);
  });

  it('counts inProgress: my non-subtask issues with statusCategory indeterminate', () => {
    const myInprog = makeIssue({
      subtask: false,
      sp: 0,
      statusCategory: 'indeterminate',
      assignee: ME,
    });
    const myNew = makeIssue({ subtask: false, sp: 0, statusCategory: 'new', assignee: ME });
    const { inProgress } = computePersonalTileCounts([myInprog, myNew], ME, TODAY);
    expect(inProgress).toBe(1);
  });

  it('counts overdue: my non-done non-subtask issues with duedate before today', () => {
    const overdue = makeIssue({
      subtask: false,
      sp: 0,
      statusCategory: 'new',
      assignee: ME,
      duedate: '2026-06-14',
    });
    const notOverdue = makeIssue({
      subtask: false,
      sp: 0,
      statusCategory: 'new',
      assignee: ME,
      duedate: '2026-06-16',
    });
    const doneWithPastDue = makeIssue({
      subtask: false,
      sp: 0,
      statusCategory: 'done',
      assignee: ME,
      duedate: '2026-06-01',
    });
    const { overdue: overdueCount } = computePersonalTileCounts(
      [overdue, notOverdue, doneWithPastDue],
      ME,
      TODAY,
    );
    expect(overdueCount).toBe(1);
  });

  it('excludes issues assigned to other users', () => {
    const other = makeIssue({ subtask: false, sp: 0, statusCategory: 'new', assignee: OTHER });
    const counts = computePersonalTileCounts([other], ME, TODAY);
    expect(counts.open).toBe(0);
    expect(counts.inProgress).toBe(0);
    expect(counts.overdue).toBe(0);
  });

  it('excludes subtasks even if assigned to me', () => {
    const mySub = makeIssue({ subtask: true, sp: 0, statusCategory: 'new', assignee: ME });
    const counts = computePersonalTileCounts([mySub], ME, TODAY);
    expect(counts.open).toBe(0);
  });

  it('returns all zeros for empty issue array', () => {
    expect(computePersonalTileCounts([], ME, TODAY)).toEqual({
      open: 0,
      inProgress: 0,
      overdue: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// getDaysRemaining
// ---------------------------------------------------------------------------

describe('getDaysRemaining', () => {
  it('returns null when endDate is undefined', () => {
    expect(getDaysRemaining(undefined)).toBeNull();
  });

  it('returns null for an invalid date string (NaN)', () => {
    expect(getDaysRemaining('not-a-date')).toBeNull();
  });

  it('returns 0 when sprint ends today or earlier (ms <= 0)', () => {
    // A date in the past — should be clamped to 0
    expect(getDaysRemaining('2020-01-01')).toBe(0);
  });

  it('returns a positive integer for a future end date', () => {
    // ~3.5 days from now — Math.ceil gives 4
    const future = new Date(Date.now() + 3.5 * 24 * 60 * 60 * 1000).toISOString();
    const result = getDaysRemaining(future);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeDonutData
// ---------------------------------------------------------------------------

describe('computeDonutData', () => {
  it('returns 3 segments when all statusCategories have SP', () => {
    const todo = makeIssue({ subtask: false, sp: 2, statusCategory: 'new' });
    const inprog = makeIssue({ subtask: false, sp: 3, statusCategory: 'indeterminate' });
    const done = makeIssue({ subtask: false, sp: 5, statusCategory: 'done' });
    const segments = computeDonutData([todo, inprog, done], SP_KEY);
    expect(segments).toHaveLength(3);
    const names = segments.map((s) => s.name);
    expect(names).toContain('todo');
    expect(names).toContain('inProgress');
    expect(names).toContain('done');
  });

  it('excludes zero-SP categories from output', () => {
    const done = makeIssue({ subtask: false, sp: 5, statusCategory: 'done' });
    // No 'new' or 'indeterminate' SP issues
    const segments = computeDonutData([done], SP_KEY);
    expect(segments).toHaveLength(1);
    expect(segments[0].name).toBe('done');
  });

  it('excludes subtask SPs from donut totals', () => {
    const parent = makeIssue({ subtask: false, sp: 4, statusCategory: 'done' });
    const sub = makeIssue({ subtask: true, sp: 10, statusCategory: 'done' });
    const segments = computeDonutData([parent, sub], SP_KEY);
    const doneSeg = segments.find((s) => s.name === 'done');
    expect(doneSeg?.value).toBe(4); // not 14
  });

  it('uses CSS-var fills — no hardcoded hex', () => {
    const issue = makeIssue({ subtask: false, sp: 1, statusCategory: 'new' });
    const segments = computeDonutData([issue], SP_KEY);
    expect(segments[0].fill).toMatch(/^var\(--chart-\d+\)$/);
  });

  it('returns empty array when sprint has no story points', () => {
    expect(computeDonutData([], SP_KEY)).toHaveLength(0);
  });
});
