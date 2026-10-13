import { describe, expect, it } from 'vitest';
import type {
  AioCycleDetailItem,
  AioCycleSummaryItem,
  AioFolder,
  AioTestRunStatusConfig,
} from '@/services/aio/types';
import {
  addDaysKey,
  aggregateCycleScope,
  aggregateFolderCounts,
  buildStatusLookup,
  type CycleFilter,
  cycleFilterLabel,
  cycleProgress,
  filterFolderTree,
  formatCycleDates,
  formatEffort,
  isOverdue,
  matchesCycleFilter,
  progressTooltipRows,
  sortCycles,
  toDateKey,
  weekStartOf,
} from './aio-cycle-list';
import { toLocalDateString } from './local-date';

const folder = (ID: number, name: string, children: AioFolder[] = []): AioFolder => ({
  ID,
  name,
  description: null,
  parentID: null,
  rankOrder: null,
  children,
});

const cycle = (ID: number, key: string, isClosed: boolean): AioCycleDetailItem => ({
  ID,
  jiraProjectID: 1,
  detail: {
    key,
    title: key,
    ownedByID: 'u',
    folder: null,
    isClosed,
    startDate: null,
    endDate: null,
  },
  summary: null,
});

const STATUSES: AioTestRunStatusConfig[] = [
  { ID: 51, name: 'Not Run', statusType: 'NOT_RUN', color: '#000' },
  { ID: 52, name: 'In Progress', statusType: 'IN_PROGRESS', color: '#000' },
  { ID: 53, name: 'Passed', statusType: 'PASSED', color: '#000' },
  { ID: 54, name: 'Failed', statusType: 'FAILED', color: '#000' },
  { ID: 55, name: 'Blocked', statusType: 'BLOCKED', color: '#000' },
  { ID: 901, name: 'N/A', statusType: 'PASSED', color: '#000' },
];

describe('toDateKey', () => {
  it('handles ISO strings', () => {
    expect(toDateKey('2026-10-09T00:00:00Z')).toBe('2026-10-09');
  });
  it('handles epoch-ms numbers in local time', () => {
    const ms = new Date(2026, 9, 9, 12, 0, 0).getTime();
    expect(toDateKey(ms)).toBe('2026-10-09');
    expect(toDateKey(ms)).toBe(toLocalDateString(new Date(ms)));
  });
  it('returns null for unknown shapes', () => {
    expect(toDateKey(null)).toBeNull();
    expect(toDateKey('garbage')).toBeNull();
    expect(toDateKey({})).toBeNull();
    expect(toDateKey(Number.NaN)).toBeNull();
  });
});

describe('isOverdue', () => {
  const today = '2026-10-13';
  it('is true for an open cycle ending before today', () => {
    expect(isOverdue({ isClosed: false, endDate: '2026-10-01' }, today)).toBe(true);
  });
  it('is false for closed, missing or same-day end dates', () => {
    expect(isOverdue({ isClosed: true, endDate: '2026-10-01' }, today)).toBe(false);
    expect(isOverdue({ isClosed: false, endDate: null }, today)).toBe(false);
    expect(isOverdue({ isClosed: false, endDate: '2026-10-13' }, today)).toBe(false);
  });
});

describe('formatCycleDates', () => {
  it('formats one-sided and empty ranges', () => {
    expect(formatCycleDates('2026-10-09', null, '2026-10-13')).toBe('From Oct 9');
    expect(formatCycleDates(null, '2026-10-28', '2026-10-13')).toBe('Until Oct 28');
    expect(formatCycleDates(null, null, '2026-10-13')).toBeNull();
    expect(formatCycleDates('2026-10-09', '2026-10-28', '2026-10-13')).toContain('Oct 9');
  });
});

describe('formatEffort', () => {
  it('formats seconds', () => {
    expect(formatEffort(0)).toBeNull();
    expect(formatEffort(null)).toBeNull();
    expect(formatEffort(3600)).toBe('1h');
    expect(formatEffort(4980)).toBe('1h 23m');
    expect(formatEffort(1500)).toBe('25m');
    expect(formatEffort(30)).toBe('<1m');
  });
});

