import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

export interface RecentItem {
  type: 'jira' | 'gitlab';
  id: string; // Issue key (PROJ-123) or MR iid string
  url?: string; // For GitLab MRs -- browser open URL
  title?: string; // Cached display title so it survives across sessions
  timestamp: number; // Date.now() when opened
}

interface RecentItemsState {
  items: RecentItem[];
  pushItem: (item: Omit<RecentItem, 'timestamp'>) => void;
}

export const useRecentItemsStore = create<RecentItemsState>()(
  persist(
    (set) => ({
      items: [],
      pushItem: (item) =>
        set((s) => {
          const existing = s.items.find((i) => i.type === item.type && i.id === item.id);
          const filtered = s.items.filter((i) => !(i.type === item.type && i.id === item.id));
          // Preserve existing title if caller didn't provide one
          const title = item.title ?? existing?.title;
          return {
            items: [
              { ...item, ...(title ? { title } : {}), timestamp: Date.now() },
              ...filtered,
            ].slice(0, 10),
          };
        }),
    }),
    {
      name: 'recent-items-store',
      storage: createTauriStorage('recent-items.json'),
      version: 0,
      migrate: (persisted, _version) => persisted as RecentItemsState,
    },
  ),
);
