import type { NotificationItem } from '../stores/notifications.store';

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

/** Dev-only: one collapsed devtools group per poll listing the OS notifications. */
export function logOsDispatches(entries: OsDispatchLogEntry[]): void {
  if (!import.meta.env.DEV) return;
  if (entries.length === 0) return;
  const count = (o: OsDispatchOutcome) => entries.filter((e) => e.outcome === o).length;
  const sent = count('sent');
  const skipped = count('skipped');
  const failed = entries.length - sent - skipped;
  console.groupCollapsed(`[notifications] ${sent} sent, ${failed} failed, ${skipped} skipped`);
  for (const e of entries) {
    if (e.outcome === 'skipped') {
      console.log('skipped (already known)', e.title, e.body, e.item);
    } else {
      console.log(e.outcome, e.title, e.body, e.item);
    }
  }
  console.groupEnd();
}
