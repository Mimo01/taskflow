import { act } from '@testing-library/react';
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

import { usePinnedTabsStore } from './pinned-tabs.store';

describe('pinned-tabs.store', () => {
  beforeEach(() => {
    act(() => {
      usePinnedTabsStore.setState({ pinnedKeys: [] });
    });
  });

  it('togglePin adds a key', () => {
    act(() => {
      usePinnedTabsStore.getState().togglePin('PROJ-1');
    });
    expect(usePinnedTabsStore.getState().pinnedKeys).toEqual(['PROJ-1']);
  });

  it('togglePin twice removes the key (toggle off)', () => {
    act(() => {
      usePinnedTabsStore.getState().togglePin('PROJ-1');
    });
    act(() => {
      usePinnedTabsStore.getState().togglePin('PROJ-1');
    });
    expect(usePinnedTabsStore.getState().pinnedKeys).toEqual([]);
  });

  it('isPinned returns true after togglePin', () => {
    act(() => {
      usePinnedTabsStore.getState().togglePin('PROJ-1');
    });
    expect(usePinnedTabsStore.getState().isPinned('PROJ-1')).toBe(true);
  });

  it('removePin removes a pinned key', () => {
    act(() => {
      usePinnedTabsStore.getState().togglePin('PROJ-1');
    });
    act(() => {
      usePinnedTabsStore.getState().removePin('PROJ-1');
    });
    expect(usePinnedTabsStore.getState().pinnedKeys).toEqual([]);
  });

  it('reorder swaps positions', () => {
    act(() => {
      usePinnedTabsStore.setState({ pinnedKeys: ['A', 'B', 'C'] });
    });
    act(() => {
      usePinnedTabsStore.getState().reorder(0, 1);
    });
    expect(usePinnedTabsStore.getState().pinnedKeys).toEqual(['B', 'A', 'C']);
  });

  describe('cycle metadata actions', () => {
    beforeEach(() => {
      act(() => {
        usePinnedTabsStore.setState({ pinnedCycleMeta: {} } as Parameters<typeof usePinnedTabsStore.setState>[0]);
      });
    });

    it.todo('setPinnedCycleMeta stores {name, projectKey} under the cycle key in pinnedCycleMeta');
    it.todo('clearCycleMeta removes the entry for a given key from pinnedCycleMeta');
    it.todo('pinnedCycleMeta defaults to empty object on fresh store (no persisted state)');
    it.todo('setPinnedCycleMeta for multiple keys stores all entries independently');
  });

  describe('v0→v1 migration', () => {
    it.todo('sets pinnedCycleMeta = {} on persisted state with version < 1');
  });
});
