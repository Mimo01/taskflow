// NOTF-04: Unread badge count derived from store
// NOTF-05: markAsRead(id) — individual notification read state
// NOTF-06: markAllRead() — bulk read state

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tauri plugin-store so LazyStore doesn't attempt IPC calls in jsdom
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

import type { NotificationItem } from './notifications.store';
import { useNotificationsStore, useUnreadCount } from './notifications.store';

function makeItem(id: string, createdAt = '2026-03-11T10:00:00.000Z'): NotificationItem {
  return {
    id,
    source: 'jira',
    entityTitle: `Entity for ${id}`,
    author: 'A.Author',
    bodyPreview: 'Preview text',
    fullBody: 'Full body text',
    createdAt,
  };
}

describe('notifications.store', () => {
  beforeEach(() => {
    act(() => {
      useNotificationsStore.setState({
        items: [],
        readIds: [],
        lastSeenCursor: null,
        permissionDenied: false,
        _unreadCount: 0,
        _jiraUnreadCount: 0,
        _gitlabUnreadCount: 0,
      });
    });
  });

  describe('NOTF-05: prependItems', () => {
    it('prepends new items before existing items', () => {
      act(() => {
        useNotificationsStore.getState().setItems([makeItem('old-1')]);
      });

      act(() => {
        useNotificationsStore.getState().prependItems([makeItem('new-1')]);
      });

      const { items } = useNotificationsStore.getState();
      expect(items[0].id).toBe('new-1');
      expect(items[1].id).toBe('old-1');
    });

    it('does not prepend items whose IDs are already in the store (no duplicates)', () => {
      act(() => {
        useNotificationsStore.getState().setItems([makeItem('existing-1'), makeItem('existing-2')]);
      });

      act(() => {
        // 'existing-1' is already in the store — should be filtered out
        useNotificationsStore.getState().prependItems([makeItem('existing-1'), makeItem('new-1')]);
      });

      const { items } = useNotificationsStore.getState();
      expect(items).toHaveLength(3);
      expect(items[0].id).toBe('new-1');
      expect(items[1].id).toBe('existing-1');
      expect(items[2].id).toBe('existing-2');
      // Confirm no duplicate 'existing-1' entries
      expect(items.filter((i) => i.id === 'existing-1')).toHaveLength(1);
    });

    it('does not mutate state when all incoming items are already present', () => {
      const original = [makeItem('a'), makeItem('b')];
      act(() => {
        useNotificationsStore.getState().setItems(original);
      });

      const stateBefore = useNotificationsStore.getState().items;

      act(() => {
        useNotificationsStore.getState().prependItems([makeItem('a'), makeItem('b')]);
      });

      const stateAfter = useNotificationsStore.getState().items;
      // State reference must be unchanged (early-return `s` path)
      expect(stateAfter).toBe(stateBefore);
    });

    it('caps total items at 200', () => {
      const existing = Array.from({ length: 199 }, (_, i) => makeItem(`item-${i}`));
      act(() => {
        useNotificationsStore.getState().setItems(existing);
      });

      act(() => {
        useNotificationsStore.getState().prependItems([makeItem('new-A'), makeItem('new-B')]);
      });

      const { items } = useNotificationsStore.getState();
      expect(items).toHaveLength(200);
      expect(items[0].id).toBe('new-A');
      expect(items[1].id).toBe('new-B');
    });
  });

  describe('NOTF-05: markAsRead', () => {
    it('appends id to readIds', () => {
      act(() => {
        useNotificationsStore.getState().setItems([makeItem('item-1')]);
      });

      act(() => {
        useNotificationsStore.getState().markAsRead('item-1');
      });

      const { readIds } = useNotificationsStore.getState();
      expect(readIds).toContain('item-1');
    });

    it('does not duplicate readIds (idempotent)', () => {
      act(() => {
        useNotificationsStore.getState().setItems([makeItem('item-1')]);
        useNotificationsStore.getState().markAsRead('item-1');
      });

      act(() => {
        useNotificationsStore.getState().markAsRead('item-1');
      });

      const { readIds } = useNotificationsStore.getState();
      expect(readIds.filter((id) => id === 'item-1')).toHaveLength(1);
    });
  });

  describe('NOTF-06: markAllRead', () => {
    it('sets readIds to all current item IDs', () => {
      act(() => {
        useNotificationsStore
          .getState()
          .setItems([makeItem('item-1'), makeItem('item-2'), makeItem('item-3')]);
      });

      act(() => {
        useNotificationsStore.getState().markAllRead();
      });

      const { readIds } = useNotificationsStore.getState();
      expect(readIds).toContain('item-1');
      expect(readIds).toContain('item-2');
      expect(readIds).toContain('item-3');
      expect(readIds).toHaveLength(3);
    });
  });

  describe('NOTF-04: useUnreadCount', () => {
    it('returns items.length minus readIds.length', () => {
      act(() => {
        useNotificationsStore
          .getState()
          .setItems([makeItem('item-1'), makeItem('item-2'), makeItem('item-3')]);
        useNotificationsStore.getState().markAsRead('item-1');
      });

      const { result } = renderHook(() => useUnreadCount());
      expect(result.current).toBe(2);
    });

    it('returns 0 when all items are read', () => {
      act(() => {
        useNotificationsStore.getState().setItems([makeItem('item-1')]);
        useNotificationsStore.getState().markAllRead();
      });

      const { result } = renderHook(() => useUnreadCount());
      expect(result.current).toBe(0);
    });

    it('caps display at 99+ for counts over 99', () => {
      const items = Array.from({ length: 100 }, (_, i) => makeItem(`item-${i}`));
      act(() => {
        useNotificationsStore.getState().setItems(items);
      });

      const { result } = renderHook(() => useUnreadCount());
      const displayCount = result.current > 99 ? '99+' : String(result.current);
      expect(displayCount).toBe('99+');
    });
  });

  describe('state persistence shape', () => {
    it('readIds is string[] (not Set) — JSON-serializable', () => {
      act(() => {
        useNotificationsStore.getState().setItems([makeItem('item-1')]);
        useNotificationsStore.getState().markAsRead('item-1');
      });

      const { readIds } = useNotificationsStore.getState();
      expect(Array.isArray(readIds)).toBe(true);
      // Should serialize cleanly to JSON (no Set)
      expect(() => JSON.stringify({ readIds })).not.toThrow();
    });
  });

  describe('PERF-02: memoized unread count', () => {
    it('_unreadCount reflects unread items after setItems', () => {
      act(() => {
        useNotificationsStore
          .getState()
          .setItems([makeItem('item-1'), makeItem('item-2'), makeItem('item-3')]);
        useNotificationsStore.getState().markAsRead('item-1');
      });

      expect(useNotificationsStore.getState()._unreadCount).toBe(2);
    });

    it('markAsRead decrements _unreadCount', () => {
      act(() => {
        useNotificationsStore
          .getState()
          .setItems([makeItem('item-1'), makeItem('item-2'), makeItem('item-3')]);
        useNotificationsStore.getState().markAsRead('item-1');
      });

      act(() => {
        useNotificationsStore.getState().markAsRead('item-2');
      });

      expect(useNotificationsStore.getState()._unreadCount).toBe(1);
    });

    it('markAllRead sets _unreadCount to 0', () => {
      act(() => {
        useNotificationsStore
          .getState()
          .setItems([makeItem('item-1'), makeItem('item-2'), makeItem('item-3')]);
      });

      act(() => {
        useNotificationsStore.getState().markAllRead();
      });

      expect(useNotificationsStore.getState()._unreadCount).toBe(0);
      expect(useNotificationsStore.getState()._jiraUnreadCount).toBe(0);
      expect(useNotificationsStore.getState()._gitlabUnreadCount).toBe(0);
    });

    it('useUnreadCount selector returns cached number (simple property access)', () => {
      act(() => {
        useNotificationsStore
          .getState()
          .setItems([makeItem('item-1'), makeItem('item-2')]);
      });

      const { result } = renderHook(() => useUnreadCount());
      // Returns cached _unreadCount, not a computed value
      expect(result.current).toBe(2);
      expect(result.current).toBe(useNotificationsStore.getState()._unreadCount);
    });
  });
});