describe('cycleProgress', () => {
  it('counts every PASSED status type as pass', () => {
    const p = cycleProgress(
      {
        totalTests: 10,
        testRunDistribution: { '53': 3, '901': 1, '54': 2, '55': 1, '52': 1, '51': 2 },
      },
      STATUSES,
    );
    expect(p.counts).toEqual({ pass: 4, fail: 2, blocked: 1, inProgress: 1, notRun: 2 });
    expect(p.passPct).toBe(40);
  });
  it('maps by name when the key is not a numeric ID', () => {
    const p = cycleProgress({ totalTests: 2, testRunDistribution: { Failed: 2 } }, STATUSES);
    expect(p.counts.fail).toBe(2);
  });
  it('never exceeds 100% when totalTests undercounts the distribution', () => {
    const p = cycleProgress({ totalTests: 2, testRunDistribution: { '53': 3, '54': 1 } }, STATUSES);
    expect(p.total).toBe(4);
    expect(p.passPct).toBe(75);
  });
  it('passPct is null with no tests', () => {
    expect(cycleProgress({ totalTests: 0, testRunDistribution: {} }, STATUSES).passPct).toBeNull();
  });
});

describe('progressTooltipRows', () => {
  it('returns only non-zero rows in order', () => {
    const rows = progressTooltipRows({ pass: 3, fail: 0, blocked: 0, inProgress: 0, notRun: 1 });
    expect(rows.map((r) => r.label)).toEqual(['Passed', 'Not run']);
  });
  it('merges in-progress and not-run into Remaining when all 5 exist', () => {
    const rows = progressTooltipRows({ pass: 1, fail: 1, blocked: 1, inProgress: 2, notRun: 3 });
    expect(rows.map((r) => r.label)).toEqual(['Passed', 'Failed', 'Blocked', 'Remaining']);
    expect(rows[3].value).toBe(5);
    expect(rows.length).toBeLessThanOrEqual(4);
  });
});

describe('aggregateFolderCounts', () => {
  it('sums descendants and includes ungrouped in the total', () => {
    const tree = [folder(101, 'A', [folder(103, 'B')])];
    const { agg, total } = aggregateFolderCounts(tree, { '101': 1, '103': 2, '-1': 4 });
    expect(agg[101]).toBe(3);
    expect(agg[103]).toBe(2);
    expect(total).toBe(7);
  });
});

describe('filterFolderTree', () => {
  const tree = [folder(1, 'Revamp 2023', [folder(2, 'Review')]), folder(3, 'Other')];
  it('keeps matches and their ancestors, case-insensitively', () => {
    const { tree: out, expandIds } = filterFolderTree(tree, 'REV');
    expect(out.map((n) => n.ID)).toEqual([1]);
    expect(out[0].children.map((n) => n.ID)).toEqual([2]);
    expect(expandIds.has(1)).toBe(true);
  });
  it('keeps the whole subtree of a matching folder', () => {
    const t = [folder(1, 'Release', [folder(2, 'Sprint 1'), folder(4, 'Sprint 2')])];
    const { tree: out } = filterFolderTree(t, 'release');
    expect(out[0].children.map((n) => n.ID)).toEqual([2, 4]);
  });
  it('keeps ancestors of a deep match', () => {
    const { tree: out } = filterFolderTree(tree, 'review');
    expect(out[0].ID).toBe(1);
  });
  it('returns the tree unchanged for an empty query', () => {
    const { tree: out, expandIds } = filterFolderTree(tree, '  ');
    expect(out).toBe(tree);
    expect(expandIds.size).toBe(0);
  });
});

describe('sortCycles', () => {
  it('puts open first, then closed, each by key number descending', () => {
    const sorted = sortCycles([
      cycle(1, 'P-CY-2', false),
      cycle(2, 'P-CY-10', true),
      cycle(3, 'P-CY-9', false),
      cycle(4, 'P-CY-11', true),
    ]);
    expect(sorted.map((c) => c.detail.key)).toEqual(['P-CY-9', 'P-CY-2', 'P-CY-11', 'P-CY-10']);
  });
});

