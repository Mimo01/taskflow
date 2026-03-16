/**
 * NotificationsPage — full-page view of all notifications.
 *
 * Lists all notifications from the Zustand store with:
 * - Accordion-style inline detail on row click (same pattern as NotificationsPanel)
 * - "Mark all read" action in the header
 * - Empty state when no notifications exist
 */
import { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useNotificationsStore } from '@/stores/notifications.store';
import { useListNavigation } from '@/hooks/useListNavigation';
import { cn } from '@/lib/utils';
import NotificationRow from './NotificationRow';
import NotificationDetail from './NotificationDetail';

export default function NotificationsPage() {
  const { items, readIds, markAsRead, markAllRead } = useNotificationsStore();
  const { selectedIssueKey } = useOutletContext<{ selectedIssueKey: string | null }>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const readSet = new Set(readIds);
  const unreadCount = items.filter((i) => !readSet.has(i.id)).length;

  const handleRowClick = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    markAsRead(id);
  };

  const { focusIndex } = useListNavigation({
    itemCount: items.length,
    onSelect: (index) => handleRowClick(items[index].id),
    enabled: items.length > 0 && !selectedIssueKey,
  });

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (focusIndex >= 0 && focusIndex < items.length) {
      const el = rowRefs.current.get(items[focusIndex].id);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusIndex, items]);

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
          {items.map((item) => {
            const isFocused = focusIndex >= 0 && items[focusIndex]?.id === item.id;
            return (
              <div
                key={item.id}
                ref={(el) => { if (el) rowRefs.current.set(item.id, el); else rowRefs.current.delete(item.id); }}
                className={cn(isFocused && 'bg-muted border-l-2 border-primary')}
                aria-current={isFocused ? 'true' : undefined}
              >
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
            );
          })}
        </div>
      )}
    </div>
  );
}
