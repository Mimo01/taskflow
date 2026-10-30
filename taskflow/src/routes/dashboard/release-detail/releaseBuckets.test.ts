import { describe, expect, it } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import {
  deriveReleaseAssigneeRows,
  deriveReleaseTypeRows,
  mrDonutSlices,
  statusNameSummary,
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
