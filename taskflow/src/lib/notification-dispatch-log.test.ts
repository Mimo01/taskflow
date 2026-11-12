import { afterEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function spies() {
  return {
    group: vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {}),
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    end: vi.spyOn(console, 'groupEnd').mockImplementation(() => {}),
  };
}

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
  it('logs nothing for no entries', () => {
    const s = spies();
    logOsDispatches([]);
    expect(s.group).not.toHaveBeenCalled();
  });

  it('logs one collapsed group with a line per entry', () => {
    const s = spies();
    logOsDispatches([entry('sent'), entry('sent'), entry('skipped')]);
    expect(s.group).toHaveBeenCalledTimes(1);
    expect(s.group).toHaveBeenCalledWith('[notifications] 2 dispatched, 1 skipped');
    expect(s.log).toHaveBeenCalledTimes(3);
    expect(s.end).toHaveBeenCalledTimes(1);
    expect(s.log.mock.calls[0]).toEqual(['sent', 'T', 'B', expect.objectContaining({ id: 'n1' })]);
    expect(s.log.mock.calls[2]?.[0]).toBe('skipped (already known)');
  });

  it('counts denied and error as dispatched and shows the result', () => {
    const s = spies();
    logOsDispatches([entry('denied'), entry('error')]);
    expect(s.group).toHaveBeenCalledWith('[notifications] 2 dispatched, 0 skipped');
    expect(s.log.mock.calls[0]?.[0]).toBe('denied');
    expect(s.log.mock.calls[1]?.[0]).toBe('error');
  });

  it('logs nothing when DEV is false', () => {
    vi.stubEnv('DEV', false);
    const s = spies();
    logOsDispatches([entry('sent')]);
    expect(s.group).not.toHaveBeenCalled();
    expect(s.log).not.toHaveBeenCalled();
  });
});
