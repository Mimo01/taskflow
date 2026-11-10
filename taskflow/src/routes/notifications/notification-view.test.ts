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
  describeEventParts,
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
    expect(s.verb).toBe('changed priority');
    expect(s.changes?.map((c) => c.field)).toEqual(['priority', 'status', 'sprint']);
    expect(describeEventAria(s)).toBe(
      'Ann changed priority from A to B, status from To Do to Done, sprint from S1 to S2',
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
      ['Labels added: x, y', { field: 'labels', text: '+x, y', action: 'labels' }],
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
