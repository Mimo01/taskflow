import { describe, expect, it } from 'vitest';
import type { NotificationItem } from '../../stores/notifications.store';
import {
  bucketOf,
  buildEntries,
  describeEventAria,
  describeEventParts,
  entryItemIds,
  filterItems,
  formatAbsoluteTime,
  formatEventTail,
  getEntityKey,
  getEntityRef,
  getEntityTitle,
  getJiraKey,
  isFocusableEntry,
  isSafeHttpUrl,
  relTime,
} from './notification-view';

const NOW = new Date(2026, 10, 10, 15, 0).getTime();
const local = (m: number, d: number, h = 9, min = 0) => new Date(2026, m, d, h, min).toISOString();

function makeItem(over: Partial<NotificationItem> & { id: string }): NotificationItem {
  return {
    source: 'jira',
    entityTitle: 'Example',
    author: 'Example Author',
    bodyPreview: 'Example body',
    fullBody: 'Example body',
    createdAt: local(10, 10, 12),
    ...over,
  };
}

const jira = (id: string, key: string, createdAt: string, over: Partial<NotificationItem> = {}) =>
  makeItem({ id, entityTitle: `${key}: Example`, createdAt, ...over });

describe('entity helpers', () => {
  it('parses jira key and title', () => {
    const i = makeItem({ id: 'a', entityTitle: 'PROJ-1: Fix login' });
    expect(getJiraKey(i)).toBe('PROJ-1');
    expect(getEntityKey(i)).toBe('jira:PROJ-1');
    expect(getEntityTitle(i)).toBe('Fix login');
    expect(getEntityRef(i)).toBe('PROJ-1');
  });
  it('accepts digits in the prefix', () => {
    expect(getJiraKey(makeItem({ id: 'a', entityTitle: 'AB2-5: Thing' }))).toBe('AB2-5');
  });
  it('falls back to the browse url', () => {
    const i = makeItem({ id: 'a', url: 'https://x.test/browse/PROJ-9' });
    expect(getJiraKey(i)).toBe('PROJ-9');
  });
  it('handles gitlab MRs', () => {
    const i = makeItem({ id: 'g', source: 'gitlab', mrProjectId: 12, mrIid: 34 });
    expect(getEntityKey(i)).toBe('gitlab:12/34');
    expect(getEntityRef(i)).toBe('!34');
    expect(getJiraKey(i)).toBeNull();
  });
  it('falls back to item id', () => {
    const i = makeItem({ id: 'zz' });
    expect(getEntityKey(i)).toBe('item:zz');
    expect(getEntityRef(i)).toBeNull();
  });
});

describe('bucketOf', () => {
  it('buckets by local calendar day', () => {
    expect(bucketOf(local(10, 10, 0, 5), NOW)).toBe('today');
    expect(bucketOf(new Date(2026, 10, 9, 23, 59).toISOString(), NOW)).toBe('yesterday');
    expect(bucketOf(local(10, 4), NOW)).toBe('week');
    expect(bucketOf(local(10, 3), NOW)).toBe('older');
  });
});

describe('relTime / formatAbsoluteTime / isSafeHttpUrl', () => {
  it('formats relative times', () => {
    const ago = (s: number) => new Date(NOW - s * 1000).toISOString();
    expect(relTime(ago(30), NOW)).toBe('just now');
    expect(relTime(ago(300), NOW)).toBe('5m');
    expect(relTime(ago(3 * 3600), NOW)).toBe('3h');
    expect(relTime(ago(2 * 86400), NOW)).toBe('2d');
    expect(relTime(ago(15 * 86400), NOW)).toBe('2w');
  });
  it('formats an absolute time string', () => {
    expect(formatAbsoluteTime(local(10, 10))).toMatch(/\d/);
  });
  it('allows only http(s)', () => {
    expect(isSafeHttpUrl('https://x.test/a')).toBe(true);
    expect(isSafeHttpUrl('http://x.test')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('file:///etc')).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
    expect(isSafeHttpUrl('not a url')).toBe(false);
  });
});

