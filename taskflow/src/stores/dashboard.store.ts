/**
 * Dashboard store — ephemeral UI state for the developer dashboard.
 *
 * Tracks which tab is currently active. NOT persisted — resets to default on app restart.
 * This is intentional: active tab is session-local UI state, not user preference.
 *
 * Uses Zustand without persist middleware.
 */
import { create } from 'zustand';

/** Available dashboard tabs. */
export type DashTab = 'my-tasks' | 'sprint-board' | 'mr-attention';

interface DashboardState {
  activeTab: DashTab;
  setActiveTab: (tab: DashTab) => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  activeTab: 'my-tasks',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
