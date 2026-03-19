import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

interface PinnedTabsState {
  pinnedKeys: string[];
  togglePin: (key: string) => void;
  removePin: (key: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  isPinned: (key: string) => boolean;
}

export const usePinnedTabsStore = create<PinnedTabsState>()(
  persist(
    (set, get) => ({
      pinnedKeys: [],
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
    }),
    {
      name: 'pinned-tabs-store',
      storage: createTauriStorage('pinned-tabs.json'),
      version: 0,
      migrate: (persisted, _version) => persisted as PinnedTabsState,
    },
  ),
);
