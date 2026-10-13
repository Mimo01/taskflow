import { describe, expect, it } from 'vitest';
import type { AioCycleDetailItem, AioFolder, AioTestRunStatusConfig } from '@/services/aio/types';
import {
  aggregateFolderCounts,
  cycleProgress,
  filterFolderTree,
  formatCycleDates,
  formatEffort,
  isOverdue,
  progressTooltipRows,
  sortCycles,
  toDateKey,
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
