/**
 * Filter store — shared filter state for backlog and sprint board views.
 *
 * Session-only (no persist) — filter selections reset on app restart.
 * Quickfilter presets are persisted via settings.store.ts.
 */
import { create } from 'zustand'

export interface QuickFilter {
  id: string
  name: string
  epics: string[]
  labels: string[]
  assignees: string[]
}

interface FilterState {
  activeEpics: Set<string>
  activeLabels: Set<string>
  activeAssignees: Set<string>
  setActiveEpics: (epics: Set<string>) => void
  setActiveLabels: (labels: Set<string>) => void
  setActiveAssignees: (assignees: Set<string>) => void
  toggleEpic: (name: string) => void
  toggleLabel: (label: string) => void
  toggleAssignee: (name: string) => void
  clearAll: () => void
  applyQuickFilter: (filter: QuickFilter) => void
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export const useFilterStore = create<FilterState>()((set) => ({
  activeEpics: new Set<string>(),
  activeLabels: new Set<string>(),
  activeAssignees: new Set<string>(),
  setActiveEpics: (epics) => set({ activeEpics: epics }),
  setActiveLabels: (labels) => set({ activeLabels: labels }),
  setActiveAssignees: (assignees) => set({ activeAssignees: assignees }),
  toggleEpic: (name) =>
    set((state) => ({ activeEpics: toggle(state.activeEpics, name) })),
  toggleLabel: (label) =>
    set((state) => ({ activeLabels: toggle(state.activeLabels, label) })),
  toggleAssignee: (name) =>
    set((state) => ({ activeAssignees: toggle(state.activeAssignees, name) })),
  clearAll: () =>
    set({
      activeEpics: new Set<string>(),
      activeLabels: new Set<string>(),
      activeAssignees: new Set<string>(),
    }),
  applyQuickFilter: (filter) =>
    set({
      activeEpics: new Set(filter.epics),
      activeLabels: new Set(filter.labels),
      activeAssignees: new Set(filter.assignees),
    }),
}))
