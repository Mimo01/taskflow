import { describe, expect, it } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import {
  deriveReleaseAssigneeRows,
  deriveReleaseStatusRows,
  deriveReleaseTypeRows,
  mrDonutSlices,
  statusNameSummary,
  WAFFLE_LAYOUT,
  waffleCapacity,
  waffleCells,
  waffleUnit,
} from './releaseBuckets';

const SP = 'customfield_10016';

function issue(
  n: number,
  o: {
    cat?: 'new' | 'indeterminate' | 'done';
    status?: string;
    assignee?: string | null;
    type?: string | null;
    sp?: number;
  } = {},
): JiraIssue {
  return {
    id: String(n),
    key: `PROJ-${n}`,
    fields: {
      summary: 'x',
      status: { id: '1', name: o.status ?? 'Open', statusCategory: { key: o.cat ?? 'new' } },
      assignee: o.assignee ? { name: o.assignee, displayName: o.assignee } : null,
      ...(o.type === null ? {} : { issuetype: { name: o.type ?? 'Story', subtask: false } }),
      ...(o.sp !== undefined ? { [SP]: o.sp } : {}),
    },
  } as unknown as JiraIssue;
}

describe('deriveReleaseAssigneeRows', () => {
  it('returns [] for no issues', () => {
    expect(deriveReleaseAssigneeRows([], SP)).toEqual([]);
  });
  it('counts issues, maps breakdown, sums sp, and puts Unassigned last', () => {
    const rows = deriveReleaseAssigneeRows(
      [
        issue(1, { assignee: null }),
        issue(2, { assignee: null }),
        issue(3, { assignee: null }),
        issue(4, { assignee: 'Bob', cat: 'done', sp: 3 }),
        issue(5, { assignee: 'Bob', cat: 'indeterminate', sp: 2 }),
        issue(6, { assignee: 'Alice', cat: 'new' }),
      ],
      SP,
    );
    expect(rows.map((r) => r.name)).toEqual(['Bob', 'Alice', 'Unassigned']);
    expect(rows[0]).toMatchObject({
      total: 2,
      done: 1,
      sp: 5,
      breakdown: { done: 1, indeterminate: 1, new: 0 },
      unassigned: false,
    });
    expect(rows[1].sp).toBe(0);
    expect(rows[2]).toMatchObject({ unassigned: true, total: 3 });
  });
});

describe('deriveReleaseTypeRows', () => {
  it('returns [] for no issues', () => {
    expect(deriveReleaseTypeRows([], SP)).toEqual([]);
  });
  it('groups by type, defaults to Other, sorts total desc then name', () => {
    const rows = deriveReleaseTypeRows(
      [
        issue(1, { type: 'Bug', cat: 'done', sp: 1 }),
        issue(2, { type: 'Story' }),
        issue(3, { type: 'Story', cat: 'indeterminate', sp: 4 }),
        issue(4, { type: null }),
        issue(5, { type: 'Task' }),
      ],
      SP,
    );
    expect(rows.map((r) => r.typeName)).toEqual(['Story', 'Bug', 'Other', 'Task']);
    expect(rows[0]).toMatchObject({ total: 2, done: 0, sp: 4 });
    expect(rows[0].breakdown).toEqual({ new: 1, indeterminate: 1, done: 0 });
    expect(rows[1]).toMatchObject({ total: 1, done: 1, sp: 1 });
  });
});

describe('mrDonutSlices', () => {
  it('orders merged/open/draft/closed, drops zeros, integer shares', () => {
    const s = mrDonutSlices({ merged: 2, open: 0, draft: 1, closed: 0 });
    expect(s.map((x) => x.key)).toEqual(['merged', 'draft']);
    expect(s.map((x) => x.share)).toEqual([67, 33]);
    expect(s[0].color).toBe('var(--color-green-500)');
    expect(s[1].color).toBe('color-mix(in oklab, var(--color-blue-500) 40%, transparent)');
    expect(s[0].label).toBe('merged');
    expect(s[0].rows.length).toBeLessThanOrEqual(4);
  });
  it('returns [] when empty and colours open/closed', () => {
    expect(mrDonutSlices({ merged: 0, open: 0, draft: 0, closed: 0 })).toEqual([]);
    const s = mrDonutSlices({ merged: 0, open: 1, draft: 0, closed: 1 });
    expect(s.map((x) => x.color)).toEqual([
      'var(--color-blue-500)',
      'var(--color-muted-foreground)',
    ]);
  });
});

