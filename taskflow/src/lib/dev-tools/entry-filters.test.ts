import { describe, expect, it } from 'vitest';
import type { NotificationDispatchLogEntry } from '../../stores/notification-dispatch-log.store';
import type { NotificationItem } from '../../stores/notifications.store';
import type { WikiEditorLogEntry } from '../../stores/wiki-editor-log.store';
import { filterEditorEntries, filterNotificationEntries } from './entry-filters';

const item = (entityTitle: string, parentKey?: string) =>
  ({ id: 'n', source: 'jira', entityTitle, parentKey }) as NotificationItem;

const notif = (
  id: string,
  p: Partial<NotificationDispatchLogEntry> & { title: string; body: string },
): NotificationDispatchLogEntry =>
  ({
    id,
    timestamp: '2026-11-19T10:00:00.000Z',
    item: item('PROJ-1: Title'),
    outcome: 'sent',
    ...p,
  }) as NotificationDispatchLogEntry;

describe('filterNotificationEntries', () => {
  const list = [
    notif('a', { title: 'PROJ-1 · Title', body: 'Cara: hi', outcome: 'error' }),
    notif('b', { title: 'Other', body: 'Dan: yo', item: item('ZZZ-9: Z', 'PAR-7') }),
    notif('c', {
      kind: 'summary',
      items: [item('QQQ-5: Q')],
      title: '4 new',
      body: '3 Jira',
      outcome: 'grouped',
    } as never),
  ];
  const none = { search: '', outcomes: new Set<string>() };

  it('empty filters return everything', () => {
    expect(filterNotificationEntries(list, none)).toHaveLength(3);
  });

  it('search covers title, body and issue keys (item, parent and summary items)', () => {
    const ids = (search: string) =>
      filterNotificationEntries(list, { ...none, search }).map((e) => e.id);
    expect(ids('cara')).toEqual(['a']);
    expect(ids('OTHER')).toEqual(['b']);
    expect(ids('zzz-9')).toEqual(['b']);
    expect(ids('par-7')).toEqual(['b']);
    expect(ids('qqq-5')).toEqual(['c']);
  });

  it('outcome facet', () => {
    expect(
      filterNotificationEntries(list, { ...none, outcomes: new Set(['error']) }).map((e) => e.id),
    ).toEqual(['a']);
  });
});

const ed = (id: string, p: Partial<WikiEditorLogEntry>): WikiEditorLogEntry => ({
  id,
  timestamp: '2026-11-19T10:00:00.000Z',
  session: 1,
  event: 'open',
  level: 'info',
  message: 'Editor opened',
  ...p,
});

describe('filterEditorEntries', () => {
  const list = [
    ed('1', {}),
    ed('2', {
      event: 'save-failed',
      level: 'error',
      message: "Couldn't save",
      context: { label: 'Description', issueKey: 'PROJ-1' },
    }),
    ed('3', { event: 'crash', level: 'warn', message: 'boom' }),
  ];
  const none = { search: '', levels: new Set<string>(), events: new Set<string>() };

  it('empty filters return everything', () => {
    expect(filterEditorEntries(list, none)).toHaveLength(3);
  });

  it('search covers message, event, context label and issue key', () => {
    const ids = (search: string) => filterEditorEntries(list, { ...none, search }).map((e) => e.id);
    expect(ids('opened')).toEqual(['1']);
    expect(ids('SAVE-FAILED')).toEqual(['2']);
    expect(ids('description')).toEqual(['2']);
    expect(ids('proj-1')).toEqual(['2']);
  });

  it('level and event facets combine', () => {
    expect(
      filterEditorEntries(list, { ...none, levels: new Set(['error', 'warn']) }).map((e) => e.id),
    ).toEqual(['2', '3']);
    expect(
      filterEditorEntries(list, {
        ...none,
        levels: new Set(['error', 'warn']),
        events: new Set(['crash']),
      }).map((e) => e.id),
    ).toEqual(['3']);
  });
});
