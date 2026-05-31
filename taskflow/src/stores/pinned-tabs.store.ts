import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

interface PinnedTabsState {
  pinnedKeys: string[];
  pinnedCycleMeta: Record<string, { name: string; projectKey: string }>;
  pinnedReleaseMeta: Record<string, { name: string; versionId: string; projectKey: string }>;
  togglePin: (key: string) => void;
  removePin: (key: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  isPinned: (key: string) => boolean;
  setPinnedCycleMeta: (key: string, meta: { name: string; projectKey: string }) => void;
  clearCycleMeta: (key: string) => void;
  setPinnedReleaseMeta: (
    key: string,
    meta: { name: string; versionId: string; projectKey: string },
  ) => void;
  clearReleaseMeta: (key: string) => void;
}

export const usePinnedTabsStore = create<PinnedTabsState>()(
  persist(
    (set, get) => ({
      pinnedKeys: [],
      pinnedCycleMeta: {},
      pinnedReleaseMeta: {},
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
      setPinnedReleaseMeta: (key, meta) =>
        set((s) => ({ pinnedReleaseMeta: { ...s.pinnedReleaseMeta, [key]: meta } })),
      clearReleaseMeta: (key) =>
        set((s) => {
          const next = { ...s.pinnedReleaseMeta };
          delete next[key];
          return { pinnedReleaseMeta: next };
        }),
    }),
    {
      name: 'pinned-tabs-store',
      storage: createTauriStorage('pinned-tabs.json'),
      version: 2,
      migrate: (persisted, version) => {
        const s = persisted as PinnedTabsState;
        if (version < 1) {
          s.pinnedCycleMeta = {};
        }
        if (version < 2) {
          s.pinnedReleaseMeta = {};
        }
        return s;
      },
    },
  ),
);
