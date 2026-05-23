import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';
import type { DatePreset } from '../services/tempo/types';

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
  moveFilter: (id: string, direction: 'left' | 'right' | 'front' | 'back') => void;
}

export const useTempoFiltersStore = create<TempoFiltersState>()(
  persist(
    (set) => ({
      savedFilters: [],
      addFilter: (filter) => set((s) => ({ savedFilters: [...s.savedFilters, filter] })),
      removeFilter: (id) =>
        set((s) => ({ savedFilters: s.savedFilters.filter((f) => f.id !== id) })),
      renameFilter: (id, name) =>
        set((s) => ({
          savedFilters: s.savedFilters.map((f) => (f.id === id ? { ...f, name } : f)),
        })),
      moveFilter: (id, direction) =>
        set((s) => {
          const idx = s.savedFilters.findIndex((f) => f.id === id);
          if (idx === -1) return s;
          const arr = [...s.savedFilters];
          const [item] = arr.splice(idx, 1);
          if (direction === 'left') arr.splice(Math.max(0, idx - 1), 0, item);
          else if (direction === 'right') arr.splice(Math.min(arr.length, idx + 1), 0, item);
          else if (direction === 'front') arr.unshift(item);
          else arr.push(item);
          return { savedFilters: arr };
        }),
    }),
    {
      name: 'tempo-filters-store',
      storage: createTauriStorage('tempo-filters.json'),
      version: 1,
      migrate: (persisted, _version) => persisted as TempoFiltersState,
    },
  ),
);
