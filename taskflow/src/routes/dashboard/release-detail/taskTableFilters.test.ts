import { describe, expect, it } from 'vitest';
import { UNASSIGNED_FILTER } from '@/lib/assignee-filter';
import type { JiraIssue } from '@/services/jira';
import {
  buildTaskFilterOptions,
  matchesTaskFilters,
  sortTaskRows,
  type TaskFilters,
} from './taskTableFilters';

function issue(
  key: string,
  opts: {
    summary?: string;
    status?: string;
    category?: 'new' | 'indeterminate' | 'done' | null;
    type?: string;
    assignee?: string | null;
  } = {},
): JiraIssue {
  return {
    id: key,
    key,
    fields: {
      summary: opts.summary ?? `Summary ${key}`,
      status: {
        id: '1',
        name: opts.status ?? 'To Do',
        statusCategory: opts.category === null ? undefined : { key: opts.category ?? 'new' },
      },
      assignee: opts.assignee ? { displayName: opts.assignee } : null,
      issuetype: { name: opts.type ?? 'Story', subtask: false },
    },
  } as unknown as JiraIssue;
}

const row = (i: JiraIssue) => ({ issue: i, mrs: [] as unknown[] });

function filters(overrides: Partial<TaskFilters> = {}): TaskFilters {
  return {
    query: '',
    statuses: new Set(),
    types: new Set(),
    assignees: new Set(),
    ...overrides,
  };
}

describe('buildTaskFilterOptions', () => {
  it('orders statuses by category then name, sorts types, delegates assignees', () => {
    const rows = [
      row(issue('PROJ-1', { status: 'Done', category: 'done', type: 'Task', assignee: 'Bob' })),
      row(issue('PROJ-2', { status: 'In Progress', category: 'indeterminate', type: 'Bug' })),
      row(issue('PROJ-3', { status: 'To Do', category: 'new', type: 'Story', assignee: 'Alice' })),
      row(issue('PROJ-4', { status: 'Backlog', category: 'new', type: 'Bug', assignee: 'Bob' })),
      row(issue('PROJ-5', { status: 'Code Review', category: 'indeterminate' })),
    ];
    const opts = buildTaskFilterOptions(rows);
    expect(opts.statuses).toEqual(['Backlog', 'To Do', 'Code Review', 'In Progress', 'Done']);
    expect(opts.types).toEqual(['Bug', 'Story', 'Task']);
    expect(opts.assignees).toEqual([UNASSIGNED_FILTER, 'Bob', 'Alice']);
  });

  it('omits the Unassigned sentinel when every issue is assigned', () => {
    const opts = buildTaskFilterOptions([row(issue('PROJ-1', { assignee: 'Alice' }))]);
    expect(opts.assignees).toEqual(['Alice']);
  });
});

