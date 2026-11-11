import {
  ACTION_STYLE,
  type ActionKey,
  actionKeyForField,
  EVENT_STYLE,
} from './notification-colours';
import { describe, expect, it } from 'vitest';
import type { NotificationItem } from '../../stores/notifications.store';
import {
  parseGitlabSystemLine,
  bucketOf,
  buildEntries,
  describeEventAria,
  describeEntryParts,
  entryIds,
  describeEventParts,
  commentPreview,
  countUnreadCards,
  listRowCount,
  MAX_LIST_ROWS,
  visibleCount,
  EST_CARD_BASE,
  EST_CARD_GAP,
  EST_QUICK_ROW,
  EST_STACK_PEEK,
  estimateEntryHeight,
  mergeChanges,
  mergeCategory,
  orderChanges,
  parseChangeLines,
  filterItems,
  formatAbsoluteTime,
  eventStyleFor,
  statusCategoryGuess,
  getEntityRef,
  getEntityTitle,
  getJiraKey,
  isFocusableEntry,
  isSafeHttpUrl,
  stackEntries,
  stackIds,
  quickActionFor,
  entityKey,
  type EventEntry,
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
    expect(getEntityRef(i)).toBe('!34');
    expect(getJiraKey(i)).toBeNull();
  });
  it('falls back to item id', () => {
    const i = makeItem({ id: 'zz' });
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
    expect(relTime(ago(6 * 86400), NOW)).toBe('6d');
    // a week or older shows the date (same year: no year; older: with year)
    const nov = new Date(2026, 9, 26, 12).toISOString();
    expect(relTime(nov, NOW)).toBe(
      new Date(nov).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    );
    expect(relTime(nov, NOW)).not.toMatch(/w$/);
    const lastYear = new Date(2025, 10, 3, 12).toISOString();
    expect(relTime(lastYear, NOW)).toContain('2025');
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
  const verb = (...a: Parameters<typeof d>) => d(...a).verb;
  it('describes each type as a short verb phrase (actor kept separately)', () => {
    expect(verb('jira-comment')).toBe('commented');
    expect(verb('mr-note')).toBe('commented');
    expect(verb('comment-mention')).toBe('mentioned you');
    expect(verb('gitlab-mention')).toBe('mentioned you');
    expect(verb('issue-assignment')).toBe('assigned you');
    expect(verb('mr-approval')).toBe('approved');
    expect(verb('pipeline-failure')).toBe('pipeline failed');
    expect(verb('due-date-reminder', 'Due tomorrow', '')).toBe('due tomorrow');
    expect(verb('due-date-reminder', 'whatever', '')).toBe('due');
    expect(verb('issue-update', 'Priority: A \u2192 B')).toBe('changed priority');
    expect(verb('issue-update', 'unrecognised text')).toBe('updated');
    expect(verb(undefined)).toBe('updated');
    expect(d('jira-comment').actor).toBe('Ann');
  });
  it('gives pipeline failures a detail and due reminders a verb with the day', () => {
    expect(d('pipeline-failure', 'Pipeline #4821 failed on feature/x').detail).toBe(
      '#4821 on feature/x',
    );
    expect(d('due-date-reminder', 'Due tomorrow', '').verb).toBe('due tomorrow');
  });
  it('parses change lines incl. (none), description and unknown lines', () => {
    expect(
      parseChangeLines(
        [
          'Priority: Minor \u2192 Major',
          'Assignee: (none) \u2192 Ben',
          'Labels: a \u2192 a b',
          'Description: updated',
          'garbage line',
        ].join('\n'),
      ),
    ).toEqual([
      { field: 'priority', from: 'Minor', to: 'Major', action: 'priority' },
      { field: 'assignee', from: undefined, to: 'Ben', action: 'assignee' },
      { field: 'labels', text: '+b', action: 'labels' },
      { field: 'description', text: 'edited', action: 'description' },
    ]);
    expect(parseChangeLines('nothing useful')).toEqual([]);
    expect(parseChangeLines('Assignee: Ben \u2192 (none)')[0]).toEqual({
      field: 'assignee',
      from: 'Ben',
      to: undefined,
      action: 'unassigned',
    });
  });
  it('keeps every change of an update in order, status included', () => {
    const body = 'Priority: A \u2192 B\nStatus: To Do \u2192 Done\nSprint: S1 \u2192 S2';
    const s = d('issue-update', body);
    expect(s.verb).toBe('updated 3 fields');
    expect(s.changes?.map((c) => c.field)).toEqual(['status', 'priority', 'sprint']);
    expect(describeEventAria(s)).toBe(
      'Ann changed status from To Do to Done, priority from A to B, sprint from S1 to S2',
    );
  });
  it('extracts old and new status for status changes', () => {
    const p = d('issue-update', 'Status: To Do \u2192 In Progress');
    expect(p.verb).toBe('changed status');
    expect(p.changes?.[0]).toMatchObject({ field: 'status', from: 'To Do', to: 'In Progress' });
    const q = d('issue-update', 'Status: \u2192 Done');
    expect(q.changes?.[0].from).toBeUndefined();
    expect(q.changes?.[0].to).toBe('Done');
  });
  it('diffs Jira labels into +added \u2212removed', () => {
    expect(parseChangeLines('Labels: a b \u2192 b c')[0]).toMatchObject({ text: '+c \u2212a' });
  });
  it('keeps single-word names and drops empty actors', () => {
    expect(d('jira-comment', 'x', 'J.Smith').actor).toBe('J.Smith');
    expect(d('jira-comment', 'x', '').actor).toBeUndefined();
  });
  it('keeps snippets only for comment-like events, on one line', () => {
    expect(d('jira-comment', 'a\nb\n\n c').snippet).toBe('a b c');
    expect(d('issue-assignment').snippet).toBe('');
  });
  it('builds an aria phrase with the actor', () => {
    expect(describeEventAria(d('issue-assignment'))).toBe('Ann assigned you');
    expect(describeEventAria(d('comment-mention'))).toBe('Ann mentioned you');
    expect(describeEventAria(d('pipeline-failure'))).toBe('Pipeline failed');
    expect(describeEventAria(d('issue-update', 'Status: To Do \u2192 Done'))).toBe(
      'Ann changed status from To Do to Done',
    );
  });
});

