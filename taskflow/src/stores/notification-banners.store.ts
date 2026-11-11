/**
 * Banner queue for in-app notification banners (261111-m0g). Not persisted.
 *
 * Holds the ids of notification items to show as banners (newest first, at most MAX_BANNERS).
 * Items themselves live in the notifications store; the banner looks them up by id.
 */

import { create } from 'zustand';
import type { NotificationItem } from './notifications.store';
import { useSettingsStore } from './settings.store';

export const MAX_BANNERS = 3;

interface BannerState {
  ids: string[];
  /** True while the notification panel is open: the item enters the list instead. */
  suppressed: boolean;
  push: (ids: string[]) => void;
  dismiss: (id: string) => void;
  clear: () => void;
  setSuppressed: (suppressed: boolean) => void;
}

export const useNotificationBanners = create<BannerState>((set, get) => ({
  ids: [],
  suppressed: false,
  push: (ids) => {
    if (ids.length === 0 || get().suppressed) return;
    // Action, not render: reading the current setting here is fine.
    if (useSettingsStore.getState().notifBannerDurationSecs === 0) return;
    set((state) => {
      const next = [...ids, ...state.ids.filter((id) => !ids.includes(id))];
      return { ids: [...new Set(next)].slice(0, MAX_BANNERS) };
    });
  },
  dismiss: (id) => set((state) => ({ ids: state.ids.filter((x) => x !== id) })),
  clear: () => set({ ids: [] }),
  setSuppressed: (suppressed) => set({ suppressed }),
}));

interface BannerGate {
  /** Ids already known to the store (or dismissed) before this poll's items were prepended. */
  existingIds: ReadonlySet<string>;
  /** Cursors the poll started from; null = no cursor yet, i.e. the 24h backfill. */
  priorCursors: { jira: string | null; gitlab: string | null };
  isFirstPoll: boolean;
  /** Persisted notifications have been rehydrated (otherwise everything looks new). */
  hydrated: boolean;
}

/**
 * Which of a poll's (already per-type filtered) items deserve a banner: only genuinely new ones,
 * never on the first poll, before hydration, or from a null-cursor backfill. Newest first, max 3.
 */
export function selectBannerItems(
  newItems: NotificationItem[],
  { existingIds, priorCursors, isFirstPoll, hydrated }: BannerGate,
): NotificationItem[] {
  if (isFirstPoll || !hydrated) return [];
  return newItems
    .filter((item) => !existingIds.has(item.id) && priorCursors[item.source] != null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, MAX_BANNERS);
}
