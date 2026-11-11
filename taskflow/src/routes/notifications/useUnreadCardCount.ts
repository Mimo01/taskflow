import { useMemo } from 'react';
import { useNow } from '../../hooks/useNow';
import { useNotificationsStore } from '../../stores/notifications.store';
import { countUnreadCards } from './notification-view';

/** Unread card count for the bell badge — matches what the popover list shows (merged = 1). */
export function useUnreadCardCount(): number {
  const items = useNotificationsStore((s) => s.items);
  const readIds = useNotificationsStore((s) => s.readIds);
  // Ticking clock (same as the popover) so merge buckets move with time even when no poll lands.
  const now = useNow(60_000);
  return useMemo(
    () => countUnreadCards(items, new Set(readIds), 'all', now),
    [items, readIds, now],
  );
}
