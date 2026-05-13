import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

interface PinnedTabsState {
  pinnedKeys: string[];
  pinnedCycleMeta: Record<string, { name: string; projectKey: string }>;
  togglePin: (key: string) => void;
  removePin: (key: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  isPinned: (key: string) => boolean;
  setPinnedCycleMeta: (key: string, meta: { name: string; projectKey: string }) => void;
  clearCycleMeta: (key: string) => void;
}

export const usePinnedTabsStore = create<PinnedTabsState>()(
  persist(
    (set, get) => ({
      pinnedKeys: [],
      pinnedCycleMeta: {},
      togglePin: (key) =>
        set((s) => ({
          pinnedKeys: s.pinnedKeys.includes(key)
            ? s.pinnedKeys.filter((k) => k !== key)
            : [...s.pinnedKeys, key],
        })),
      removePin: (key) =>
        set((s) => ({
          pinnedKeys: s.pinnedKeys.filter((k) => k !== key),
        })),
      reorder: (fromIndex, toIndex) =>
        set((s) => {
          const next = [...s.pinnedKeys];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { pinnedKeys: next };
        }),
      isPinned: (key) => get().pinnedKeys.includes(key),
      setPinnedCycleMeta: (key, meta) =>
        set((s) => ({ pinnedCycleMeta: { ...s.pinnedCycleMeta, [key]: meta } })),
      clearCycleMeta: (key) =>
        set((s) => {
          const next = { ...s.pinnedCycleMeta };
          delete next[key];
          return { pinnedCycleMeta: next };
        }),
    }),
    {
      name: 'pinned-tabs-store',
      storage: createTauriStorage('pinned-tabs.json'),
      version: 1,
      migrate: (persisted, version) => {
        const s = persisted as PinnedTabsState;
        if (version < 1) {
          s.pinnedCycleMeta = {};
        }
        return s;
      },
    },
  ),
);