describe('weekStartOf / addDaysKey', () => {
  it('returns the Monday of the week', () => {
    expect(weekStartOf('2026-10-15')).toBe('2026-10-12');
    expect(weekStartOf('2026-10-12')).toBe('2026-10-12');
    expect(weekStartOf('2026-10-18')).toBe('2026-10-12'); // Sunday belongs to the previous Monday
  });
  it('adds days across month and DST boundaries without drift', () => {
    expect(addDaysKey('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDaysKey('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDaysKey('2026-03-28', 2)).toBe('2026-03-30');
  });
});

describe('buildStatusLookup', () => {
  it('gives the same cycleProgress result with or without a prebuilt lookup', () => {
    const summary = { totalTests: 5, testRunDistribution: { '53': 2, Failed: 1, '51': 2 } };
    expect(cycleProgress(summary, STATUSES, buildStatusLookup(STATUSES))).toEqual(
      cycleProgress(summary, STATUSES),
    );
  });
});

const TODAY = '2026-10-13'; // Tuesday; its week starts 2026-10-12

const scoped = (
  ID: number,
  opts: { closed?: boolean; end?: string | null; owner?: string },
): AioCycleDetailItem => ({
  ID,
  jiraProjectID: 1,
  detail: {
    key: `P-CY-${ID}`,
    title: `Cycle ${ID}`,
    ownedByID: opts.owner ?? '',
    folder: null,
    isClosed: opts.closed ?? false,
    startDate: null,
    endDate: opts.end ?? null,
  },
  summary: null,
});

const sum = (ID: number, dist: Record<string, number>, totalTests: number) =>
  [
    ID,
    { ID, summary: { totalTests, testRunDistribution: dist } } as unknown as AioCycleSummaryItem,
  ] as const;

const SCOPE_ITEMS = [
  scoped(1, { owner: 'A', end: '2026-10-01' }), // 12 days late
  scoped(2, { owner: 'A', end: TODAY }), // due today, not overdue
  scoped(3, { owner: 'B', end: '2026-10-20' }), // today + 7
  scoped(4, { owner: 'B', end: '2026-10-21' }), // today + 8
  scoped(5, { owner: 'A' }), // no end date
  scoped(6, { owner: 'C', closed: true, end: '2026-09-01' }),
  scoped(7, { owner: 'C', end: '2026-12-31' }), // beyond the 8 weeks
];
const SCOPE_SUMMARIES = Object.fromEntries([
  sum(1, { '53': 2, '54': 1 }, 3),
  sum(6, { '53': 4 }, 4),
]);

describe('aggregateCycleScope', () => {
  const open = aggregateCycleScope(SCOPE_ITEMS, SCOPE_SUMMARIES, STATUSES, TODAY, 'open');
  const all = aggregateCycleScope(SCOPE_ITEMS, SCOPE_SUMMARIES, STATUSES, TODAY, 'all');

  it('counts total, open and closed regardless of the status filter', () => {
    for (const s of [open, all]) {
      expect(s.total).toBe(7);
      expect(s.openCount).toBe(6);
      expect(s.closedCount).toBe(1);
    }
  });

  it('treats an end date equal to today as not overdue', () => {
    expect(open.overdue.count).toBe(1);
    expect(open.overdue.oldestDaysLate).toBe(12);
    expect(open.overdue.top).toEqual([{ key: 'P-CY-1', daysLate: 12 }]);
  });

  it('due soon is inclusive of today and today+7 but not today+8', () => {
    expect(open.dueSoon.count).toBe(2);
    expect(open.dueSoon.nextDate).toBe(TODAY);
    expect(open.dueSoon.top.map((d) => d.key)).toEqual(['P-CY-2', 'P-CY-3']);
  });

  it('counts open cycles without an end date', () => {
    expect(open.noEndDate).toBe(1);
    expect(open.hasEndDates).toBe(true);
  });

  it('execution mix follows the status filter', () => {
    expect(open.exec.total).toBe(3);
    expect(open.exec.passPct).toBe(67);
    expect(open.exec.counts.fail).toBe(1);
    expect(all.exec.total).toBe(7);
    expect(all.exec.passPct).toBe(86);
    expect(all.exec.executed).toBe(7);
    expect(all.exec.withSummary).toBe(2);
  });

  it('passPct is null with no runs', () => {
    const s = aggregateCycleScope(SCOPE_ITEMS, {}, STATUSES, TODAY, 'all');
    expect(s.exec.passPct).toBeNull();
    expect(s.exec.total).toBe(0);
  });

  it('ranks owners by count then id and follows the status filter', () => {
    expect(open.owners.map((o) => [o.ownerId, o.count])).toEqual([
      ['A', 3],
      ['B', 2],
      ['C', 1],
    ]);
    expect(all.owners.find((o) => o.ownerId === 'C')).toMatchObject({
      count: 2,
      open: 1,
      closed: 1,
    });
    expect(open.owners[0]).toMatchObject({ overdue: 1, pass: 2, runTotal: 3 });
  });

  it('returns the top 6 owners and counts the rest as others', () => {
    const many = Array.from({ length: 9 }, (_, i) => scoped(100 + i, { owner: `U${i}` }));
    const s = aggregateCycleScope(many, {}, STATUSES, TODAY, 'open');
    expect(s.owners).toHaveLength(6);
    expect(s.othersCount).toBe(3);
  });

  it('skips cycles without an owner', () => {
    const s = aggregateCycleScope([scoped(1, {})], {}, STATUSES, TODAY, 'open');
    expect(s.owners).toEqual([]);
  });

  it('builds 10 schedule buckets over open cycles only', () => {
    expect(open.weeks).toHaveLength(10);
    expect(open.weeks[0]).toMatchObject({ kind: 'overdue', count: 1, keys: ['P-CY-1'] });
    expect(open.weeks[1]).toMatchObject({
      kind: 'week',
      weekStart: '2026-10-12',
      weekEnd: '2026-10-18',
      count: 1,
    });
    expect(open.weeks[2]).toMatchObject({ weekStart: '2026-10-19', count: 2 });
    expect(open.weeks[2].keys).toEqual(['P-CY-3', 'P-CY-4']);
    expect(open.weeks[9]).toMatchObject({ kind: 'later', count: 1, keys: ['P-CY-7'] });
    // identical regardless of the status filter
    expect(all.weeks).toEqual(open.weeks);
  });

  it('hasEndDates is false when no open cycle has an end date', () => {
    const s = aggregateCycleScope([scoped(1, {})], {}, STATUSES, TODAY, 'open');
    expect(s.hasEndDates).toBe(false);
  });

  it('builds progressByID for every cycle with a summary', () => {
    expect([...open.progressByID.keys()].sort()).toEqual([1, 6]);
    expect(open.progressByID.get(1)?.counts.pass).toBe(2);
  });
});

describe('matchesCycleFilter', () => {
  const byId = (id: number) => SCOPE_ITEMS[id - 1];
  const progress = aggregateCycleScope(
    SCOPE_ITEMS,
    SCOPE_SUMMARIES,
    STATUSES,
    TODAY,
    'all',
  ).progressByID;
  const m = (id: number, f: CycleFilter) =>
    matchesCycleFilter(byId(id), progress.get(id), f, TODAY);

  it('overdue', () => {
    expect(m(1, { kind: 'overdue' })).toBe(true);
    expect(m(2, { kind: 'overdue' })).toBe(false);
    expect(m(6, { kind: 'overdue' })).toBe(false);
  });
  it('dueSoon', () => {
    expect(m(2, { kind: 'dueSoon' })).toBe(true);
    expect(m(3, { kind: 'dueSoon' })).toBe(true);
    expect(m(4, { kind: 'dueSoon' })).toBe(false);
    expect(m(1, { kind: 'dueSoon' })).toBe(false);
  });
  it('noDates', () => {
    expect(m(5, { kind: 'noDates' })).toBe(true);
    expect(m(1, { kind: 'noDates' })).toBe(false);
  });
  it('owner', () => {
    expect(m(1, { kind: 'owner', ownerId: 'A', label: 'Ann' })).toBe(true);
    expect(m(3, { kind: 'owner', ownerId: 'A', label: 'Ann' })).toBe(false);
  });
  it('status needs a summary with at least one run in that status', () => {
    expect(m(1, { kind: 'status', status: 'fail' })).toBe(true);
    expect(m(6, { kind: 'status', status: 'fail' })).toBe(false);
    expect(m(2, { kind: 'status', status: 'pass' })).toBe(false); // no summary
  });
  it('endWeek is open, not past, and within the week', () => {
    expect(m(3, { kind: 'endWeek', weekStart: '2026-10-19' })).toBe(true);
    expect(m(2, { kind: 'endWeek', weekStart: '2026-10-19' })).toBe(false);
    expect(m(1, { kind: 'endWeek', weekStart: '2026-09-28' })).toBe(false); // overdue
    expect(m(6, { kind: 'endWeek', weekStart: '2026-08-31' })).toBe(false); // closed
  });
  it('endLater is open and after the given date', () => {
    expect(m(7, { kind: 'endLater', after: '2026-12-06' })).toBe(true);
    expect(m(4, { kind: 'endLater', after: '2026-12-06' })).toBe(false);
  });
});

describe('cycleFilterLabel', () => {
  it('produces chip text for every kind', () => {
    expect(cycleFilterLabel({ kind: 'overdue' })).toBe('Overdue');
    expect(cycleFilterLabel({ kind: 'dueSoon' })).toBe('Due in 7 days');
    expect(cycleFilterLabel({ kind: 'noDates' })).toBe('No end date');
    expect(cycleFilterLabel({ kind: 'owner', ownerId: 'A', label: 'Ann' })).toBe('Owner: Ann');
    expect(cycleFilterLabel({ kind: 'status', status: 'pass' })).toBe('Status: Passed');
    expect(cycleFilterLabel({ kind: 'endWeek', weekStart: '2026-10-12' })).toBe(
      'Ends week of Oct 12',
    );
    expect(cycleFilterLabel({ kind: 'endLater', after: '2026-12-06' })).toBe('Ends after Dec 6');
  });
});
