/**
 * Pure filters for the Notifications and Editor Developer Tools tabs.
 * Empty facet sets mean "all"; search is a case-insensitive substring match (never a regex).
 */
import type { NotificationDispatchLogEntry } from '../../stores/notification-dispatch-log.store';
import type { NotificationItem } from '../../stores/notifications.store';
import type { WikiEditorLogEntry } from '../../stores/wiki-editor-log.store';

function itemsOf(entry: NotificationDispatchLogEntry): NotificationItem[] {
  return entry.kind === 'summary' ? entry.items : [entry.item];
}

export function filterNotificationEntries(
  entries: NotificationDispatchLogEntry[],
  { search, outcomes }: { search: string; outcomes: Set<string> },
): NotificationDispatchLogEntry[] {
  const needle = search.trim().toLowerCase();
  return entries.filter((e) => {
    if (outcomes.size > 0 && !outcomes.has(e.outcome)) return false;
    if (!needle) return true;
    const hay = [e.title, e.body, ...itemsOf(e).flatMap((i) => [i.entityTitle, i.parentKey ?? ''])]
      .join('\n')
      .toLowerCase();
    return hay.includes(needle);
  });
}

export function filterEditorEntries(
  entries: WikiEditorLogEntry[],
  { search, levels, events }: { search: string; levels: Set<string>; events: Set<string> },
): WikiEditorLogEntry[] {
  const needle = search.trim().toLowerCase();
  return entries.filter((e) => {
    if (levels.size > 0 && !levels.has(e.level)) return false;
    if (events.size > 0 && !events.has(e.event)) return false;
    if (!needle) return true;
    const hay = [e.message, e.event, e.context?.label ?? '', e.context?.issueKey ?? '']
      .join('\n')
      .toLowerCase();
    return hay.includes(needle);
  });
}
