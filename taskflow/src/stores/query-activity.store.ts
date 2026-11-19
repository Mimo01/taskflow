/**
 * query-activity.store — transient Zustand store of TanStack Query cache events (fetch, success,
 * error, invalidated, removed). Newest first, FIFO eviction at the shared retention limit. No
 * persist middleware: cleared on app restart. Written only by hooks/useQueryActivityCapture.
 */
import { create } from 'zustand';
import type { QueryActivityKind } from '../lib/dev-tools/query-activity';
import { useSettingsStore } from './settings.store';

export interface QueryActivityEvent {
  id: string;
  at: number; // epoch ms with fractions
  kind: QueryActivityKind;
  queryHash: string;
  keyLabel: string;
}

interface QueryActivityState {
  events: QueryActivityEvent[];
  append: (event: QueryActivityEvent) => void;
  clear: () => void;
}

const getRetentionLimit = () => {
  try {
    return (useSettingsStore.getState() as { retentionLimit?: number }).retentionLimit ?? 200;
  } catch {
    return 200;
  }
};

export const useQueryActivityStore = create<QueryActivityState>((set) => ({
  events: [],
  append: (event) =>
    set((s) => {
      const limit = getRetentionLimit();
      const next = [event, ...s.events];
      return { events: next.length > limit ? next.slice(0, limit) : next };
    }),
  clear: () => set({ events: [] }),
}));
