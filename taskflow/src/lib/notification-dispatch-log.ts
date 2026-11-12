import { useNotificationDispatchLogStore } from '../stores/notification-dispatch-log.store';
import type { NotificationItem } from '../stores/notifications.store';
import { useSettingsStore } from '../stores/settings.store';

export type OsDispatchOutcome = 'sent' | 'denied' | 'error' | 'skipped';

export interface OsDispatchLogEntry {
  item: NotificationItem;
  title: string;
  body: string;
  outcome: OsDispatchOutcome;
}

/** Single source of truth for the OS notification title/body strings. */
export function formatOsNotification(item: NotificationItem): { title: string; body: string } {
  return {
    title: `${item.source === 'jira' ? 'Jira' : 'GitLab'} — ${item.entityTitle}`,
    body: `${item.author}: ${item.bodyPreview}`,
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
