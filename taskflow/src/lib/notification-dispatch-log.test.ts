import { beforeEach, describe, expect, it } from 'vitest';
import { useNotificationDispatchLogStore } from '../stores/notification-dispatch-log.store';
import { useSettingsStore } from '../stores/settings.store';
import type { NotificationItem } from '../stores/notifications.store';
import {
  formatOsNotification,
  logOsDispatches,
  type OsDispatchLogEntry,
} from './notification-dispatch-log';

const item = (source: 'jira' | 'gitlab' = 'jira'): NotificationItem =>
  ({
    id: 'n1',
    source,
    entityTitle: 'PROJ-1: Title',
    author: 'Cara Doe',
    bodyPreview: 'body',
    fullBody: 'body',
    createdAt: '2026-11-11T10:00:00.000Z',
    notificationType: 'jira-comment',
  }) as NotificationItem;

const entry = (outcome: OsDispatchLogEntry['outcome']): OsDispatchLogEntry => ({
  item: item(),
  title: 'T',
  body: 'B',
  outcome,
});

beforeEach(() => {
  useSettingsStore.setState({ devToolsEnabled: true });
  useNotificationDispatchLogStore.getState().clear();
});

const logged = () => useNotificationDispatchLogStore.getState().entries;

describe('formatOsNotification', () => {
  it('formats jira and gitlab items', () => {
    expect(formatOsNotification(item())).toEqual({
      title: 'Jira — PROJ-1: Title',
      body: 'Cara Doe: body',
    });
    expect(formatOsNotification(item('gitlab')).title.startsWith('GitLab — ')).toBe(true);
  });
});

describe('logOsDispatches', () => {
  it('records nothing for no entries', () => {
    logOsDispatches([]);
    expect(logged()).toEqual([]);
  });

  it('records each entry with outcome, exact title/body and item; newest poll first', () => {
    logOsDispatches([entry('sent'), entry('skipped')]);
    logOsDispatches([entry('error')]);
    expect(logged().map((e) => e.outcome)).toEqual(['error', 'skipped', 'sent']);
    expect(logged()[2]).toEqual(
      expect.objectContaining({
        title: 'T',
        body: 'B',
        item: expect.objectContaining({ id: 'n1' }),
      }),
    );
    expect(new Set(logged().map((e) => e.id)).size).toBe(3);
  });

  it('records nothing when Developer Tools are off', () => {
    useSettingsStore.setState({ devToolsEnabled: false });
    logOsDispatches([entry('sent')]);
    expect(logged()).toEqual([]);
  });
});
