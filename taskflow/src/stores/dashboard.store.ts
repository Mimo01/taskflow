/**
 * Dashboard store — ephemeral UI state for the developer and PM dashboards.
 *
 * Tracks which tab is currently active. NOT persisted — resets to default on app restart.
 * This is intentional: active tab is session-local UI state, not user preference.
 *
 * Uses Zustand without persist middleware.
 */
import { create } from 'zustand';

/** Available developer dashboard tabs. */
export type DashTab = 'my-tasks' | 'sprint-board' | 'mr-attention';

/** Available PM dashboard tabs. */
export type PmDashTab = 'sprint-progress' | 'workload' | 'releases';

interface DashboardState {
  activeTab: DashTab;
  setActiveTab: (tab: DashTab) => void;
  pmActiveTab: PmDashTab;
  setPmActiveTab: (tab: PmDashTab) => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  activeTab: 'my-tasks',
  setActiveTab: (tab) => set({ activeTab: tab }),
  pmActiveTab: 'sprint-progress',
  setPmActiveTab: (tab) => set({ pmActiveTab: tab }),
}));
