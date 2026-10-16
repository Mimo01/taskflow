import { describe, expect, it } from 'vitest';
import type { SearchEntry } from '@/lib/global-search';
import type { RecentItem } from '@/stores/recent-items.store';
import { buildRecentRows, type RecentIssueSources } from './RecentItemRow';

function entry(key: string, parentKey: string | null = null): SearchEntry {
  return {
    key,
    summary: `${key} summary`,
    typeName: parentKey ? 'Sub-task' : 'Story',
    isSubtask: !!parentKey,
    isEpic: false,
    statusName: 'To Do',
    statusCategoryKey: 'new',
    done: false,
    assigneeName: null,
    avatarUrl: null,
    epic: null,
    parentKey,
    tierId: 'backlog',
  };
}

const jira = (id: string): RecentItem => ({ type: 'jira', id, timestamp: 1 });

function resolverFor(entries: SearchEntry[]) {
  const byKey = new Map(entries.map((e) => [e.key, e]));
  return (key: string): RecentIssueSources => ({ entry: byKey.get(key) ?? null });
}

const shape = (rows: ReturnType<typeof buildRecentRows>) =>
  rows.map((r) => `${r.indent ? '  ' : ''}${r.item.id}${r.dimmed ? ' (dim)' : ''}`);

describe('buildRecentRows', () => {
  it('inserts a dimmed parent story above a recent subtask', () => {
    const rows = buildRecentRows(
      [jira('P-2'), jira('P-9')],
      resolverFor([entry('P-1'), entry('P-2', 'P-1'), entry('P-9')]),
    );
    expect(shape(rows)).toEqual(['P-1 (dim)', '  P-2', 'P-9']);
    expect(rows[0].isParent).toBe(true);
    expect(rows[0].entry?.summary).toBe('P-1 summary');
  });

  it('shares one parent row across consecutive sibling subtasks', () => {
    const rows = buildRecentRows(
      [jira('P-2'), jira('P-3')],
      resolverFor([entry('P-1'), entry('P-2', 'P-1'), entry('P-3', 'P-1')]),
    );
    expect(shape(rows)).toEqual(['P-1 (dim)', '  P-2', '  P-3']);
  });

  it('nests a subtask under its parent when the parent is the previous recent item', () => {
    const rows = buildRecentRows(
      [jira('P-1'), jira('P-2')],
      resolverFor([entry('P-1'), entry('P-2', 'P-1')]),
    );
    expect(shape(rows)).toEqual(['P-1', '  P-2']);
  });

  it('repeats the parent row when another item separates the siblings', () => {
    const rows = buildRecentRows(
      [jira('P-2'), jira('P-9'), jira('P-3')],
      resolverFor([entry('P-1'), entry('P-2', 'P-1'), entry('P-3', 'P-1'), entry('P-9')]),
    );
    expect(shape(rows)).toEqual(['P-1 (dim)', '  P-2', 'P-9', 'P-1 (dim)', '  P-3']);
    expect(new Set(rows.map((r) => r.rowKey)).size).toBe(rows.length);
  });

  it('uses the cached issue parent (key + summary) when the subtask is not indexed', () => {
    const rows = buildRecentRows([jira('X-2')], (key) =>
      key === 'X-2'
        ? {
            entry: null,
            issue: {
              key: 'X-2',
              fields: {
                summary: 'Sub',
                issuetype: { name: 'Sub-task', subtask: true },
                parent: { id: '1', key: 'X-1', fields: { summary: 'Parent story' } },
              },
            } as never,
          }
        : { entry: null },
    );
    expect(shape(rows)).toEqual(['X-1 (dim)', '  X-2']);
    expect(rows[0].item.title).toBe('Parent story');
  });

  it('leaves GitLab items flat and breaks subtask nesting', () => {
    const rows = buildRecentRows(
      [jira('P-1'), { type: 'gitlab', id: '1/5', timestamp: 1 }, jira('P-2')],
      resolverFor([entry('P-1'), entry('P-2', 'P-1')]),
    );
    expect(shape(rows)).toEqual(['P-1', '1/5', 'P-1 (dim)', '  P-2']);
  });
});
