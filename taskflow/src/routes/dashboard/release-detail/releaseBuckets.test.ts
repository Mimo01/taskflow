import { describe, expect, it } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import {
  deriveReleaseAssigneeRows,
  deriveReleaseStatusRows,
  deriveReleaseTypeRows,
  mrDonutSlices,
  statusCategoryRows,
  WAFFLE_LAYOUT,
  waffleCapacity,
  waffleColumns,
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
  it('carries the exact issuetype name as filterValue, null for Other', () => {
    const rows = deriveReleaseTypeRows([issue(1, { type: 'Bug' }), issue(2, { type: null })], SP);
    expect(rows.find((r) => r.typeName === 'Bug')?.filterValue).toBe('Bug');
    expect(rows.find((r) => r.typeName === 'Other')?.filterValue).toBeNull();
  });
});

describe('mrDonutSlices', () => {
  it('orders merged/open/draft/closed, drops zeros, integer shares', () => {
    const s = mrDonutSlices({ merged: 2, open: 0, draft: 1, closed: 0 });
    expect(s.map((x) => x.key)).toEqual(['merged', 'draft']);
    expect(s.map((x) => x.share)).toEqual([67, 33]);
    expect(s[0].color).toBe('var(--color-green-500)');
    expect(s[1].color).toBe('color-mix(in oklab, var(--color-blue-500) 40%, transparent)');
    expect(s.map((x) => x.label)).toEqual(['Merged', 'Draft']);
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
    expect(rows.map((r) => r.filterValues)).toEqual([
      ['Done'],
      ['In Review'],
      ['In Progress'],
      ['To Do'],
    ]);
  });
  it('an issue without a status name yields the Unknown row with no filter values', () => {
    const i = issue(1);
    (i.fields as unknown as { status: unknown }).status = undefined;
    const rows = deriveReleaseStatusRows([i]);
    expect(rows[0]).toMatchObject({ name: 'Unknown', filterValues: [] });
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

  it('columns never exceed the widest row or the cell, and a 40-issue row wraps at ~347px', () => {
    expect(waffleColumns(18, 640)).toBe(18);
    expect(waffleColumns(18, 347)).toBe(waffleCapacity(347));
    const cols = waffleColumns(40, 347);
    expect(cols).toBeLessThan(40);
    expect(rowWidth(cols)).toBeLessThanOrEqual(347);
    expect(Math.ceil(40 / cols)).toBeGreaterThan(1);
    expect(waffleColumns(3, 900)).toBe(3);
    expect(waffleColumns(40, 50)).toBe(1);
  });
});

describe('statusCategoryRows', () => {
  const row = (name: string, cat: 'done' | 'indeterminate' | 'new', count: number) => ({
    name,
    cat,
    count,
    filterValues: [name],
  });

  it('always returns the three categories, zero counts included', () => {
    const s = statusCategoryRows([]);
    expect(s.map((x) => x.cat)).toEqual(['new', 'indeterminate', 'done']);
    expect(s.map((x) => x.count)).toEqual([0, 0, 0]);
    expect(s.every((x) => x.filterValues.length === 0)).toBe(true);
  });

  it('groups exact statuses into to do, in progress, done', () => {
    const s = statusCategoryRows([
      row('Closed', 'done', 1),
      row('Done', 'done', 2),
      row('To Do', 'new', 5),
    ]);
    expect(s.map((x) => x.label)).toEqual(['To do', 'In progress', 'Done']);
    expect(s.map((x) => x.count)).toEqual([5, 0, 3]);
    expect(s.map((x) => x.share)).toEqual([63, 0, 38]);
    expect(s[2].filterValues).toEqual(['Done', 'Closed']);
    expect(s[2].statuses).toEqual([
      { label: 'Done', value: 2 },
      { label: 'Closed', value: 1 },
    ]);
  });

  it('caps tooltip statuses at four with a +N more row; filter keeps every status', () => {
    const s = statusCategoryRows(
      ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => row(n, 'indeterminate', 10 - i)),
    );
    expect(s[1].statuses).toHaveLength(4);
    expect(s[1].statuses[3]).toEqual({ label: '+3 more', value: 7 + 6 + 5 });
    expect(s[1].filterValues).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('lists all four statuses when there are exactly four', () => {
    const s = statusCategoryRows(['A', 'B', 'C', 'D'].map((n) => row(n, 'new', 1)));
    expect(s[0].statuses.map((r) => r.label)).toEqual(['A', 'B', 'C', 'D']);
  });
});