describe('event colour map', () => {
  const types = [
    'comment-mention',
    'issue-update',
    'mr-note',
    'gitlab-mention',
    'jira-comment',
    'mr-approval',
    'pipeline-failure',
    'issue-assignment',
    'due-date-reminder',
  ] as const;
  it('covers every notification type with a glyph, badge and light+dark text colour', () => {
    for (const t of types) {
      const st = EVENT_STYLE[t];
      expect(st, t).toBeDefined();
      expect(st.Icon).toBeTruthy();
      expect(st.badge).toMatch(/^bg-/);
      expect(st.text).toMatch(/dark:text-/);
    }
  });
  it('maps the chosen hues', () => {
    expect(EVENT_STYLE['comment-mention'].badge).toContain('violet');
    expect(EVENT_STYLE['jira-comment'].badge).toContain('blue');
    expect(EVENT_STYLE['issue-assignment'].badge).toContain('teal');
    expect(EVENT_STYLE['mr-approval'].badge).toContain('emerald');
    expect(EVENT_STYLE['pipeline-failure'].badge).toContain('red');
    expect(EVENT_STYLE['due-date-reminder'].badge).toContain('amber');
  });
  it('upgrades status changes to the amber status style', () => {
    const item = makeItem({
      id: 's',
      notificationType: 'issue-update',
      bodyPreview: 'Status: A \u2192 B',
    });
    expect(eventStyleFor(item, describeEventParts(item)).kind).toBe('status');
    const plain = makeItem({ id: 'p', notificationType: 'issue-update', bodyPreview: 'x' });
    expect(eventStyleFor(plain, describeEventParts(plain)).kind).toBe('update');
  });
  it('guesses status categories', () => {
    expect(statusCategoryGuess('Done')).toBe('done');
    expect(statusCategoryGuess('To Do')).toBe('new');
    expect(statusCategoryGuess('In Review')).toBe('indeterminate');
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
  const base = { source: 'all' as const, unreadOnly: false, now: NOW };

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
  });

  const sameEntity = [
    jira('a', 'PROJ-1', local(10, 10, 9)),
    jira('b', 'PROJ-1', local(10, 10, 11)),
    jira('c', 'PROJ-2', local(10, 10, 10)),
  ];

  it('never groups: every notification is its own event, newest first', () => {
    const e = buildEntries({ ...base, items: sameEntity, readSet: new Set(['a']) });
    expect(e.map((x) => x.id)).toEqual(['header:today', 'event:b', 'event:c', 'event:a']);
    const a = e[3];
    expect(a.kind === 'event' && a.isUnread).toBe(false);
    expect(e.some((x) => (x.kind as string) === 'group')).toBe(false);
  });

  it('puts each notification under the header of its own bucket', () => {
    const items = [jira('a', 'PROJ-1', local(10, 10, 9)), jira('b', 'PROJ-1', local(10, 1, 9))];
    const e = buildEntries({ ...base, items, readSet: new Set() });
    expect(e.map((x) => x.id)).toEqual(['header:today', 'event:a', 'header:older', 'event:b']);
  });

  it('orders buckets', () => {
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

  it('excludes read events when unreadOnly', () => {
    const e = buildEntries({
      ...base,
      unreadOnly: true,
      items: sameEntity,
      readSet: new Set(['a']),
    });
    expect(e.map((x) => x.id)).toContain('event:b');
    expect(e.map((x) => x.id)).not.toContain('event:a');
  });

  it('produces unique prefixed ids', () => {
    const e = buildEntries({ ...base, items: sameEntity, readSet: new Set() });
    const ids = e.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of e)
      expect(x.id.startsWith(`${x.kind === 'header' ? 'header' : x.kind}:`)).toBe(true);
  });
});

describe('isFocusableEntry', () => {
  it('only events are focusable', () => {
    const items = [jira('a', 'PROJ-1', local(10, 10, 9))];
    const e = buildEntries({
      items,
      readSet: new Set(),
      source: 'all',
      unreadOnly: false,
      now: NOW,
    });
    expect(isFocusableEntry(e[0])).toBe(false);
    expect(isFocusableEntry(e[1])).toBe(true);
  });
});

describe('GitLab system notes', () => {
  it('parses every service-emitted system format', () => {
    const cases: [string, object][] = [
      ['State: opened \u2192 merged', { field: 'merged', action: 'merged' }],
      ['State: opened \u2192 closed', { field: 'closed', action: 'closed' }],
      ['State: closed \u2192 reopened', { field: 'reopened', action: 'reopened' }],
      ['Review requested: ana, ben', { field: 'review', to: 'ana, ben', action: 'review' }],
      ['Review removed: ana', { field: 'review', text: '\u2212ana', action: 'unreview' }],
      ['Labels added: x, y', { field: 'labels', text: '+x +y', action: 'labels' }],
      ['Labels removed: x', { field: 'labels', text: '\u2212x', action: 'labels' }],
      ['Assigned: ana', { field: 'assignee', to: 'ana', action: 'assignee' }],
      ['Unassigned: ana', { field: 'assignee', text: '\u2212ana', action: 'unassigned' }],
      ['Assignee: removed', { field: 'assignee', text: 'removed', action: 'unassigned' }],
      ['Title: a \u2192 b', { field: 'title', from: 'a', to: 'b', action: 'title' }],
      ['Description: updated', { field: 'description', text: 'edited', action: 'description' }],
      [
        'Target branch: a \u2192 b',
        { field: 'target branch', from: 'a', to: 'b', action: 'branch' },
      ],
      ['Milestone: v1.14', { field: 'milestone', to: 'v1.14', action: 'milestone' }],
      ['Milestone: removed', { field: 'milestone', text: 'removed', action: 'milestone' }],
      ['Auto-merge: enabled', { field: 'auto-merge', text: 'enabled', action: 'automerge' }],
    ];
    for (const [line, expected] of cases) {
      expect(parseGitlabSystemLine(line), line).toEqual(expected);
    }
    expect(parseGitlabSystemLine('something else')).toBeNull();
  });

  it('describeEventParts treats system notes as changes, not comments', () => {
    const parts = describeEventParts({
      id: 'gitlab-system-5',
      source: 'gitlab',
      entityTitle: 'Add export',
      author: 'Ana Lee',
      bodyPreview: 'State: opened \u2192 merged',
      fullBody: '',
      createdAt: '2026-03-11T10:00:00.000Z',
      notificationType: 'mr-note',
    });
    expect(parts.verb).toBe('merged');
    expect(parts.commentText).toBeUndefined();
    expect(parts.changes).toHaveLength(1);
  });
});

describe('action styles', () => {
  it('every action key has a style and the fields map to one', () => {
    for (const k of Object.keys(ACTION_STYLE) as ActionKey[]) {
      expect(ACTION_STYLE[k].kind).toBe(k);
      expect(ACTION_STYLE[k].badge).toMatch(/^bg-/);
      expect(ACTION_STYLE[k].text).toMatch(/^text-/);
    }
    for (const f of ['priority', 'sprint', 'fix version', 'due date', 'type', 'story points']) {
      expect(actionKeyForField(f), f).toBeDefined();
    }
  });
});

describe('merging', () => {
  const base = { source: 'all' as const, unreadOnly: false, now: NOW };
  const at = (h: number, min: number) => local(10, 10, h, min);
  const com = (
    id: string,
    key: string,
    who: string,
    h: number,
    min: number,
    type = 'jira-comment',
  ) => jira(id, key, at(h, min), { author: who, notificationType: type as never, bodyPreview: id });
  const upd = (id: string, key: string, who: string, h: number, min: number, body: string) =>
    jira(id, key, at(h, min), {
      author: who,
      notificationType: 'issue-update',
      bodyPreview: body,
    });
  const run = (
    items: NotificationItem[],
    extra: Partial<Parameters<typeof buildEntries>[0]> = {},
  ) =>
    buildEntries({ ...base, items, readSet: new Set(), ...extra }).filter(
      (e) => e.kind === 'event',
    );
  const ids = (items: NotificationItem[]) =>
    run(items).map((e) => (e.kind === 'event' ? e.items.map((i) => i.id) : []));

  it('merges consecutive same-actor same-category items within 60 minutes (chain)', () => {
    const items = [
      com('c1', 'PROJ-1', 'Ben', 8, 0),
      com('c2', 'PROJ-1', 'Ben', 8, 50),
      com('c3', 'PROJ-1', 'Ben', 9, 40),
    ];
    expect(ids(items)).toEqual([['c3', 'c2', 'c1']]);
    const e = run(items)[0];
    expect(e.kind === 'event' && e.item.id).toBe('c3');
    expect(e.id).toBe('event:c3');
  });

  it('breaks on a gap over 60 minutes', () => {
    expect(ids([com('c1', 'PROJ-1', 'Ben', 8, 0), com('c2', 'PROJ-1', 'Ben', 9, 1)])).toEqual([
      ['c2'],
      ['c1'],
    ]);
  });

  it('breaks when another actor commented on that entity in between', () => {
    const items = [
      com('c1', 'PROJ-1', 'Ben', 8, 0),
      com('x', 'PROJ-1', 'Cara', 8, 10),
      com('c2', 'PROJ-1', 'Ben', 8, 20),
    ];
    expect(ids(items)).toEqual([['c2'], ['x'], ['c1']]);
  });

  it('events on other entities in between do not break a run', () => {
    const items = [
      com('c1', 'PROJ-1', 'Ben', 8, 0),
      com('o', 'PROJ-2', 'Cara', 8, 10),
      com('c2', 'PROJ-1', 'Ben', 8, 20),
    ];
    expect(ids(items)).toEqual([['c2', 'c1'], ['o']]);
  });

  it('never merges across actors, sources, entities or time buckets', () => {
    expect(ids([com('a', 'PROJ-1', 'Ben', 8, 0), com('b', 'PROJ-1', 'Cara', 8, 5)])).toHaveLength(
      2,
    );
    expect(ids([com('a', 'PROJ-1', 'Ben', 8, 0), com('b', 'PROJ-2', 'Ben', 8, 5)])).toHaveLength(2);
    const y = jira('y', 'PROJ-1', new Date(2026, 9, 9, 23, 50).toISOString(), {
      author: 'Ben',
      notificationType: 'jira-comment',
    });
    const t = jira('t', 'PROJ-1', new Date(2026, 9, 10, 0, 10).toISOString(), {
      author: 'Ben',
      notificationType: 'jira-comment',
    });
    const e = buildEntries({
      ...base,
      now: new Date(2026, 9, 10, 12).getTime(),
      items: [y, t],
      readSet: new Set(),
    });
    expect(e.map((x) => x.kind)).toEqual(['header', 'event', 'header', 'event']);
  });

  it('never merges a comment with an update, or assignment/approval/pipeline/due items', () => {
    expect(
      ids([
        com('c', 'PROJ-1', 'Ben', 8, 0),
        upd('u', 'PROJ-1', 'Ben', 8, 5, 'Priority: A \u2192 B'),
      ]),
    ).toHaveLength(2);
    for (const type of [
      'issue-assignment',
      'mr-approval',
      'pipeline-failure',
      'due-date-reminder',
    ]) {
      const mk = (id: string, min: number) =>
        jira(id, 'PROJ-1', at(8, min), { author: 'Ben', notificationType: type as never });
      expect(ids([mk('a', 0), mk('b', 5)]), type).toHaveLength(2);
      expect(mergeCategory(mk('a', 0)), type).toBeNull();
    }
  });

  it('merges GitLab MRs by project + iid and keeps MR state changes separate', () => {
    const sys = (id: string, min: number, body: string, iid = 5) =>
      makeItem({
        id: `gitlab-system-${id}`,
        source: 'gitlab',
        entityTitle: 'Add export',
        author: 'Ana',
        mrProjectId: 1,
        mrIid: iid,
        notificationType: 'mr-note',
        bodyPreview: body,
        createdAt: at(8, min),
      });
    const labels = [sys('1', 0, 'Labels added: a'), sys('2', 10, 'Labels added: b')];
    expect(ids(labels)).toEqual([['gitlab-system-2', 'gitlab-system-1']]);
    expect(
      ids([sys('1', 0, 'Labels added: a'), sys('2', 10, 'State: opened \u2192 merged')]),
    ).toHaveLength(2);
    expect(ids([sys('1', 0, 'Labels added: a'), sys('2', 10, 'Labels added: b', 6)])).toHaveLength(
      2,
    );
    const parts = describeEntryParts(
      run(labels)[0].kind === 'event'
        ? (run(labels)[0] as never as { items: NotificationItem[] }).items
        : [],
    );
    // single-sided label change: verb says "added labels", chips drop the + sign
    expect(parts.verb).toBe('added labels');
    expect(parts.changes).toEqual([{ field: 'labels', text: 'a b', action: 'labels' }]);
  });

  it('conversation merge: latest text, count verb, every comment listed newest first', () => {
    const e = run([
      com('c1', 'PROJ-1', 'Ben Carter', 8, 0),
      com('c2', 'PROJ-1', 'Ben Carter', 8, 10),
      com('c3', 'PROJ-1', 'Ben Carter', 8, 20),
    ])[0];
    const p = describeEntryParts((e as { items: NotificationItem[] }).items);
    expect(p.verb).toBe('commented 3 times');
    expect(p.commentText).toBe('c3');
    expect(p.comments?.map((c) => c.text)).toEqual(['c3', 'c2', 'c1']);
    expect(p.comments?.every((c) => !c.mention)).toBe(true);
    expect(p.actor).toBe('Ben');
    expect(describeEventAria(p)).toBe('Ben commented 3 times');
  });

  it('promotes to "mentioned you" when any item is a mention', () => {
    const e = run([
      com('c1', 'PROJ-1', 'Ben', 8, 0),
      com('c2', 'PROJ-1', 'Ben', 8, 10, 'comment-mention'),
    ])[0];
    const p = describeEntryParts((e as { items: NotificationItem[] }).items);
    expect(p).toMatchObject({ verb: 'mentioned you in 2 comments', promoted: true });
    expect(p.comments?.map((c) => c.mention)).toEqual([true, false]);
    expect(eventStyleFor((e as { item: NotificationItem }).item, p).kind).toBe('mention');
  });

  it('change merge collapses a field to first-from -> last-to and drops no-ops', () => {
    const items = [
      upd('u1', 'PROJ-1', 'Ana', 8, 0, 'Priority: Minor \u2192 Major\nSprint: S1 \u2192 S2'),
      upd('u2', 'PROJ-1', 'Ana', 8, 10, 'Priority: Major \u2192 Critical'),
      upd('u3', 'PROJ-1', 'Ana', 8, 20, 'Sprint: S2 \u2192 S1\nLabels: a \u2192 a perf'),
    ];
    const e = run(items)[0];
    expect((e as { items: unknown[] }).items).toHaveLength(3);
    const p = describeEntryParts((e as { items: NotificationItem[] }).items);
    expect(p.changes).toEqual([
      { field: 'priority', from: 'Minor', to: 'Critical', action: 'priority' },
      { field: 'labels', text: '+perf', action: 'labels' },
    ]);
    expect(p.verb).toBe('updated 2 fields');
  });

  it('a single resulting change keeps its specific verb and style', () => {
    const items = [
      upd('u1', 'PROJ-1', 'Ana', 8, 0, 'Priority: Minor \u2192 Major'),
      upd('u2', 'PROJ-1', 'Ana', 8, 10, 'Priority: Major \u2192 Critical'),
    ];
    const e = run(items)[0] as { items: NotificationItem[]; item: NotificationItem };
    const p = describeEntryParts(e.items);
    expect(p.verb).toBe('changed priority');
    expect(eventStyleFor(e.item, p).kind).toBe('priority');
  });

  it('mergeChanges nets labels, dedupes descriptions and re-derives unassign', () => {
    const out = mergeChanges([
      [
        { field: 'labels', text: '+a', action: 'labels' },
        { field: 'description', text: 'edited', action: 'description' },
      ],
      [
        { field: 'labels', text: '\u2212a +b', action: 'labels' },
        { field: 'description', text: 'edited', action: 'description' },
      ],
      [{ field: 'assignee', from: 'Ben', to: 'Cara', action: 'assignee' }],
      [{ field: 'assignee', from: 'Cara', action: 'unassigned' }],
    ]);
    expect(out).toEqual([
      { field: 'labels', text: '+b', action: 'labels' },
      { field: 'description', text: 'edited', action: 'description' },
      { field: 'assignee', from: 'Ben', to: undefined, action: 'unassigned' },
    ]);
    expect(
      mergeChanges([
        [{ field: 'sprint', from: 'A', to: 'B' }],
        [{ field: 'sprint', from: 'B', to: 'A' }],
      ]),
    ).toEqual([]);
  });

  it('orders changes status, assignee, priority, sprint, version, labels, others, description', () => {
    const c = (field: string) => ({ field, action: actionKeyForField(field) });
    expect(
      orderChanges(
        [
          'description',
          'labels',
          'estimate',
          'fix version',
          'sprint',
          'priority',
          'assignee',
          'status',
        ].map(c),
      ).map((x) => x.field),
    ).toEqual([
      'status',
      'assignee',
      'priority',
      'sprint',
      'fix version',
      'labels',
      'estimate',
      'description',
    ]);
  });

  it('entry is unread when ANY item is unread; unreadOnly keeps partly-read runs', () => {
    const items = [com('c1', 'PROJ-1', 'Ben', 8, 0), com('c2', 'PROJ-1', 'Ben', 8, 10)];
    const some = buildEntries({ ...base, items, readSet: new Set(['c2']) });
    expect(some[1].kind === 'event' && some[1].isUnread).toBe(true);
    const all = buildEntries({ ...base, items, readSet: new Set(['c1', 'c2']) });
    expect(all[1].kind === 'event' && all[1].isUnread).toBe(false);
    expect(
      buildEntries({ ...base, items, readSet: new Set(['c1', 'c2']), unreadOnly: true }),
    ).toEqual([]);
    const partly = buildEntries({ ...base, items, readSet: new Set(['c2']), unreadOnly: true });
    expect(partly[1].kind === 'event' && partly[1].items).toHaveLength(2);
  });

  it('estimates taller cards for multi-change and merged entries', () => {
    const [single] = run([com('c', 'PROJ-9', 'Zed', 8, 0)]);
    const [multi] = run([
      upd(
        'u',
        'PROJ-8',
        'Ana',
        8,
        0,
        'Status: A \u2192 B\nPriority: A \u2192 B\nSprint: A \u2192 B\nLabels: a \u2192 a b',
      ),
    ]);
    expect(estimateEntryHeight(multi)).toBeGreaterThan(estimateEntryHeight(single));
    expect(estimateEntryHeight({ kind: 'header', id: 'h', bucket: 'today', label: 'Today' })).toBe(
      32,
    );
  });

  it('adds the quick-action row to the estimate only for cards that have one', () => {
    const [withQuick] = run([com('c', 'PROJ-9', 'Zed', 8, 0)]);
    const [plain] = run([upd('u', 'PROJ-8', 'Ana', 8, 0, 'Priority: A \u2192 B')]);
    expect(estimateEntryHeight(withQuick)).toBe(EST_CARD_BASE + EST_CARD_GAP + EST_QUICK_ROW);
    expect(estimateEntryHeight(plain)).toBe(EST_CARD_BASE + EST_CARD_GAP);
  });
});

describe('commentPreview', () => {
  it('ends a server-truncated preview with an ellipsis when the full body continues it', () => {
    expect(
      commentPreview({
        bodyPreview: 'We saw a one cent mismatch on',
        fullBody: 'We saw a one cent mismatch on invoices.',
      }),
    ).toBe('We saw a one cent mismatch on\u2026');
  });
  it('leaves complete previews alone', () => {
    expect(commentPreview({ bodyPreview: 'Done.', fullBody: 'Done.' })).toBe('Done.');
    expect(commentPreview({ bodyPreview: 'Short', fullBody: '' })).toBe('Short');
  });
  it('does not add an ellipsis when the full body is unrelated text', () => {
    expect(commentPreview({ bodyPreview: 'Due tomorrow', fullBody: 'Example body text' })).toBe(
      'Due tomorrow',
    );
  });
});

describe('list cap (shared by cards and the height estimate)', () => {
  it('shows up to 10 items in full; beyond that 9 + a "+N more" row (N >= 2)', () => {
    expect(MAX_LIST_ROWS).toBe(10);
    for (const n of [1, 4, 10]) {
      expect(visibleCount(n)).toBe(n);
      expect(listRowCount(n)).toBe(n);
    }
    expect(visibleCount(11)).toBe(9);
    expect(listRowCount(11)).toBe(10);
    expect(visibleCount(40)).toBe(9);
    expect(listRowCount(40)).toBe(10);
  });
});

describe('countUnreadCards', () => {
  it('counts merged runs once and skips fully-read cards', () => {
    const now = new Date(2026, 10, 10, 15, 0).getTime();
    const t = (min: number) => new Date(2026, 10, 10, 14, min).toISOString();
    const c = (id: string, key: string, min: number, author = 'Ben Carter') =>
      jira(id, key, t(min), { author, notificationType: 'jira-comment', bodyPreview: id });
    // Ben x3 on PROJ-1 (one card), Ana on PROJ-2, Cara on PROJ-3 (read)
    const items = [
      c('a', 'PROJ-1', 0),
      c('b', 'PROJ-1', 10),
      c('c', 'PROJ-1', 20),
      c('d', 'PROJ-2', 30, 'Ana'),
      c('e', 'PROJ-3', 40, 'Cara'),
    ];
    expect(countUnreadCards(items, new Set(['e']), 'all', now)).toBe(2);
    expect(countUnreadCards(items, new Set(['e']), 'gitlab', now)).toBe(0);
  });
});

describe('CR-01: one Jira comment returned by two queries', () => {
  const base = { source: 'all' as const, unreadOnly: false, now: NOW };
  const at = local(10, 10, 12);
  const mention = jira('jira-comment-501', 'PROJ-7', at, {
    author: 'Ben Carter',
    notificationType: 'comment-mention',
    bodyPreview: 'Hey [~me] look',
    fullBody: 'Hey [~me] look',
  });
  const plain = {
    ...mention,
    id: 'jira-allcomment-501',
    notificationType: 'jira-comment' as const,
  };
  const events = (items: NotificationItem[], readSet = new Set<string>()) =>
    buildEntries({ ...base, items, readSet }).filter((e): e is EventEntry => e.kind === 'event');

  it('renders a single mention card, not "mentioned you in 2 comments"', () => {
    const e = events([plain, mention]);
    expect(e).toHaveLength(1);
    expect(e[0].items.map((i) => i.id)).toEqual(['jira-comment-501']);
    const parts = describeEntryParts(e[0].items);
    expect(parts.verb).toBe('mentioned you');
    expect(parts.count).toBeUndefined();
  });

  it('keeps the mention even when the plain copy sorts first', () => {
    const e = events([mention, plain]);
    expect(e).toHaveLength(1);
    expect(e[0].item.notificationType).toBe('comment-mention');
  });

  it('read / Done act on both stored copies', () => {
    const e = events([plain, mention]);
    expect(entryIds(e[0]).sort()).toEqual(['jira-allcomment-501', 'jira-comment-501']);
  });

  it('a comment is read when either copy is read; counted once', () => {
    expect(events([plain, mention], new Set(['jira-allcomment-501']))[0].isUnread).toBe(false);
    expect(countUnreadCards([plain, mention], new Set(), 'all', NOW)).toBe(1);
  });

  it('a lone plain copy still renders as a comment', () => {
    const e = events([plain]);
    expect(e).toHaveLength(1);
    expect(describeEntryParts(e[0].items).verb).toBe('commented');
    expect(entryIds(e[0])).toEqual(['jira-allcomment-501']);
  });
});

describe('CR-02: multi-word GitLab labels stay one label', () => {
  const NB = '\u00A0';
  const sys = (id: string, body: string, min: number): NotificationItem => ({
    id,
    source: 'gitlab',
    entityTitle: 'Add export',
    author: 'Ana Lee',
    bodyPreview: body,
    fullBody: body,
    createdAt: local(10, 10, 12, min),
    notificationType: 'mr-note',
    mrProjectId: 5,
    mrIid: 9,
  });

  it('single card: "added labels" with the spaced label as one token', () => {
    const parts = describeEventParts(sys('gitlab-system-1', 'Labels added: needs review, bug', 0));
    expect(parts.verb).toBe('added labels');
    expect(parts.singleMode).toBe('added');
    expect(parts.changes?.[0].text).toBe(`needs${NB}review bug`);
  });

  it('merged card: three labels, not four', () => {
    const items = [
      sys('gitlab-system-2', 'Labels added: ux', 5),
      sys('gitlab-system-1', 'Labels added: needs review, bug', 0),
    ];
    const parts = describeEntryParts(items);
    expect(parts.verb).toBe('added labels');
    expect(parts.changes?.[0].text).toBe(`needs${NB}review bug ux`);
    expect(parts.changes?.[0].text?.split(' ')).toHaveLength(3);
  });

  it('merged add + remove of a spaced label nets out', () => {
    const items = [
      sys('gitlab-system-2', 'Labels removed: needs review', 5),
      sys('gitlab-system-1', 'Labels added: needs review, bug', 0),
    ];
    expect(describeEntryParts(items).changes?.[0].text).toBe('bug');
  });
});

describe('CR-03: merging multi-value field changes keeps every value', () => {
  const fv = (from?: string, to?: string) => ({
    field: 'fix version',
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    action: 'version' as const,
  });

  it('two additions to Fix Version both survive', () => {
    const out = mergeChanges([[fv(undefined, '1.0')], [fv(undefined, '1.1')]]);
    expect(out.map((c) => c.to)).toEqual(['1.0', '1.1']);
  });

  it('two removals from Fix Version both survive', () => {
    const out = mergeChanges([[fv('1.0')], [fv('1.1')]]);
    expect(out.map((c) => c.from)).toEqual(['1.0', '1.1']);
  });

  it('a real chain still collapses to first-from -> last-to', () => {
    expect(
      mergeChanges([
        [{ field: 'priority', from: 'Low', to: 'High' }],
        [{ field: 'priority', from: 'High', to: 'Blocker' }],
      ]),
    ).toEqual([{ field: 'priority', from: 'Low', to: 'Blocker' }]);
  });

  it('add then remove of the same version nets out', () => {
    expect(mergeChanges([[fv(undefined, '1.0')], [fv('1.0')]])).toEqual([]);
  });

  it('merged Jira updates on one card list both versions', () => {
    const at = (min: number) => local(10, 10, 12, min);
    const upd = (id: string, min: number, body: string) =>
      jira(id, 'PROJ-3', at(min), {
        author: 'Cara',
        notificationType: 'issue-update',
        bodyPreview: body,
      });
    const parts = describeEntryParts([
      upd('u2', 10, 'Fix Version: (none) → 1.1'),
      upd('u1', 0, 'Fix Version: (none) → 1.0'),
    ]);
    expect(parts.changes?.map((c) => c.to)).toEqual(['1.0', '1.1']);
  });

  it('GitLab: two "Assigned" notes keep both assignees', () => {
    const out = mergeChanges([
      [{ field: 'assignee', to: 'ana', action: 'assignee' }],
      [{ field: 'assignee', to: 'ben', action: 'assignee' }],
    ]);
    expect(out.map((c) => c.to)).toEqual(['ana', 'ben']);
  });
});

describe('WR-01: GitLab system notes parse from the untruncated body', () => {
  const note = (body: string, id = 'gitlab-system-77', min = 0): NotificationItem => ({
    id,
    source: 'gitlab',
    entityTitle: 'Add export',
    author: 'Ana Lee',
    bodyPreview: body.substring(0, 120),
    fullBody: body,
    createdAt: local(10, 10, 12, min),
    notificationType: 'mr-note',
    mrProjectId: 5,
    mrIid: 9,
  });
  const oldTitle = `Old ${'a'.repeat(66)}`;
  const newTitle = `New ${'b'.repeat(66)}`;

  it('keeps the whole new title', () => {
    const parts = describeEventParts(note(`Title: ${oldTitle} → ${newTitle}`));
    expect(parts.changes?.[0]).toMatchObject({ field: 'title', from: oldTitle, to: newTitle });
  });

  it('a long old title still parses (arrow past the 120-char cut) and still merges', () => {
    const longOld = 'x'.repeat(115);
    const item = note(`Title: ${longOld} → short`);
    expect(describeEventParts(item).verb).toBe('changed title');
    expect(mergeCategory(item)).toBe('changes');
  });

  it('keeps the last label of a long label list (single and merged)', () => {
    const labels = Array.from({ length: 14 }, (_, i) => `label-${i}`);
    const item = note(`Labels added: ${labels.join(', ')}`);
    expect(describeEventParts(item).changes?.[0].text?.split(' ')).toHaveLength(14);
    const merged = describeEntryParts([note('Labels added: extra', 'gitlab-system-78', 5), item]);
    expect(merged.changes?.[0].text?.split(' ')).toHaveLength(15);
  });
});

describe('stackEntries', () => {
  const base = { source: 'all' as const, unreadOnly: false, now: NOW };
  const build = (items: NotificationItem[], read: string[] = []) =>
    buildEntries({ ...base, items, readSet: new Set(read) });
  const three = [
    jira('a', 'PROJ-1', local(10, 10, 9), { author: 'Ana Lee' }),
    jira('b', 'PROJ-1', local(10, 10, 11), { author: 'Ben Ito' }),
    jira('c', 'PROJ-2', local(10, 10, 10), { author: 'Cara Doe' }),
    jira('d', 'PROJ-1', local(10, 10, 12), { author: 'Cara Doe' }),
  ];

  it('collapses 2+ cards of one entity into one stack at the newest position, newest first', () => {
    const out = stackEntries(build(three), new Set());
    expect(out.map((x) => x.id)).toEqual(['header:today', 'stack:jira:PROJ-1', 'event:c']);
    const s = out[1];
    expect(s.kind).toBe('stack');
    if (s.kind !== 'stack') return;
    expect(s.cards.map((c) => c.item.id)).toEqual(['d', 'b', 'a']);
    expect(s.more).toBe(2);
    expect(s.isUnread).toBe(true);
  });

  it('isUnread is false when every card is read', () => {
    const out = stackEntries(build(three, ['a', 'b', 'c', 'd']), new Set());
    const s = out[1];
    expect(s.kind === 'stack' && s.isUnread).toBe(false);
  });

  it('drops bucket headers left empty after stacking', () => {
    const items = [
      jira('a', 'PROJ-1', local(10, 10, 9), { author: 'Ana Lee' }),
      jira('b', 'PROJ-1', local(10, 1, 9), { author: 'Ben Ito' }),
    ];
    const entries = build(items);
    expect(entries.map((x) => x.kind)).toEqual(['header', 'event', 'header', 'event']);
    const out = stackEntries(entries, new Set());
    expect(out.map((x) => x.id)).toEqual(['header:today', 'stack:jira:PROJ-1']);
  });

  it('expanded: stack-header followed by member events with unchanged ids', () => {
    const out = stackEntries(build(three), new Set(['jira:PROJ-1']));
    expect(out.map((x) => x.id)).toEqual([
      'header:today',
      'stack-header:jira:PROJ-1',
      'event:d',
      'event:b',
      'event:a',
      'event:c',
    ]);
  });

  it('never stacks single cards or cards without an entity key', () => {
    const items = [
      makeItem({ id: 'x', entityTitle: 'Loose one', createdAt: local(10, 10, 9) }),
      makeItem({ id: 'y', entityTitle: 'Loose two', createdAt: local(10, 10, 10) }),
      jira('z', 'PROJ-5', local(10, 10, 11)),
    ];
    expect(entityKey(items[0])).toBeNull();
    const out = stackEntries(build(items), new Set());
    expect(out.map((x) => x.kind)).toEqual(['header', 'event', 'event', 'event']);
  });

  it('stackIds include duplicate comment copies', () => {
    const items = [
      jira('jira-comment-1', 'PROJ-1', local(10, 10, 9), { author: 'Ana Lee' }),
      jira('jira-allcomment-1', 'PROJ-1', local(10, 10, 9), { author: 'Ana Lee' }),
      jira('jira-comment-2', 'PROJ-1', local(10, 10, 11), { author: 'Ben Ito' }),
    ];
    const out = stackEntries(build(items), new Set());
    const s = out[1];
    expect(s.kind).toBe('stack');
    if (s.kind !== 'stack') return;
    expect(stackIds(s).sort()).toEqual(['jira-allcomment-1', 'jira-comment-1', 'jira-comment-2']);
  });

  it('countUnreadCards still counts cards, not stacks', () => {
    expect(countUnreadCards(three, new Set(), 'all', NOW)).toBe(4);
  });

  it('estimate and focusability for stack kinds', () => {
    const out = stackEntries(build(three), new Set());
    const s = out[1];
    if (s.kind !== 'stack') throw new Error('stack expected');
    expect(estimateEntryHeight(s)).toBe(estimateEntryHeight(s.cards[0]) + EST_STACK_PEEK);
    expect(isFocusableEntry(s)).toBe(true);
    const h = stackEntries(build(three), new Set(['jira:PROJ-1']))[1];
    expect(estimateEntryHeight(h)).toBe(28);
    expect(isFocusableEntry(h)).toBe(false);
  });
});

describe('quickActionFor', () => {
  const qa = (over: Partial<NotificationItem> & { id: string }) => {
    const item = makeItem(over);
    return quickActionFor(item, describeEventParts(item));
  };
  const gl = { source: 'gitlab' as const, mrProjectId: 3, mrIid: 9, entityTitle: 'Fix MR' };

  it('Jira comment and mention -> Reply; nothing without an issue key', () => {
    expect(qa({ id: 'c', entityTitle: 'PROJ-1: T', notificationType: 'jira-comment' })?.kind).toBe(
      'reply-jira',
    );
    expect(
      qa({ id: 'm', entityTitle: 'PROJ-1: T', notificationType: 'comment-mention' })?.label,
    ).toBe('Reply');
    expect(qa({ id: 'x', entityTitle: 'No key', notificationType: 'jira-comment' })).toBeNull();
  });

  it('GitLab Reply / View pipeline need a safe URL', () => {
    const url = 'https://gitlab.example.com/x';
    expect(qa({ id: 'n', ...gl, notificationType: 'mr-note', url })?.kind).toBe('reply-gitlab');
    expect(qa({ id: 'n', ...gl, notificationType: 'gitlab-mention', url })?.kind).toBe(
      'reply-gitlab',
    );
    expect(
      qa({ id: 'n', ...gl, notificationType: 'mr-note', url: 'javascript:alert(1)' }),
    ).toBeNull();
    expect(qa({ id: 'n', ...gl, notificationType: 'mr-note' })).toBeNull();
    expect(qa({ id: 'p', ...gl, notificationType: 'pipeline-failure', url })?.label).toBe(
      'View pipeline',
    );
    expect(qa({ id: 'p', ...gl, notificationType: 'pipeline-failure', url: 'ftp://x' })).toBeNull();
  });

  it('Review only for a review-request system note with MR ids; Open MR for approvals', () => {
    const sys = { id: 'gitlab-system-1', ...gl, notificationType: 'mr-note' as const };
    expect(qa({ ...sys, bodyPreview: 'Review requested: cara' })?.kind).toBe('review');
    expect(qa({ ...sys, bodyPreview: 'Milestone: none → 4.2' })).toBeNull();
    expect(qa({ ...sys, bodyPreview: 'Review requested: cara', mrIid: undefined })).toBeNull();
    expect(qa({ id: 'a', ...gl, notificationType: 'mr-approval' })?.label).toBe('Open MR');
  });

  it('assignments and plain updates offer nothing', () => {
    expect(
      qa({ id: 'i', entityTitle: 'PROJ-1: T', notificationType: 'issue-assignment' }),
    ).toBeNull();
    expect(qa({ id: 'u', entityTitle: 'PROJ-1: T', notificationType: 'issue-update' })).toBeNull();
  });
});
