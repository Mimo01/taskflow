/**
 * NotificationsPanel — DASH-04
 *
 * Dashboard widget showing the last 3 unread notifications sorted newest-first.
 * Clicking a row marks it as read and toggles an inline NotificationDetail.
 * Reads directly from useNotificationsStore — no useQuery, no fetch.
 */
import { useState } from 'react';
import { useNotificationsStore } from '@/stores/notifications.store';
import NotificationRow from '../notifications/NotificationRow';
import NotificationDetail from '../notifications/NotificationDetail';

export default function NotificationsPanel() {
  const { items, readIds, markAsRead } = useNotificationsStore();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const readSet = new Set(readIds);

  const unreadItems = [...items]
    .filter((i) => !readSet.has(i.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const selectedItem = selectedItemId
    ? items.find((i) => i.id === selectedItemId) ?? null
    : null;

  function handleRowClick(id: string) {
    markAsRead(id);
    setSelectedItemId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Notifications
      </h2>

      {unreadItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No unread notifications</p>
      ) : (
        <div className="flex flex-col">
          {unreadItems.map((item) => (
            <div key={item.id}>
              <NotificationRow
                item={item}
                isUnread={!readSet.has(item.id)}
                onClick={() => handleRowClick(item.id)}
              />
              {selectedItemId === item.id && selectedItem && (
                <NotificationDetail
                  item={selectedItem}
                  onClose={() => setSelectedItemId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
