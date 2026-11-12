/**
 * notification-dispatch-log.store — In-memory log of OS desktop notification attempts,
 * shown in Developer Tools → Notifications. Lets you see what would be dispatched in dev,
 * where macOS drops notifications from the unsigned bundle.
 *
 * Transient (no persist) — cleared on restart. Newest first, capped at the dev tools
 * retention limit (default 200).
 */
import { create } from 'zustand';
import type { OsDispatchOutcome } from '../lib/notification-dispatch-log';
import type { NotificationItem } from './notifications.store';
import { useSettingsStore } from './settings.store';

export interface NotificationDispatchLogEntry {
  id: string;
  timestamp: string; // ISO; same for every entry of one poll
  item: NotificationItem;
  title: string;
  body: string;
  outcome: OsDispatchOutcome;
}

interface NotificationDispatchLogState {
  entries: NotificationDispatchLogEntry[];
  /** Append one poll's entries (given in dispatch order); stored newest first. */
  append: (entries: NotificationDispatchLogEntry[]) => void;
  clear: () => void;
}

const getRetentionLimit = () => {
  try {
    return (useSettingsStore.getState() as { retentionLimit?: number }).retentionLimit ?? 200;
  } catch {
    return 200;
  }
};

export const useNotificationDispatchLogStore = create<NotificationDispatchLogState>((set) => ({
  entries: [],
  append: (entries) =>
    set((s) => {
      const next = [...[...entries].reverse(), ...s.entries];
      const limit = getRetentionLimit();
      return { entries: next.length > limit ? next.slice(0, limit) : next };
    }),
  clear: () => set({ entries: [] }),
}));
