import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';
import type { DatePreset } from '../routes/worklogs/WorklogsPage';

export interface TempoFilter {
  id: string;
  name: string;
  preset: DatePreset;
  username: string | null;
  displayName: string | null;
}

interface TempoFiltersState {
  savedFilters: TempoFilter[];
  addFilter: (filter: TempoFilter) => void;
  removeFilter: (id: string) => void;
  renameFilter: (id: string, name: string) => void;
}

export const useTempoFiltersStore = create<TempoFiltersState>()(
  persist(
    (set) => ({
      savedFilters: [],
      addFilter: (filter) =>
        set((s) => ({ savedFilters: [...s.savedFilters, filter] })),
      removeFilter: (id) =>
        set((s) => ({ savedFilters: s.savedFilters.filter((f) => f.id !== id) })),
      renameFilter: (id, name) =>
        set((s) => ({
          savedFilters: s.savedFilters.map((f) => (f.id === id ? { ...f, name } : f)),
        })),
    }),
    {
      name: 'tempo-filters-store',
      storage: createTauriStorage('tempo-filters.json'),
      version: 1,
      migrate: (persisted, _version) => persisted as TempoFiltersState,
    },
  ),
);
