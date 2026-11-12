import {
  actorName,
  type ChangeLine,
  cleanCommentText,
  getEntityRef,
  getEntityTitle,
  isSystemNote,
  orderChanges,
  parseChangeLines,
  parseSystemLines,
} from '../routes/notifications/notification-view';
import { useNotificationDispatchLogStore } from '../stores/notification-dispatch-log.store';
import type { NotificationItem } from '../stores/notifications.store';
import { useSettingsStore } from '../stores/settings.store';

export type OsDispatchOutcome = 'sent' | 'denied' | 'error' | 'skipped' | 'grouped';

export type OsDispatchLogEntry =
  | {
      kind?: 'item';
      item: NotificationItem;
      title: string;
      body: string;
      outcome: OsDispatchOutcome;
    }
  | {
      kind: 'summary';
      items: NotificationItem[];
      title: string;
      body: string;
      outcome: OsDispatchOutcome;
    };

export interface OsFormatContext {
  jiraUsername?: string | null;
  jiraDisplayName?: string | null;
}

/** More fresh items than this in one poll collapse into a single summary banner. */
export const OS_BURST_THRESHOLD = 3;

const BODY_CAP = 140;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * OS-only plain-text cleaner: strips Jira wiki / Markdown to one short line.
 * Anchored, non-nested regexes only (no catastrophic backtracking).
 */
export function toPlainNotificationText(text: string, ctx?: OsFormatContext): string {
  let t = text;
  if (ctx?.jiraUsername && ctx.jiraDisplayName) {
    t = t.replace(
      new RegExp(`\\[~${escapeRe(ctx.jiraUsername)}\\]`, 'g'),
      () => `@${ctx.jiraDisplayName}`,
    );
  }
  t = t
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, '')
    .replace(/![^\s!|]+(?:\|[^!\n]*)?!/g, '')
    .replace(/\[([^\]\n]+)\]\([^)\n]*\)/g, '$1')
    .replace(/\{\{\{\}?([^\n]*?)\{?\}\}\}/g, '$1')
    .replace(/\{\{([^\n]*?)\}\}/g, '$1')
    .replace(/\{color[^}]*\}/g, ' ')
    .replace(/^[ \t]*(?:h[1-6]\.|bq\.|#{1,6}[ \t]|```[^\n]*$)[ \t]*/gm, '')
    .replace(/^[ \t]*(?:[*#-]|\d+\.)[ \t]+/gm, '')
    .replace(/^[ \t]*\|[^\n]*$/gm, (row) => row.replace(/\|/g, ' '));
  t = cleanCommentText(t);
  const L = '(?<=^|[\\s(])';
  const R = '(?=$|[\\s.,;:!?)])';
  t = t
    .replace(new RegExp(`${L}__([^\\s_][^_]*?)__${R}`, 'g'), '$1')
    .replace(new RegExp(`${L}\\?\\?([^\\s?][^?]*?)\\?\\?${R}`, 'g'), '$1')
    .replace(new RegExp(`${L}([*_+^-])([^\\s*_+^-](?:[^*_+^-]*[^\\s*_+^-])?)\\1${R}`, 'g'), '$2')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > BODY_CAP) t = `${t.slice(0, BODY_CAP).replace(/[\s.,;:!?-]+$/, '')}\u2026`;
  return t;
}

const cap1 = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function headline(c: ChangeLine): string {
  const field = cap1(c.field);
  if (c.to) return `${field} \u2192 ${c.to}`;
  if (c.text) return `${field} ${c.text}`;
  if (c.from) return `${field} removed`;
  return field;
}

function osTitle(item: NotificationItem): string {
  let ref = getEntityRef(item);
  if (!ref && item.source === 'gitlab') {
    const m = item.url?.match(/\/merge_requests\/(\d+)/);
    if (m) ref = `!${m[1]}`;
  }
  const title = getEntityTitle(item);
  return ref ? `${ref} \u00B7 ${title}` : title;
}

function osWhat(item: NotificationItem, ctx?: OsFormatContext): string {
  const raw = item.fullBody || item.bodyPreview;
  switch (item.notificationType) {
    case 'issue-assignment':
      return 'Assigned you';
    case 'mr-approval':
      return 'Approved';
    case 'due-date-reminder':
      return item.bodyPreview;
    case 'pipeline-failure': {
      const m = item.bodyPreview.match(/failed on (.+)$/);
      return m ? `Pipeline failed on ${m[1]}` : item.bodyPreview;
    }
    case 'issue-update':
    case 'mr-note': {
      const isIssue = item.notificationType === 'issue-update';
      if (isIssue || isSystemNote(item)) {
        const ordered = orderChanges(isIssue ? parseChangeLines(raw) : parseSystemLines(raw));
        if (ordered.length > 0) {
          const more = ordered.length - 1;
          return headline(ordered[0]) + (more > 0 ? ` (+${more} more)` : '');
        }
        return toPlainNotificationText(raw.split('\n')[0] ?? '', ctx);
      }
      return toPlainNotificationText(raw, ctx);
    }
    default:
      return toPlainNotificationText(raw, ctx);
  }
}

/** Single source of truth for the OS notification title/body strings. */
export function formatOsNotification(
  item: NotificationItem,
  ctx?: OsFormatContext,
): { title: string; body: string } {
  const actor = actorName(item.author);
  const what = osWhat(item, ctx);
  return {
    title: osTitle(item),
    body: (actor ? `${actor}: ${what}` : what).replace(/\s+/g, ' ').trim(),
  };
}

export type OsDispatchPlan =
  | { kind: 'items'; banners: { item: NotificationItem; title: string; body: string }[] }
  | { kind: 'summary'; title: string; body: string; items: NotificationItem[] };

/** One banner per item up to the burst threshold; beyond it, a single summary banner. */
export function planOsDispatch(items: NotificationItem[], ctx?: OsFormatContext): OsDispatchPlan {
  if (items.length <= OS_BURST_THRESHOLD) {
    return {
      kind: 'items',
      banners: items.map((item) => ({ item, ...formatOsNotification(item, ctx) })),
    };
  }
  const jira = items.filter((i) => i.source === 'jira').length;
  const gitlab = items.length - jira;
  return {
    kind: 'summary',
    title: `${items.length} new notifications`,
    body: [jira > 0 ? `${jira} Jira` : '', gitlab > 0 ? `${gitlab} GitLab` : '']
      .filter(Boolean)
      .join(' \u00B7 '),
    items,
  };
}

let nextLogId = 0;

/**
 * Record one poll's OS notification attempts in the Developer Tools "Notifications" tab.
 * No-op unless the Developer Tools master switch is on.
 */
export function logOsDispatches(entries: OsDispatchLogEntry[]): void {
  if (entries.length === 0) return;
  if (!useSettingsStore.getState().devToolsEnabled) return;
  const timestamp = new Date().toISOString();
  useNotificationDispatchLogStore
    .getState()
    .append(entries.map((e) => ({ ...e, id: `os-dispatch-${++nextLogId}`, timestamp })));
}
