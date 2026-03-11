/**
 * NotificationPopover — notification feed rendered inside TopBar's Popover.
 *
 * Pure UI component: reads from notifications store, renders feed, mark-all-read header,
 * and permission-denied Alert banner. Polling logic lives in TopBar (useQuery with
 * refetchInterval) where QueryClientProvider is always available.
 */
import { useState } from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { useNotificationsStore } from '../../stores/notifications.store';
import NotificationRow from './NotificationRow';
import NotificationDetail from './NotificationDetail';

export default function NotificationPopover() {
  const {
    items,
    readIds,
    permissionDenied,
    markAllRead,
    markAsRead,
    setPermissionDenied,
  } = useNotificationsStore();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const readSet = new Set(readIds);

  // Sort newest-first
  const sortedItems = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const selectedItem = selectedItemId
    ? items.find((i) => i.id === selectedItemId) ?? null
    : null;

  function handleRowClick(id: string) {
    setSelectedItemId(id);
    markAsRead(id);
  }

  function handleDetailClose() {
    setSelectedItemId(null);
  }

  return (
    <div className="w-80">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <span className="font-semibold text-sm">Notifications</span>
        <Button variant="ghost" size="sm" onClick={markAllRead}>
          Mark all as read
        </Button>
      </div>

      {/* Permission-denied banner */}
      {permissionDenied && (
        <div className="m-2">
          <Alert>
            <AlertDescription>
              Desktop notifications are blocked. Enable them in System Settings → Notifications →
              Taskflow.
            </AlertDescription>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setPermissionDenied(false)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </Alert>
        </div>
      )}

      {/* Feed */}
      <div className="overflow-y-auto max-h-[400px]">
        {sortedItems.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          sortedItems.map((item) => (
            <div key={item.id}>
              <NotificationRow
                item={item}
                isUnread={!readSet.has(item.id)}
                onClick={() => handleRowClick(item.id)}
              />
              {selectedItemId === item.id && selectedItem && (
                <NotificationDetail item={selectedItem} onClose={handleDetailClose} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