describe('describeEventParts', () => {
  const d = (
    notificationType: NotificationItem['notificationType'],
    bodyPreview = 'Hello',
    author = 'Ann Lee',
  ) => describeEventParts(makeItem({ id: 'a', author, notificationType, bodyPreview }));
  const tail = (...a: Parameters<typeof d>) => formatEventTail(d(...a));
  it('describes each type as short verb + first-name actor', () => {
    expect(tail('jira-comment')).toBe('commented \u00b7 Ann');
    expect(tail('mr-note')).toBe('commented \u00b7 Ann');
    expect(tail('comment-mention')).toBe('mentioned \u00b7 Ann');
    expect(tail('gitlab-mention')).toBe('mentioned \u00b7 Ann');
    expect(tail('issue-assignment')).toBe('assigned \u00b7 Ann');
    expect(tail('mr-approval')).toBe('approved \u00b7 Ann');
    expect(tail('pipeline-failure')).toBe('pipeline failed');
    expect(tail('due-date-reminder', 'Due tomorrow', '')).toBe('due tomorrow');
    expect(tail('due-date-reminder', 'whatever', '')).toBe('due');
    expect(tail('issue-update', 'Priority: A \u2192 B')).toBe('updated \u00b7 Ann');
    expect(tail(undefined)).toBe('updated \u00b7 Ann');
  });
  it('shows the new status for status changes', () => {
    expect(tail('issue-update', 'Status: To Do \u2192 In Progress')).toBe(
      'status \u2192 In Progress \u00b7 Ann',
    );
  });
  it('keeps single-word names and drops empty actors', () => {
    expect(d('jira-comment', 'x', 'J.Smith').actor).toBe('J.Smith');
    expect(d('jira-comment', 'x', '').actor).toBeUndefined();
  });
  it('keeps snippets only for comment-like events, on one line', () => {
    expect(d('jira-comment', 'a\nb\n\n c').snippet).toBe('a b c');
    expect(d('issue-assignment').snippet).toBe('');
  });
  it('builds an aria phrase', () => {
    expect(describeEventAria(d('issue-assignment'))).toBe('assigned by Ann');
    expect(describeEventAria(d('pipeline-failure'))).toBe('pipeline failed');
  });
});

describe('filterItems', () => {
  const items = [
    jira('j1', 'PROJ-1', local(10, 10, 9)),
    makeItem({ id: 'g1', source: 'gitlab', createdAt: local(10, 10, 11) }),
    jira('j2', 'PROJ-2', local(10, 10, 13)),
  ];
  it('filters by source and sorts newest first', () => {
    expect(filterItems(items, new Set(), 'jira', false).map((i) => i.id)).toEqual(['j2', 'j1']);
    expect(filterItems(items, new Set(), 'all', false).map((i) => i.id)).toEqual([
      'j2',
      'g1',
      'j1',
    ]);
  });
  it('drops read when unreadOnly', () => {
    expect(filterItems(items, new Set(['j2']), 'all', true).map((i) => i.id)).toEqual(['g1', 'j1']);
  });
});

