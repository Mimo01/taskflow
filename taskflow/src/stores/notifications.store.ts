/**
 * Notifications store — unread notification items, read IDs, last-seen cursor.
 *
 * Uses shared createTauriStorage adapter for Tauri Store persistence.
 * Persists items, readIds, lastSeenCursor. permissionDenied is transient (not persisted).
 *
 * IMPORTANT: readIds is stored as string[] (not Set) because Zustand JSON persist
 * middleware does not serialize Set correctly (serializes as {}).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

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
  id: string; // 'jira-comment-{id}' | 'gitlab-note-{id}'
  source: 'jira' | 'gitlab';
  entityTitle: string; // "PROJ-123: Fix login bug"
  author: string; // "J.Smith"
  authorAvatarUrl?: string; // avatar image URL from Jira/GitLab API
  bodyPreview: string; // first ~80 chars of body
  fullBody: string;
  createdAt: string; // ISO 8601
  url?: string; // browser-openable URL for the entity
  notificationType?: NotificationType;
  entityState?: string; // GitLab: "opened" | "merged" | "closed"
  parentKey?: string; // Jira subtask parent key, e.g. "PROJ-100"
  parentSummary?: string; // Jira subtask parent summary, e.g. "User Login Flow"
  mrProjectId?: number; // GitLab MR project ID — for internal /mr/:projectId/:iid routing
  mrIid?: number; // GitLab MR iid — for internal /mr/:projectId/:iid routing
}

interface NotificationsState {
  items: NotificationItem[];
  readIds: string[]; // string[] NOT Set — JSON-serializable
  lastSeenCursor: string | null; // DEPRECATED — kept for migration
  lastSeenJiraCursor: string | null; // ISO timestamp of last seen Jira notification
  lastSeenGitlabCursor: string | null; // ISO timestamp of last seen GitLab notification
  permissionDenied: boolean; // transient — not persisted
  notificationSendError: boolean; // transient — OS notification dispatch failed (e.g. dev mode)
  fetchError: Error | null; // transient — propagated from polling hook
  retryFetch: (() => void) | null; // transient — refetch function from polling hook

  // Cached derived counts (PERF-02) — updated when items/readIds change
  _unreadCount: number;
  _jiraUnreadCount: number;
  _gitlabUnreadCount: number;

  // Actions
  setItems: (items: NotificationItem[]) => void;
  prependItems: (newItems: NotificationItem[]) => void;
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  markAllRead: () => void;
  markAllReadBySource: (source: 'jira' | 'gitlab') => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  setLastSeenCursor: (ts: string) => void;
  setLastSeenJiraCursor: (ts: string) => void;
  setLastSeenGitlabCursor: (ts: string) => void;
  setPermissionDenied: (v: boolean) => void;
  setNotificationSendError: (v: boolean) => void;
  setFetchError: (err: Error | null) => void;
  setRetryFetch: (fn: (() => void) | null) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeUnreadCounts(items: NotificationItem[], readIds: string[]) {
  const readSet = new Set(readIds);
  let total = 0;
  let jira = 0;
  let gitlab = 0;
  for (const item of items) {
    if (!readSet.has(item.id)) {
      total++;
      if (item.source === 'jira') jira++;
      else gitlab++;
    }
  }
  return { _unreadCount: total, _jiraUnreadCount: jira, _gitlabUnreadCount: gitlab };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],
      readIds: [],
      lastSeenCursor: null,
      lastSeenJiraCursor: null,
      lastSeenGitlabCursor: null,
      permissionDenied: false,
      notificationSendError: false,
      fetchError: null,
      retryFetch: null,
      _unreadCount: 0,
      _jiraUnreadCount: 0,
      _gitlabUnreadCount: 0,

      setItems: (items) =>
        set({ items, ...computeUnreadCounts(items, get().readIds) }),

      prependItems: (newItems) =>
        set((s) => {
          const existingIds = new Set(s.items.map((i) => i.id));
          const deduped = newItems.filter((i) => !existingIds.has(i.id));
          if (deduped.length === 0) return s;
          const items = [...deduped, ...s.items].slice(0, 200);
          return { items, ...computeUnreadCounts(items, s.readIds) };
        }),

      markAsRead: (id) =>
        set((s) => {
          const readIds = s.readIds.includes(id) ? s.readIds : [...s.readIds, id];
          return { readIds, ...computeUnreadCounts(s.items, readIds) };
        }),

      markAsUnread: (id) =>
        set((s) => {
          const readIds = s.readIds.filter((rid) => rid !== id);
          return { readIds, ...computeUnreadCounts(s.items, readIds) };
        }),

      markAllRead: () =>
        set((s) => ({
          readIds: s.items.map((i) => i.id),
          _unreadCount: 0,
          _jiraUnreadCount: 0,
          _gitlabUnreadCount: 0,
        })),

      markAllReadBySource: (source) =>
        set((s) => {
          const readIds = [
            ...new Set([
              ...s.readIds,
              ...s.items.filter((i) => i.source === source).map((i) => i.id),
            ]),
          ];
          return { readIds, ...computeUnreadCounts(s.items, readIds) };
        }),

      removeItem: (id) =>
        set((s) => {
          const items = s.items.filter((i) => i.id !== id);
          const readIds = s.readIds.filter((rid) => rid !== id);
          return { items, readIds, ...computeUnreadCounts(items, readIds) };
        }),

      clearAll: () =>
        set({
          items: [],
          readIds: [],
          lastSeenCursor: null,
          lastSeenJiraCursor: null,
          lastSeenGitlabCursor: null,
          _unreadCount: 0,
          _jiraUnreadCount: 0,
          _gitlabUnreadCount: 0,
        }),

      setLastSeenCursor: (ts) => set({ lastSeenCursor: ts }),
      setLastSeenJiraCursor: (ts) => set({ lastSeenJiraCursor: ts }),
      setLastSeenGitlabCursor: (ts) => set({ lastSeenGitlabCursor: ts }),

      setPermissionDenied: (v) => set({ permissionDenied: v }),
      setNotificationSendError: (v) => set({ notificationSendError: v }),

      setFetchError: (err) => set({ fetchError: err }),
      setRetryFetch: (fn) => set({ retryFetch: fn }),
    }),
    {
      name: 'notifications-store',
      storage: createTauriStorage('notifications.json'),
      partialize: (s) => ({
        // Only persist these fields; permissionDenied is transient
        items: s.items,
        readIds: s.readIds,
        lastSeenJiraCursor: s.lastSeenJiraCursor,
        lastSeenGitlabCursor: s.lastSeenGitlabCursor,
      }),
      // Sanitize rehydrated data — old store versions serialized readIds/items as Set,
      // which JSON-stringifies to {}. Guard both fields so new Set(readIds) never throws.
      merge: (persisted, current) => {
        const p = persisted as Partial<NotificationsState> & { lastSeenCursor?: string | null };
        // Migrate: if old shared cursor exists but per-source cursors don't, seed both
        const jiraCursor = p.lastSeenJiraCursor ?? p.lastSeenCursor ?? null;
        const gitlabCursor = p.lastSeenGitlabCursor ?? p.lastSeenCursor ?? null;
        const items = Array.isArray(p.items) ? p.items : [];
        const readIds = Array.isArray(p.readIds) ? p.readIds : [];
        return {
          ...current,
          ...p,
          readIds,
          items,
          lastSeenJiraCursor: jiraCursor,
          lastSeenGitlabCursor: gitlabCursor,
          lastSeenCursor: null, // deprecated
          ...computeUnreadCounts(items, readIds),
        };
      },
    },
  ),
);

// ─── Cached Selectors (PERF-02) ──────────────────────────────────────────────

/**
 * Hook that returns the cached count of unread notifications.
 * No per-render Set creation — count is updated only when items/readIds change.
 * Call as a React hook: const count = useUnreadCount()
 */
export const useUnreadCount = () => useNotificationsStore((s) => s._unreadCount);

export const useJiraUnreadCount = () => useNotificationsStore((s) => s._jiraUnreadCount);

export const useGitlabUnreadCount = () => useNotificationsStore((s) => s._gitlabUnreadCount);
