/**
 * Notifications store — unread notification items, read IDs, last-seen cursor.
 *
 * Follows the exact same LazyStore + createJSONStorage adapter pattern as settings.store.ts.
 * Persists items, readIds, lastSeenCursor. permissionDenied is transient (not persisted).
 *
 * IMPORTANT: readIds is stored as string[] (not Set) because Zustand JSON persist
 * middleware does not serialize Set correctly (serializes as {}).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LazyStore } from '@tauri-apps/plugin-store';

const tauriStore = new LazyStore('notifications.json');

const tauriStorage = createJSONStorage(() => ({
  getItem: async (name: string): Promise<string | null> => {
    const value = await tauriStore.get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await tauriStore.set(name, value);
    await tauriStore.save();
  },
  removeItem: async (name: string): Promise<void> => {
    await tauriStore.delete(name);
    await tauriStore.save();
  },
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationItem {
  id: string;            // 'jira-comment-{id}' | 'gitlab-note-{id}'
  source: 'jira' | 'gitlab';
  entityTitle: string;   // "PROJ-123: Fix login bug"
  author: string;        // "J.Smith"
  bodyPreview: string;   // first ~80 chars of body
  fullBody: string;
  createdAt: string;     // ISO 8601
}

interface NotificationsState {
  items: NotificationItem[];
  readIds: string[];               // string[] NOT Set — JSON-serializable
  lastSeenCursor: string | null;   // ISO timestamp of last seen notification
  permissionDenied: boolean;       // transient — not persisted

  // Actions
  setItems: (items: NotificationItem[]) => void;
  prependItems: (newItems: NotificationItem[]) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  setLastSeenCursor: (ts: string) => void;
  setPermissionDenied: (v: boolean) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      items: [],
      readIds: [],
      lastSeenCursor: null,
      permissionDenied: false,

      setItems: (items) => set({ items }),

      prependItems: (newItems) =>
        set((s) => ({
          items: [...newItems, ...s.items].slice(0, 200),
        })),

      markAsRead: (id) =>
        set((s) => ({
          readIds: s.readIds.includes(id) ? s.readIds : [...s.readIds, id],
        })),

      markAllRead: () =>
        set((s) => ({
          readIds: s.items.map((i) => i.id),
        })),

      setLastSeenCursor: (ts) => set({ lastSeenCursor: ts }),

      setPermissionDenied: (v) => set({ permissionDenied: v }),
    }),
    {
      name: 'notifications-store',
      storage: tauriStorage,
      partialize: (s) => ({
        // Only persist these fields; permissionDenied is transient
        items: s.items,
        readIds: s.readIds,
        lastSeenCursor: s.lastSeenCursor,
      }),
    },
  ),
);

// ─── Derived Selector ─────────────────────────────────────────────────────────

/**
 * Hook that returns the count of unread notifications.
 * Uses O(n) Set lookup for large readIds arrays.
 * Call as a React hook: const count = useUnreadCount()
 */
export const useUnreadCount = () =>
  useNotificationsStore((s) => {
    const readSet = new Set(s.readIds);
    return s.items.filter((i) => !readSet.has(i.id)).length;
  });
