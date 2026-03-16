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

export type NotificationType =
  | 'comment-mention'
  | 'issue-update'
  | 'mr-note'
  | 'gitlab-mention'
  | 'jira-comment'
  | 'mr-approval'
  | 'pipeline-failure'
  | 'issue-assignment'
  | 'due-date-reminder';

export interface NotificationItem {
  id: string;            // 'jira-comment-{id}' | 'gitlab-note-{id}'
  source: 'jira' | 'gitlab';
  entityTitle: string;   // "PROJ-123: Fix login bug"
  author: string;        // "J.Smith"
  authorAvatarUrl?: string; // avatar image URL from Jira/GitLab API
  bodyPreview: string;   // first ~80 chars of body
  fullBody: string;
  createdAt: string;     // ISO 8601
  url?: string;              // browser-openable URL for the entity
  notificationType?: NotificationType;
  entityState?: string;      // GitLab: "opened" | "merged" | "closed"
}

interface NotificationsState {
  items: NotificationItem[];
  readIds: string[];               // string[] NOT Set — JSON-serializable
  lastSeenCursor: string | null;   // ISO timestamp of last seen notification
  permissionDenied: boolean;       // transient — not persisted
  fetchError: Error | null;        // transient — propagated from polling hook
  retryFetch: (() => void) | null; // transient — refetch function from polling hook

  // Actions
  setItems: (items: NotificationItem[]) => void;
  prependItems: (newItems: NotificationItem[]) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  setLastSeenCursor: (ts: string) => void;
  setPermissionDenied: (v: boolean) => void;
  setFetchError: (err: Error | null) => void;
  setRetryFetch: (fn: (() => void) | null) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      items: [],
      readIds: [],
      lastSeenCursor: null,
      permissionDenied: false,
      fetchError: null,
      retryFetch: null,

      setItems: (items) => set({ items }),

      prependItems: (newItems) =>
        set((s) => {
          const existingIds = new Set(s.items.map((i) => i.id));
          const deduped = newItems.filter((i) => !existingIds.has(i.id));
          if (deduped.length === 0) return s;
          return { items: [...deduped, ...s.items].slice(0, 200) };
        }),

      markAsRead: (id) =>
        set((s) => ({
          readIds: s.readIds.includes(id) ? s.readIds : [...s.readIds, id],
        })),

      markAllRead: () =>
        set((s) => ({
          readIds: s.items.map((i) => i.id),
        })),

      clearAll: () =>
        set({ items: [], readIds: [], lastSeenCursor: null }),

      setLastSeenCursor: (ts) => set({ lastSeenCursor: ts }),

      setPermissionDenied: (v) => set({ permissionDenied: v }),

      setFetchError: (err) => set({ fetchError: err }),
      setRetryFetch: (fn) => set({ retryFetch: fn }),
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
      // Sanitize rehydrated data — old store versions serialized readIds/items as Set,
      // which JSON-stringifies to {}. Guard both fields so new Set(readIds) never throws.
      merge: (persisted, current) => {
        const p = persisted as Partial<NotificationsState>;
        return {
          ...current,
          ...p,
          readIds: Array.isArray(p.readIds) ? p.readIds : [],
          items: Array.isArray(p.items) ? p.items : [],
        };
      },
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
