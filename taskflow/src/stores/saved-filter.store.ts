/**
 * Saved filter store — manages Jira saved/favourite filters in memory.
 *
 * Session-only (no persist middleware) — filter list reloads from Jira on each
 * app launch. Active filter selection resets on restart.
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

export const useSavedFilterStore = create<SavedFilterState>((set) => ({
  savedFilters: [],
  activeFilterId: null,
  isLoading: false,
  setSavedFilters: (filters) => set({ savedFilters: filters }),
  addSavedFilter: (filter) => set((s) => ({ savedFilters: [...s.savedFilters, filter] })),
  updateSavedFilter: (filterId, updated) =>
    set((s) => ({
      savedFilters: s.savedFilters.map((f) => (f.id === filterId ? updated : f)),
    })),
  removeSavedFilter: (filterId) =>
    set((s) => ({
      savedFilters: s.savedFilters.filter((f) => f.id !== filterId),
      activeFilterId: s.activeFilterId === filterId ? null : s.activeFilterId,
    })),
  setActiveFilter: (filterId) => set({ activeFilterId: filterId }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