describe('statusNameSummary', () => {
  it('returns null when everything is done or empty', () => {
    expect(statusNameSummary([])).toBeNull();
    expect(statusNameSummary([issue(1, { cat: 'done' })])).toBeNull();
  });
  it('groups not-done by name, top 3 with +N more', () => {
    const issues = [
      issue(1, { cat: 'indeterminate', status: 'In Review' }),
      issue(2, { cat: 'indeterminate', status: 'In Review' }),
      issue(3, { cat: 'indeterminate', status: 'In Review' }),
      issue(4, { cat: 'indeterminate', status: 'QA' }),
      issue(5, { cat: 'indeterminate', status: 'QA' }),
      issue(6, { cat: 'new', status: 'Open' }),
      issue(7, { cat: 'new', status: 'Blocked' }),
      issue(8, { cat: 'done', status: 'Closed' }),
    ];
    expect(statusNameSummary(issues)).toBe('In Review 3 · QA 2 · Blocked 1 · +1 more');
    expect(statusNameSummary(issues.slice(0, 5))).toBe('In Review 3 · QA 2');
  });
});

describe('waffleUnit / waffleCells', () => {
  it('unit is 1 when the widest row fits and ceil(max/capacity) otherwise', () => {
    expect(waffleUnit(8, 10)).toBe(1);
    expect(waffleUnit(26, 10)).toBe(3);
    expect(waffleUnit(26, 0)).toBe(26);
  });

  it('unit 1 keeps one block per issue', () => {
    expect(waffleCells({ done: 2, indeterminate: 1, new: 3 }, 1)).toEqual({
      done: 2,
      indeterminate: 1,
      new: 3,
    });
  });

  it('aggregates to ceil(total/unit) blocks, preserving the mix', () => {
    const c = waffleCells({ done: 22, indeterminate: 4, new: 0 }, 3);
    expect(c.done + c.indeterminate + c.new).toBe(9);
    expect(c).toEqual({ done: 8, indeterminate: 1, new: 0 });
  });

  it('never drops a non-empty category to zero blocks', () => {
    const c = waffleCells({ done: 0, indeterminate: 1, new: 25 }, 3);
    expect(c.indeterminate).toBe(1);
    expect(c.done + c.indeterminate + c.new).toBe(9);
    const bug = waffleCells({ done: 0, indeterminate: 2, new: 0 }, 3);
    expect(bug).toEqual({ done: 0, indeterminate: 1, new: 0 });
  });
});

describe('deriveReleaseStatusRows', () => {
  it('counts per status name, ordered done, in progress, to do then count', () => {
    const rows = deriveReleaseStatusRows([
      issue(1, { status: 'To Do', cat: 'new' }),
      issue(2, { status: 'Done', cat: 'done' }),
      issue(3, { status: 'In Review', cat: 'indeterminate' }),
      issue(4, { status: 'In Review', cat: 'indeterminate' }),
      issue(5, { status: 'In Progress', cat: 'indeterminate' }),
    ]);
    expect(rows.map((r) => [r.name, r.cat, r.count])).toEqual([
      ['Done', 'done', 1],
      ['In Review', 'indeterminate', 2],
      ['In Progress', 'indeterminate', 1],
      ['To Do', 'new', 1],
    ]);
  });
});

describe('waffleCapacity', () => {
  const { block, gap, nameCol, countCol, rowGap } = WAFFLE_LAYOUT;
  const rowWidth = (blocks: number) =>
    nameCol + rowGap + (blocks * (block + gap) - gap) + rowGap + countCol;

  it('never lets a full row exceed the cell width', () => {
    for (const cell of [200, 280, 347, 460, 640, 900]) {
      const cap = waffleCapacity(cell);
      expect(cap).toBeGreaterThanOrEqual(1);
      if (cell >= rowWidth(1)) expect(rowWidth(cap)).toBeLessThanOrEqual(cell);
    }
  });

  it('18 blocks do not fit a ~347px cell, so the unit becomes 2 and the row is 9 blocks', () => {
    const cap = waffleCapacity(347);
    expect(cap).toBeLessThan(18);
    const unit = waffleUnit(18, cap);
    expect(unit).toBe(2);
    expect(Math.ceil(18 / unit)).toBeLessThanOrEqual(cap);
    expect(rowWidth(Math.ceil(18 / unit))).toBeLessThanOrEqual(347);
  });
});
