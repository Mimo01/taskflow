import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

interface AioCyclesSelectionState {
  byProjectKey: Record<string, number>;
  /** Cycle-list status filter; global (not per project). */
  statusFilter: 'open' | 'all';
  setStatusFilter: (filter: 'open' | 'all') => void;
  getSelectedFolder: (projectKey: string) => number | null;
  setSelectedFolder: (projectKey: string, folderID: number) => void;
  clearSelectedFolder: (projectKey: string) => void;
}

export const useAioCyclesSelectionStore = create<AioCyclesSelectionState>()(
  persist(
    (set, get) => ({
      byProjectKey: {},
      statusFilter: 'open',
      setStatusFilter: (filter) => set({ statusFilter: filter === 'all' ? 'all' : 'open' }),
      getSelectedFolder: (projectKey: string) => {
        const value = get().byProjectKey[projectKey];
        return value !== undefined ? value : null;
      },
      setSelectedFolder: (projectKey: string, folderID: number) =>
        set((s) => ({
          byProjectKey: { ...s.byProjectKey, [projectKey]: folderID },
        })),
      clearSelectedFolder: (projectKey: string) =>
        set((s) => {
          const { [projectKey]: _removed, ...rest } = s.byProjectKey;
          return { byProjectKey: rest };
        }),
    }),
    {
      name: 'aio-cycles-selection-store',
      storage: createTauriStorage('aio-cycles-selection.json'),
      version: 0,
      migrate: (persisted, _version) => persisted as AioCyclesSelectionState,
    },
  ),
);
