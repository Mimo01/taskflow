import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

type GroupingMode = 'my-day' | 'by-status' | 'by-sprint-parent';
type Scope = 'current-sprint' | 'all-assigned' | 'all-reported';

interface MyTasksState {
  groupingMode: GroupingMode;
  scope: Scope;
  setGroupingMode: (mode: GroupingMode) => void;
  setScope: (scope: Scope) => void;
}

export const useMyTasksStore = create<MyTasksState>()(
  persist(
    (set) => ({
      groupingMode: 'my-day', // D-09: default
      scope: 'current-sprint', // D-09: default
      setGroupingMode: (mode) => set({ groupingMode: mode }),
      setScope: (scope) => set({ scope }),
    }),
    {
      name: 'my-tasks-store',
      storage: createTauriStorage('my-tasks.json'),
      version: 0,
      migrate: (persisted, _version) => persisted as MyTasksState,
    },
  ),
);