describe('matchesTaskFilters', () => {
  const a = issue('PROJ-12', {
    summary: 'Fix Login bug',
    status: 'In Progress',
    category: 'indeterminate',
    type: 'Bug',
    assignee: 'Alice',
  });
  const b = issue('PROJ-3', { summary: 'Other', status: 'To Do', type: 'Story' });

  it('passes everything with empty filters', () => {
    expect(matchesTaskFilters(a, filters())).toBe(true);
    expect(matchesTaskFilters(b, filters())).toBe(true);
  });

  it('matches query against key or summary, case-insensitive and trimmed', () => {
    expect(matchesTaskFilters(a, filters({ query: '  proj-12 ' }))).toBe(true);
    expect(matchesTaskFilters(a, filters({ query: 'login' }))).toBe(true);
    expect(matchesTaskFilters(b, filters({ query: 'login' }))).toBe(false);
  });

  it('matches status and type by exact name, OR within a dimension', () => {
    expect(matchesTaskFilters(a, filters({ statuses: new Set(['In Progress']) }))).toBe(true);
    expect(matchesTaskFilters(b, filters({ statuses: new Set(['In Progress']) }))).toBe(false);
    expect(matchesTaskFilters(b, filters({ statuses: new Set(['In Progress', 'To Do']) }))).toBe(
      true,
    );
    expect(matchesTaskFilters(a, filters({ types: new Set(['Bug']) }))).toBe(true);
    expect(matchesTaskFilters(b, filters({ types: new Set(['Bug']) }))).toBe(false);
  });

  it('Unassigned sentinel matches only null assignees', () => {
    const f = filters({ assignees: new Set([UNASSIGNED_FILTER]) });
    expect(matchesTaskFilters(a, f)).toBe(false);
    expect(matchesTaskFilters(b, f)).toBe(true);
    expect(matchesTaskFilters(a, filters({ assignees: new Set(['Alice']) }))).toBe(true);
  });

  it('ANDs across dimensions', () => {
    expect(
      matchesTaskFilters(a, filters({ types: new Set(['Bug']), statuses: new Set(['To Do']) })),
    ).toBe(false);
    expect(
      matchesTaskFilters(
        a,
        filters({ types: new Set(['Bug']), statuses: new Set(['In Progress']), query: 'login' }),
      ),
    ).toBe(true);
  });
});

describe('sortTaskRows', () => {
  const rows = [
    row(
      issue('PROJ-10', {
        summary: 'Charlie',
        status: 'Done',
        category: 'done',
        assignee: 'Bob',
      }),
    ),
    row(issue('PROJ-9', { summary: 'alpha', status: 'In Progress', category: 'indeterminate' })),
    row(
      issue('PROJ-11', { summary: 'Bravo', status: 'To Do', category: 'new', assignee: 'Alice' }),
    ),
  ];
  const keys = (rs: typeof rows) => rs.map((r) => r.issue.key);

  it('returns original order when no key is active', () => {
    expect(keys(sortTaskRows(rows, null, 'asc'))).toEqual(['PROJ-10', 'PROJ-9', 'PROJ-11']);
  });

  it('sorts keys numerically', () => {
    expect(keys(sortTaskRows(rows, 'key', 'asc'))).toEqual(['PROJ-9', 'PROJ-10', 'PROJ-11']);
    expect(keys(sortTaskRows(rows, 'key', 'desc'))).toEqual(['PROJ-11', 'PROJ-10', 'PROJ-9']);
  });

  it('sorts status by category then name; desc reverses', () => {
    expect(keys(sortTaskRows(rows, 'status', 'asc'))).toEqual(['PROJ-11', 'PROJ-9', 'PROJ-10']);
    expect(keys(sortTaskRows(rows, 'status', 'desc'))).toEqual(['PROJ-10', 'PROJ-9', 'PROJ-11']);
  });

  it('treats a missing status category as To Do', () => {
    const rs = [
      row(issue('PROJ-1', { status: 'Done', category: 'done' })),
      row(issue('PROJ-2', { status: 'Mystery', category: null })),
    ];
    expect(keys(sortTaskRows(rs, 'status', 'asc'))).toEqual(['PROJ-2', 'PROJ-1']);
  });

  it('sorts assignee by displayName with unassigned last both ways', () => {
    expect(keys(sortTaskRows(rows, 'assignee', 'asc'))).toEqual(['PROJ-11', 'PROJ-10', 'PROJ-9']);
    expect(keys(sortTaskRows(rows, 'assignee', 'desc'))).toEqual(['PROJ-10', 'PROJ-11', 'PROJ-9']);
  });

  it('sorts summary alphabetically', () => {
    expect(keys(sortTaskRows(rows, 'summary', 'asc'))).toEqual(['PROJ-9', 'PROJ-11', 'PROJ-10']);
  });

  it('does not mutate the input', () => {
    const copy = [...rows];
    sortTaskRows(rows, 'key', 'asc');
    expect(rows).toEqual(copy);
  });
});
