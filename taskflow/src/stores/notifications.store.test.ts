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
import {
  DISMISSED_CAP,
  getKnownNotificationIds,
  useNotificationsStore,
  useUnreadCount,
} from './notifications.store';

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
        dismissedIds: [],
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
        useNotificationsStore.getState().setItems([makeItem('item-1'), makeItem('item-2')]);
      });

      const { result } = renderHook(() => useUnreadCount());
      // Returns cached _unreadCount, not a computed value
      expect(result.current).toBe(2);
      expect(result.current).toBe(useNotificationsStore.getState()._unreadCount);
    });
  });

  describe('NOTIF-09: readIds pruning and dismissed tombstones', () => {
    const st = () => useNotificationsStore.getState();
    const many = (n: number, prefix = 'n') =>
      Array.from({ length: n }, (_, i) => makeItem(`${prefix}-${i}`));

    it('prependItems keeps readIds within items (<= 200)', () => {
      const first = many(220);
      act(() => {
        st().setItems(first.slice(0, 200));
        st().markItemsRead(first.slice(0, 200).map((i) => i.id));
      });
      act(() => st().prependItems(many(250, 'fresh')));
      expect(st().items).toHaveLength(200);
      const ids = new Set(st().items.map((i) => i.id));
      expect(st().readIds.length).toBeLessThanOrEqual(200);
      expect(st().readIds.every((id) => ids.has(id))).toBe(true);
    });

    it('setItems prunes readIds to the new items', () => {
      act(() => {
        st().setItems([makeItem('a'), makeItem('b')]);
        st().markItemsRead(['a', 'b']);
      });
      act(() => st().setItems([makeItem('b')]));
      expect(st().readIds).toEqual(['b']);
    });

    it('removeItem tombstones and prependItems does not re-add', () => {
      act(() => st().setItems([makeItem('a')]));
      act(() => st().removeItem('a'));
      expect(st().items).toHaveLength(0);
      expect(st().dismissedIds).toContain('a');
      act(() => st().prependItems([makeItem('a')]));
      expect(st().items).toHaveLength(0);
    });

    it('removeItems tombstones both and updates counters', () => {
      act(() => st().setItems([makeItem('a'), makeItem('b'), makeItem('c')]));
      act(() => st().removeItems(['a', 'b']));
      expect(st().dismissedIds).toEqual(['a', 'b']);
      expect(st()._unreadCount).toBe(1);
      expect(st()._jiraUnreadCount).toBe(1);
      expect(st()._gitlabUnreadCount).toBe(0);
    });

    it('caps tombstones and dedupes', () => {
      const ids = Array.from({ length: 600 }, (_, i) => `t-${i}`);
      act(() => st().removeItems(ids));
      act(() => st().removeItems(['t-599']));
      expect(st().dismissedIds).toHaveLength(DISMISSED_CAP);
      expect(st().dismissedIds).toContain('t-599');
      expect(st().dismissedIds).not.toContain('t-0');
      expect(st().dismissedIds.filter((x) => x === 't-599')).toHaveLength(1);
    });

    it('getKnownNotificationIds is the union of items and tombstones', () => {
      const set = getKnownNotificationIds({ items: [makeItem('a')], dismissedIds: ['z'] });
      expect([...set].sort()).toEqual(['a', 'z']);
    });

    it('persist merge handles missing / invalid dismissedIds and prunes readIds', () => {
      const merge = useNotificationsStore.persist.getOptions().merge as (
        p: unknown,
        c: unknown,
      ) => { dismissedIds: string[]; readIds: string[] };
      const cur = st();
      expect(merge({ items: [], readIds: [] }, cur).dismissedIds).toEqual([]);
      expect(merge({ items: [], readIds: [], dismissedIds: 'x' }, cur).dismissedIds).toEqual([]);
      const out = merge(
        { items: [makeItem('a')], readIds: ['a', 'gone'], dismissedIds: ['d', 5] },
        cur,
      );
      expect(out.readIds).toEqual(['a']);
      expect(out.dismissedIds).toEqual(['d']);
    });

    it('partialize includes dismissedIds; clearAll resets it', () => {
      act(() => st().removeItems(['q']));
      const partial = useNotificationsStore.persist.getOptions().partialize?.(st());
      expect(partial).toHaveProperty('dismissedIds', ['q']);
      act(() => st().clearAll());
      expect(st().dismissedIds).toEqual([]);
    });
  });

  describe('NOTIF-04: bulk triage actions', () => {
    const st = () => useNotificationsStore.getState();
    const gl = (id: string): NotificationItem => ({ ...makeItem(id), source: 'gitlab' });

    it('markItemsRead is idempotent and markItemsUnread is scoped', () => {
      act(() => st().setItems([makeItem('a'), makeItem('b'), makeItem('c')]));
      act(() => st().markItemsRead(['a', 'b']));
      act(() => st().markItemsRead(['a', 'b']));
      expect(st().readIds).toEqual(['a', 'b']);
      expect(st()._unreadCount).toBe(1);
      act(() => st().markItemsUnread(['a']));
      expect(st().readIds).toEqual(['b']);
      expect(st()._unreadCount).toBe(2);
    });

    it('clearRead removes read items and tombstones them', () => {
      act(() => st().setItems([makeItem('a'), makeItem('b')]));
      act(() => st().markItemsRead(['a']));
      act(() => st().clearRead());
      expect(st().items.map((i) => i.id)).toEqual(['b']);
      expect(st().dismissedIds).toEqual(['a']);
    });

    it("clearRead('jira') leaves read GitLab items", () => {
      act(() => st().setItems([makeItem('j'), gl('g')]));
      act(() => st().markItemsRead(['j', 'g']));
      act(() => st().clearRead('jira'));
      expect(st().items.map((i) => i.id)).toEqual(['g']);
      expect(st().readIds).toEqual(['g']);
    });
  });
});
