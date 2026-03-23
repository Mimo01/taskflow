/**
 * NotificationsWidget -- compact notification list for the widget grid.
 *
 * Reads from the notifications store (no token loading needed -- polling fills the store).
 * Shows the last 8 notifications with type indicator, title, and relative timestamp.
 */

import { Bell } from 'lucide-react';
import { useNotificationsStore } from '@/stores/notifications.store';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const SOURCE_COLORS: Record<string, string> = {
  jira: 'bg-blue-500',
  gitlab: 'bg-orange-500',
};

export default function NotificationsWidget(_props: { widgetId: string }) {
  const notifications = useNotificationsStore((s) => s.items);
  const readIds = useNotificationsStore((s) => s.readIds);
  const readSet = new Set(readIds);

  const recent = notifications.slice(0, 8);

  if (recent.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Bell className="size-5" />
          <span className="text-sm">No new notifications</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2 overflow-auto">
      {recent.map((n) => (
        <div
          key={n.id}
          className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 text-sm"
        >
          <span
            className={`size-2 shrink-0 rounded-full ${SOURCE_COLORS[n.source] ?? 'bg-muted-foreground'}`}
            title={n.source}
          />
          <span
            className={`flex-1 truncate ${readSet.has(n.id) ? 'text-muted-foreground' : 'text-foreground'}`}
          >
            {n.entityTitle}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {relativeTime(n.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}
