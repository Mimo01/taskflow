import { create } from 'zustand';

interface TrailEntry {
  path: string;
  label: string;
}

interface BreadcrumbState {
  trail: TrailEntry[];
  push: (entry: TrailEntry) => void;
  pop: () => void;
  reset: () => void;
}

export const useBreadcrumbStore = create<BreadcrumbState>((set) => ({
  trail: [],
  push: (entry) => set((s) => ({ trail: [...s.trail, entry] })),
  pop: () => set((s) => ({ trail: s.trail.slice(0, -1) })),
  reset: () => set({ trail: [] }),
}));
