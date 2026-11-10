import { useMemo } from 'react';
import { useNotificationsStore } from '../../stores/notifications.store';
import { countUnreadCards } from './notification-view';

/** Unread card count for the bell badge — matches what the popover list shows (merged = 1). */
export function useUnreadCardCount(): number {
  const items = useNotificationsStore((s) => s.items);
  const readIds = useNotificationsStore((s) => s.readIds);
  return useMemo(
    () => countUnreadCards(items, new Set(readIds), 'all', Date.now()),
    [items, readIds],
  );
}
