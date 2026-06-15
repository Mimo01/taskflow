/**
 * dashboardMetrics.test.ts — Phase 83 DASH-02/03
 *
 * Unit tests for pure derivation functions in dashboardMetrics.ts.
 * MANDATED test (criterion-2 gate): parent(5 SP) + 2 subtasks(2 SP each) ⇒ 5, not 9.
 */
import { describe, expect, it } from 'vitest';

import {
  buildWeekBuckets,
  computeDonutData,
  computePersonalTileCounts,
  computePersonalVelocitySeries,
  computeSpDone,
  computeSpTotal,
  filterNonSubtasks,
  formatHoursMinutes,
  getDaysRemaining,
  mergeActivityEntries,
  parseBurndownChanges,
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
// Phase 84 — buildWeekBuckets
// ---------------------------------------------------------------------------

describe('Phase 84 — buildWeekBuckets', () => {
  // Criterion 1 mandated unit test — timezone-safe bucketing.
  // fetchWorklogs already normalizes dateStarted to YYYY-MM-DD; this tests the post-normalization path.
  // The pre-normalized raw value would have been '2026-06-14T23:00:00' — which a naive
  // new Date(...).toISOString().slice(0,10) in UTC+1 or later would shift to 2026-06-15.
  it('timezone-safe: dateStarted "2026-06-14" (pre-normalized from "2026-06-14T23:00:00") buckets correctly', () => {
    // weekStart '2026-06-10' = Monday; 2026-06-14 = Friday (index 4, +4 days from Mon).
    // A naive new Date('2026-06-14T23:00:00').toISOString().slice(0,10) in UTC+1 or later
    // would shift to 2026-06-15, causing the Friday bucket to be missed.
    // fetchWorklogs pre-normalizes dateStarted to YYYY-MM-DD; this tests the post-normalization path.
    const worklogs = [
      { dateStarted: '2026-06-14', timeSpentSeconds: 3600 },
    ] as import('@/services/tempo/types').TempoWorklog[];
    const buckets = buildWeekBuckets(worklogs, '2026-06-10'); // Mon 2026-06-10 → Fri 2026-06-14
    const friday = buckets.find((b) => b.day === '2026-06-14');
    expect(friday?.hours).toBe(1); // criterion 1: must be 1, not 0 due to timezone shift
  });

  it('future days this week render as 0-hour buckets (empty array → 5 zero-filled buckets)', () => {
    const buckets = buildWeekBuckets([], '2026-06-10');
    expect(buckets).toHaveLength(5);
    expect(buckets.every((b) => b.hours === 0)).toBe(true);
  });

  it('returns labels Mon–Fri in order', () => {
    const buckets = buildWeekBuckets([], '2026-06-10');
    expect(buckets.map((b) => b.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  });

  it('same-day accumulation: two 3600s worklogs on Mon → hours === 2', () => {
    // weekStart 2026-06-10 = Monday; both worklogs on Mon
    const worklogs = [
      { dateStarted: '2026-06-10', timeSpentSeconds: 3600 },
      { dateStarted: '2026-06-10', timeSpentSeconds: 3600 },
    ] as import('@/services/tempo/types').TempoWorklog[];
    const buckets = buildWeekBuckets(worklogs, '2026-06-10');
    const monday = buckets.find((b) => b.day === '2026-06-10');
    expect(monday?.hours).toBe(2);
  });

  it('ignores worklogs outside Mon–Fri window', () => {
    // 2026-06-08 is Sunday — before the week starting 2026-06-10
    const worklogs = [
      { dateStarted: '2026-06-08', timeSpentSeconds: 7200 },
    ] as import('@/services/tempo/types').TempoWorklog[];
    const buckets = buildWeekBuckets(worklogs, '2026-06-10');
    expect(buckets.every((b) => b.hours === 0)).toBe(true);
  });

  it('fractional hours: 5400s = 1.5h', () => {
    // weekStart 2026-06-10 = Mon; Tue = 2026-06-11
    const worklogs = [
      { dateStarted: '2026-06-11', timeSpentSeconds: 5400 }, // Tuesday
    ] as import('@/services/tempo/types').TempoWorklog[];
    const buckets = buildWeekBuckets(worklogs, '2026-06-10');
    const tuesday = buckets.find((b) => b.day === '2026-06-11');
    expect(tuesday?.hours).toBeCloseTo(1.5);
  });
});

// ---------------------------------------------------------------------------
// Phase 84 — mergeActivityEntries
// ---------------------------------------------------------------------------

function makeJiraItem(overrides: {
  issueKey: string;
  transitionAts: string[];
}): import('@/services/jira').JiraActivityItem {
  return {
    issueKey: overrides.issueKey,
    summary: `Issue ${overrides.issueKey}`,
    transitions: overrides.transitionAts.map((at) => ({
      fromStatus: 'To Do',
      toStatus: 'In Progress',
      at,
    })),
    comments: [],
  } as import('@/services/jira').JiraActivityItem;
}

function makeCommit(overrides: {
  id: string;
  authoredDate: string;
}): import('@/services/gitlab').GitLabCommit {
  return {
    id: overrides.id,
    short_id: overrides.id.slice(0, 8),
    title: `Commit ${overrides.id}`,
    message: `Commit ${overrides.id}`,
    author_name: 'Developer',
    author_email: 'dev@example.com',
    authored_date: overrides.authoredDate,
    web_url: `https://gitlab.example.com/commit/${overrides.id}`,
  } as import('@/services/gitlab').GitLabCommit;
}

describe('Phase 84 — mergeActivityEntries', () => {
  it('newest-first ordering: commit at 12:00 comes before jira at 10:00', () => {
    const jiraItem = makeJiraItem({ issueKey: 'PROJ-1', transitionAts: ['2026-06-14T10:00:00'] });
    const commit = makeCommit({ id: 'abc123', authoredDate: '2026-06-14T12:00:00' });
    const entries = mergeActivityEntries([jiraItem], [commit], 5);
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('commit');
    expect(entries[0].at).toBe('2026-06-14T12:00:00');
    expect(entries[1].type).toBe('jira');
    expect(entries[1].at).toBe('2026-06-14T10:00:00');
  });

  it('multi-transition flatMap: one Jira item with 2 transitions → 2 entries', () => {
    const jiraItem = makeJiraItem({
      issueKey: 'PROJ-2',
      transitionAts: ['2026-06-14T09:00:00', '2026-06-14T11:00:00'],
    });
    const entries = mergeActivityEntries([jiraItem], [], 10);
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.type === 'jira')).toBe(true);
    // Newest first
    expect(entries[0].at).toBe('2026-06-14T11:00:00');
    expect(entries[1].at).toBe('2026-06-14T09:00:00');
  });

  it('cap is respected: 10 inputs with cap 5 → length 5', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeJiraItem({ issueKey: `PROJ-${i}`, transitionAts: [`2026-06-14T0${i}:00:00`] }),
    );
    const commits = Array.from({ length: 5 }, (_, i) =>
      makeCommit({ id: `commit${i}`, authoredDate: `2026-06-14T1${i}:00:00` }),
    );
    const entries = mergeActivityEntries(items, commits, 5);
    expect(entries).toHaveLength(5);
  });

  it('mergeActivityEntries([], [], 5) → []', () => {
    expect(mergeActivityEntries([], [], 5)).toHaveLength(0);
  });

  it('entries with no transitions contribute nothing', () => {
    const jiraItem = makeJiraItem({ issueKey: 'PROJ-3', transitionAts: [] });
    const commit = makeCommit({ id: 'xyz', authoredDate: '2026-06-14T08:00:00' });
    const entries = mergeActivityEntries([jiraItem], [commit], 10);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('commit');
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

// ---------------------------------------------------------------------------
// Phase 85 — computePersonalVelocitySeries (INSIGHT-01)
// ---------------------------------------------------------------------------

describe('computePersonalVelocitySeries', () => {
  const ME = 'Alice';

  it('selects last N sprints from ascending list (tail-first ordering)', () => {
    // Build 10 sprints ascending (ids 1–10). The fetcher (85-02) slices(-6) to get the tail.
    // This test encodes the Probe A guard: the chart must show sprints 5–10, not 1–6.
    const tenSprints = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Sprint ${i + 1}`,
      state: 'closed' as const,
    }));
    // Simulate the 85-02 fetcher's tail selection (the fn itself must NOT reorder)
    const tail = tenSprints.slice(-6);
    const series = computePersonalVelocitySeries(tail, new Map(), ME, SP_KEY);
    expect(series.map((p) => p.sprintName)).toEqual([
      'Sprint 5',
      'Sprint 6',
      'Sprint 7',
      'Sprint 8',
      'Sprint 9',
      'Sprint 10',
    ]);
  });

  it('excludes subtask SP from committed and completed velocity sums (subtask exclusion)', () => {
    // parent(5,done,Alice) + 2 subtasks(2,done,Alice) → committed=5, completed=5 (not 9)
    const parent = makeIssue({ subtask: false, sp: 5, statusCategory: 'done', assignee: ME });
    const sub1 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done', assignee: ME });
    const sub2 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done', assignee: ME });
    const sprint = { id: 1, name: 'Sprint 1', state: 'closed' as const };
    const issueMap = new Map([[1, [parent, sub1, sub2]]]);
    const series = computePersonalVelocitySeries([sprint], issueMap, ME, SP_KEY);
    expect(series[0].committed).toBe(5); // not 9
    expect(series[0].completed).toBe(5); // not 9
  });

  it('excludes other users from personal velocity sums', () => {
    // Alice(8,done) + Bob(10,done) → committed=8, completed=8 (Bob excluded)
    const mine = makeIssue({ subtask: false, sp: 8, statusCategory: 'done', assignee: ME });
    const other = makeIssue({ subtask: false, sp: 10, statusCategory: 'done', assignee: 'Bob' });
    const sprint = { id: 1, name: 'Sprint 1', state: 'closed' as const };
    const issueMap = new Map([[1, [mine, other]]]);
    const series = computePersonalVelocitySeries([sprint], issueMap, ME, SP_KEY);
    expect(series[0].committed).toBe(8); // Bob's 10 SP excluded
    expect(series[0].completed).toBe(8);
  });

  it('qualifying sprints filter: a sprint with 0 committed+completed is not qualifying', () => {
    // 3 sprints: 2 with SP, 1 with sp:0 → only 2 qualifying → below 3-sprint D-06 threshold
    const withSP = makeIssue({ subtask: false, sp: 3, statusCategory: 'done', assignee: ME });
    const noSP = makeIssue({ subtask: false, sp: 0, statusCategory: 'done', assignee: ME });
    const sprints = [
      { id: 1, name: 'Sprint 1', state: 'closed' as const },
      { id: 2, name: 'Sprint 2', state: 'closed' as const },
      { id: 3, name: 'Sprint 3', state: 'closed' as const },
    ];
    const issueMap = new Map([
      [1, [withSP]],
      [2, [withSP]],
      [3, [noSP]],
    ]);
    const series = computePersonalVelocitySeries(sprints, issueMap, ME, SP_KEY);
    const qualifying = series.filter((p) => p.committed > 0 || p.completed > 0);
    expect(qualifying.length).toBe(2); // below 3-sprint threshold → D-06 hide
  });

  it('committed vs completed: committed counts all my issues, completed only done', () => {
    // Alice done(3) + Alice indeterminate(5) → committed=8, completed=3
    const done = makeIssue({ subtask: false, sp: 3, statusCategory: 'done', assignee: ME });
    const inprog = makeIssue({
      subtask: false,
      sp: 5,
      statusCategory: 'indeterminate',
      assignee: ME,
    });
    const sprint = { id: 1, name: 'Sprint 1', state: 'closed' as const };
    const issueMap = new Map([[1, [done, inprog]]]);
    const series = computePersonalVelocitySeries([sprint], issueMap, ME, SP_KEY);
    expect(series[0].committed).toBe(8); // all my issues
    expect(series[0].completed).toBe(3); // only done
  });
});

// ---------------------------------------------------------------------------
// Phase 85 — parseBurndownChanges (INSIGHT-02)
// ---------------------------------------------------------------------------

describe('parseBurndownChanges', () => {
  it('parseBurndownChanges returns ascending-time points anchored at startTime, clamped non-negative', () => {
    const changes = {
      '1000': [{ key: 'PROJ-1', statC: { newValue: 28800, oldValue: 0 }, added: true }],
      '2000': [{ key: 'PROJ-1', statC: { newValue: 0, oldValue: 28800 } }],
    };
    const points = parseBurndownChanges(changes, 500);

    // Anchor at startTime
    expect(points[0].t).toBe(500);
    // Ascending timestamps including anchor
    expect(points.map((p) => p.t)).toEqual([500, 1000, 2000]);
    // All remaining values are non-negative (clamp guard)
    expect(points.every((p) => p.remaining >= 0)).toBe(true);

    // Null/undefined input must not throw — returns the anchor only
    const fallback = parseBurndownChanges(undefined as never, 500);
    expect(fallback).toEqual([{ t: 500, remaining: 0 }]);
  });
});

// ---------------------------------------------------------------------------
// Phase 85 — formatHoursMinutes burndown hours formatter (Probe C: timeestimate unit)
// ---------------------------------------------------------------------------

describe('formatHoursMinutes — burndown hours suffix', () => {
  it('burndown hours formatter emits an h/m suffix, never SP', () => {
    expect(formatHoursMinutes(1.5)).toBe('1h 30m');
    expect(formatHoursMinutes(8)).toBe('8h');
    expect(formatHoursMinutes(0.25)).toBe('15m');
    // Must never contain 'SP' — burndown unit is hours (Probe C: statisticField=timeestimate)
    expect(formatHoursMinutes(8)).not.toMatch(/SP/);
  });
});