describe('buildEntries', () => {
  const base = { source: 'all' as const, unreadOnly: false, expandOverrides: {}, now: NOW };

  it('returns [] for no items', () => {
    expect(buildEntries({ ...base, items: [], readSet: new Set() })).toEqual([]);
  });

  it('three unrelated items today', () => {
    const items = [
      jira('a', 'PROJ-1', local(10, 10, 9)),
      jira('b', 'PROJ-2', local(10, 10, 10)),
      jira('c', 'PROJ-3', local(10, 10, 11)),
    ];
    const e = buildEntries({ ...base, items, readSet: new Set() });
    expect(e.map((x) => x.kind)).toEqual(['header', 'event', 'event', 'event']);
    expect(e[0].id).toBe('header:today');
    for (const x of e) if (x.kind === 'event') expect(x.nested).toBe(false);
  });

  const grouped = [
    jira('a', 'PROJ-1', local(10, 10, 9)),
    jira('b', 'PROJ-1', local(10, 10, 11)),
    jira('c', 'PROJ-2', local(10, 10, 10)),
  ];

  it('groups events on the same entity', () => {
    const e = buildEntries({ ...base, items: grouped, readSet: new Set(['a']) });
    const g = e[1];
    expect(g.kind).toBe('group');
    if (g.kind !== 'group') return;
    expect(g.id).toBe('group:jira:PROJ-1');
    expect(g.items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(g.unreadCount).toBe(1);
    expect(g.expanded).toBe(true);
    expect(e.slice(2, 4).map((x) => x.id)).toEqual(['event:b', 'event:a']);
    for (const c of e.slice(2, 4)) {
      if (c.kind === 'event') {
        expect(c.nested).toBe(true);
        expect(c.groupId).toBe('group:jira:PROJ-1');
      }
    }
    const plain = e[4];
    expect(plain.kind === 'event' && plain.nested === false).toBe(true);
  });

  it('collapses an all-read group with no children', () => {
    const e = buildEntries({ ...base, items: grouped, readSet: new Set(['a', 'b']) });
    const g = e[1];
    expect(g.kind === 'group' && g.expanded).toBe(false);
    expect(e.filter((x) => x.kind === 'event' && x.nested)).toHaveLength(0);
  });

  it('honours expand overrides', () => {
    const collapsed = buildEntries({
      ...base,
      items: grouped,
      readSet: new Set(['a']),
      expandOverrides: { 'jira:PROJ-1': false },
    });
    expect(collapsed.filter((x) => x.kind === 'event' && x.nested)).toHaveLength(0);
    const open = buildEntries({
      ...base,
      items: grouped,
      readSet: new Set(['a', 'b']),
      expandOverrides: { 'jira:PROJ-1': true },
    });
    expect(open.filter((x) => x.kind === 'event' && x.nested)).toHaveLength(2);
  });

  it('places a group by its newest event', () => {
    const items = [jira('a', 'PROJ-1', local(10, 10, 9)), jira('b', 'PROJ-1', local(10, 1, 9))];
    const e = buildEntries({ ...base, items, readSet: new Set() });
    expect(e.filter((x) => x.kind === 'group')).toHaveLength(1);
    expect(e.map((x) => x.id).filter((i) => i.startsWith('header:'))).toEqual(['header:today']);
  });

  it('orders buckets and groups within a bucket', () => {
    const items = [
      jira('o', 'PROJ-4', local(10, 1)),
      jira('w', 'PROJ-3', local(10, 5)),
      jira('y', 'PROJ-2', new Date(2026, 10, 9, 10).toISOString()),
      jira('t', 'PROJ-1', local(10, 10, 9)),
    ];
    const e = buildEntries({ ...base, items, readSet: new Set() });
    expect(e.filter((x) => x.kind === 'header').map((x) => x.id)).toEqual([
      'header:today',
      'header:yesterday',
      'header:week',
      'header:older',
    ]);
  });

  it('excludes read events before grouping when unreadOnly', () => {
    const e = buildEntries({
      ...base,
      unreadOnly: true,
      items: grouped,
      readSet: new Set(['a']),
    });
    expect(e.some((x) => x.kind === 'group')).toBe(false);
    expect(e.map((x) => x.id)).toContain('event:b');
    expect(e.map((x) => x.id)).not.toContain('event:a');
  });

  it('produces unique prefixed ids', () => {
    const e = buildEntries({ ...base, items: grouped, readSet: new Set() });
    const ids = e.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of e)
      expect(x.id.startsWith(`${x.kind === 'header' ? 'header' : x.kind}:`)).toBe(true);
  });
});

describe('entryItemIds / isFocusableEntry', () => {
  it('maps entries to item ids', () => {
    const items = [jira('a', 'PROJ-1', local(10, 10, 9)), jira('b', 'PROJ-1', local(10, 10, 11))];
    const e = buildEntries({
      items,
      readSet: new Set(),
      source: 'all',
      unreadOnly: false,
      expandOverrides: {},
      now: NOW,
    });
    expect(entryItemIds(e[0])).toEqual([]);
    expect(entryItemIds(e[1])).toEqual(['b', 'a']);
    expect(entryItemIds(e[2])).toEqual(['b']);
    expect(isFocusableEntry(e[0])).toBe(false);
    expect(isFocusableEntry(e[1])).toBe(true);
  });
});
