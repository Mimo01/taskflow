import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LazyStore } from '@tauri-apps/plugin-store';

export interface RecentItem {
  type: 'jira' | 'gitlab';
  id: string;        // Issue key (PROJ-123) or MR iid string
  url?: string;      // For GitLab MRs -- browser open URL
  title?: string;    // Cached display title so it survives across sessions
  timestamp: number;  // Date.now() when opened
}

const tauriStore = new LazyStore('recent-items.json');

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
          return { items: [{ ...item, ...(title ? { title } : {}), timestamp: Date.now() }, ...filtered].slice(0, 10) };
        }),
    }),
    {
      name: 'recent-items-store',
      storage: tauriStorage,
      version: 0,
      migrate: (persisted, _version) => persisted as unknown as RecentItemsState,
    },
  ),
);
