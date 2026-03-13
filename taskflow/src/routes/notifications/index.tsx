/**
 * NotificationsPage — full-page view of all notifications.
 *
 * Lists all notifications from the Zustand store with:
 * - Accordion-style inline detail on row click (same pattern as NotificationsPanel)
 * - "Mark all read" action in the header
 * - Empty state when no notifications exist
 */
import { useState } from 'react';
import { useNotificationsStore } from '@/stores/notifications.store';
import NotificationRow from './NotificationRow';
import NotificationDetail from './NotificationDetail';

export default function NotificationsPage() {
  const { items, readIds, markAsRead, markAllRead } = useNotificationsStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const readSet = new Set(readIds);
  const unreadCount = items.filter((i) => !readSet.has(i.id)).length;

  const handleRowClick = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    markAsRead(id);
  };

  return (
    <div className="flex flex-col gap-0 p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Mark all read
        </button>
      </div>

      {/* List or empty state */}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No notifications yet</p>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => (
            <div key={item.id}>
              <NotificationRow
                item={item}
                isUnread={!readSet.has(item.id)}
                onClick={() => handleRowClick(item.id)}
              />
              {expandedId === item.id && (
                <NotificationDetail
                  item={item}
                  onClose={() => setExpandedId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
