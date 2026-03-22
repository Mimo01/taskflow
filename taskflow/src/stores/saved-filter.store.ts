/**
 * Saved filter store -- manages Jira saved filter state independently from settings store.
 *
 * Session-only (no persist) -- filter list refreshed from Jira on each session.
 * Tracks which saved filter is currently active for applying to the board view.
 */
import { create } from 'zustand';

import type { JiraSavedFilter } from '@/services/jira/types';

interface SavedFilterState {
  savedFilters: JiraSavedFilter[];
  activeFilterId: string | null;
  isLoading: boolean;
  setSavedFilters: (filters: JiraSavedFilter[]) => void;
  addSavedFilter: (filter: JiraSavedFilter) => void;
  updateSavedFilter: (filterId: string, updated: JiraSavedFilter) => void;
  removeSavedFilter: (filterId: string) => void;
  setActiveFilter: (filterId: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useSavedFilterStore = create<SavedFilterState>()((set) => ({
  savedFilters: [],
  activeFilterId: null,
  isLoading: false,
  setSavedFilters: (filters) => set({ savedFilters: filters }),
  addSavedFilter: (filter) =>
    set((state) => ({ savedFilters: [...state.savedFilters, filter] })),
  updateSavedFilter: (filterId, updated) =>
    set((state) => ({
      savedFilters: state.savedFilters.map((f) => (f.id === filterId ? updated : f)),
    })),
  removeSavedFilter: (filterId) =>
    set((state) => ({
      savedFilters: state.savedFilters.filter((f) => f.id !== filterId),
      activeFilterId: state.activeFilterId === filterId ? null : state.activeFilterId,
    })),
  setActiveFilter: (filterId) => set({ activeFilterId: filterId }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
