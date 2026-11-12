import { beforeEach, describe, expect, it } from 'vitest';
import { useNotificationDispatchLogStore } from '../stores/notification-dispatch-log.store';
import type { NotificationItem } from '../stores/notifications.store';
import { useSettingsStore } from '../stores/settings.store';
import {
  formatOsNotification,
  logOsDispatches,
  type OsDispatchLogEntry,
  planOsDispatch,
  toPlainNotificationText,
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

const mk = (over: Partial<NotificationItem>): NotificationItem => ({ ...item(), ...over });

describe('formatOsNotification', () => {
  it('formats jira and gitlab items item-led', () => {
    expect(formatOsNotification(item())).toEqual({
      title: 'PROJ-1 · Title',
      body: 'Cara: body',
    });
    expect(
      formatOsNotification(mk({ source: 'gitlab', entityTitle: 'MR title', mrIid: 482 })).title,
    ).toBe('!482 · MR title');
  });

  it('issue update shows the top-priority change plus the remainder count', () => {
    const body = 'Assignee: A → B\nStatus: To Do → In Review\nPriority: Low → High';
    const r = formatOsNotification(
      mk({
        notificationType: 'issue-update',
        author: 'Alex Doe',
        fullBody: body,
        bodyPreview: body,
      }),
    );
    expect(r.body).toBe('Alex: Status → In Review (+2 more)');
  });

  it('issue update single change has no remainder; from-only and text changes read short', () => {
    const upd = (b: string) =>
      formatOsNotification(
        mk({ notificationType: 'issue-update', author: 'Alex Doe', fullBody: b, bodyPreview: b }),
      ).body;
    expect(upd('Status: To Do → Done')).toBe('Alex: Status → Done');
    expect(upd('Assignee: Bob → (none)')).toBe('Alex: Assignee removed');
    expect(upd('Labels: a → b')).toBe('Alex: Labels +b −a');
    expect(upd('Description: updated')).toBe('Alex: Description edited');
  });

  it('system MR note reads as a short phrase', () => {
    const r = formatOsNotification(
      mk({
        id: 'gitlab-system-9',
        source: 'gitlab',
        entityTitle: 'MR title',
        mrIid: 482,
        author: 'Alex Doe',
        notificationType: 'mr-note',
        fullBody: 'State: opened → merged',
        bodyPreview: 'State: opened → merged',
      }),
    );
    expect(r.title).toBe('!482 · MR title');
    expect(r.body).toBe('Alex: Merged');
  });

  it('fixed-phrase types', () => {
    const t = (notificationType: NotificationItem['notificationType'], over = {}) =>
      formatOsNotification(mk({ notificationType, author: 'Alex Doe', ...over })).body;
    expect(t('issue-assignment')).toBe('Alex: Assigned you');
    expect(t('mr-approval')).toBe('Alex: Approved');
    expect(t('due-date-reminder', { author: '', bodyPreview: 'Due tomorrow' })).toBe(
      'Due tomorrow',
    );
    expect(
      t('pipeline-failure', { author: '', bodyPreview: 'Pipeline #4821 failed on feature/x-y' }),
    ).toBe('Pipeline failed on feature/x-y');
  });

  it('cleans Jira wiki comments and maps the current user mention', () => {
    const full =
      'h3. Note\n*Can* you check {{{}staging{}}} logs [~jdoe]? [docs|https://x] !shot.png|thumbnail!';
    const base = mk({ notificationType: 'comment-mention', author: 'Alex Doe', fullBody: full });
    expect(
      formatOsNotification(base, { jiraUsername: 'jdoe', jiraDisplayName: 'Jane Doe' }).body,
    ).toBe('Alex: Note Can you check staging logs @Jane Doe? docs');
    expect(formatOsNotification(base).body).toBe(
      'Alex: Note Can you check staging logs @jdoe? docs',
    );
  });

  it('cleans GitLab Markdown comments', () => {
    const full = '# Head\n**b** [t](http://u) ![a](u)\n- item\n```\ncode\n```';
    for (const notificationType of ['mr-note', 'gitlab-mention'] as const) {
      const r = formatOsNotification(
        mk({ source: 'gitlab', mrIid: 1, notificationType, author: 'Alex Doe', fullBody: full }),
      );
      expect(r.body).toBe('Alex: Head b t item code');
    }
  });

  it('leaves identifiers alone and caps long text', () => {
    expect(toPlainNotificationText('snake_case a-b-c 2*3*4 feature/x-y')).toBe(
      'snake_case a-b-c 2*3*4 feature/x-y',
    );
    const long = toPlainNotificationText('word '.repeat(100));
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual(141);
  });

  it('falls back to the url for the MR ref, then to the bare title', () => {
    const g = { source: 'gitlab' as const, entityTitle: 'MR title' };
    expect(
      formatOsNotification(mk({ ...g, url: 'https://g.example/p/merge_requests/77' })).title,
    ).toBe('!77 · MR title');
    expect(formatOsNotification(mk({ ...g })).title).toBe('MR title');
  });

  it('body is a single line and never starts with ": "', () => {
    for (const notificationType of [
      'jira-comment',
      'issue-update',
      'mr-note',
      'due-date-reminder',
      'pipeline-failure',
    ] as const) {
      const r = formatOsNotification(
        mk({ notificationType, author: '', bodyPreview: 'a\nb', fullBody: 'a\nb' }),
      );
      expect(r.body.includes('\n')).toBe(false);
      expect(r.body.startsWith(': ')).toBe(false);
    }
  });

  it('sprint change names only the sprints this change added or removed', () => {
    const upd = (b: string) =>
      formatOsNotification(
        mk({ notificationType: 'issue-update', author: 'Alex Doe', fullBody: b, bodyPreview: b }),
      ).body;
    expect(upd('Sprint: S 192 1.10.-14.10.26, S 194 → S 192 1.10.-14.10.26, S 194, S 195')).toBe(
      'Alex: Sprint → S 195',
    );
    expect(upd('Sprint: (none) → S 195')).toBe('Alex: Sprint → S 195');
    expect(upd('Sprint: S 194, S 195 → S 194')).toBe('Alex: Sprint removed: S 195');
    expect(upd('Sprint: S 195 → (none)')).toBe('Alex: Sprint removed: S 195');
  });

  it('uses the given name for surname-first directory names', () => {
    expect(formatOsNotification(mk({ author: 'SIMKOVA Veronika OSK (ext.)' })).body).toBe(
      'Veronika: body',
    );
  });

  it('unescapes Jira backslash escapes instead of treating them as markup', () => {
    expect(toPlainNotificationText('\\[euro\\] price \\*not bold\\* a\\\\b \\{x\\}')).toBe(
      '[euro] price *not bold* a b {x}',
    );
  });

  it('strips Jira images but keeps exclamation-delimited text', () => {
    expect(toPlainNotificationText('Fixed!Done! Great work!Thanks!')).toBe(
      'Fixed!Done! Great work!Thanks!',
    );
    expect(toPlainNotificationText('See !shot.PNG! and !https://x/y/img.jpg|thumbnail! ok')).toBe(
      'See and ok',
    );
  });

  it('survives pathological markup quickly', () => {
    const t0 = Date.now();
    toPlainNotificationText(`${'*a '.repeat(5000)}${'{{{'.repeat(2000)}${'[x'.repeat(3000)}`);
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});

describe('planOsDispatch', () => {
  const many = (n: number, gitlab = 0) =>
    Array.from({ length: n }, (_, i) =>
      mk({ id: `n${i}`, source: i < gitlab ? 'gitlab' : 'jira' }),
    );

  it('keeps per-item banners up to the threshold', () => {
    const p = planOsDispatch(many(3));
    expect(p.kind).toBe('items');
    if (p.kind === 'items') expect(p.banners[0].title).toBe('PROJ-1 · Title');
  });

  it('folds bigger bursts into one summary, omitting a zero side', () => {
    expect(planOsDispatch(many(4, 1))).toEqual(
      expect.objectContaining({
        kind: 'summary',
        title: '4 new notifications',
        body: '3 Jira · 1 GitLab',
      }),
    );
    expect(planOsDispatch(many(5))).toEqual(expect.objectContaining({ body: '5 Jira' }));
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
