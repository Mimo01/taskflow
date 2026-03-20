/**
 * debug-log.store — In-memory Zustand store for API call log entries.
 *
 * Transient (no persist middleware) — logs are cleared on app restart.
 * Max 200 entries enforced with FIFO eviction on overflow.
 */
import { create } from 'zustand';
import { useSettingsStore } from './settings.store';

export interface ApiLogEntry {
  id: string; // crypto.randomUUID()
  timestamp: string; // ISO string, new Date().toISOString()
  source: 'jira' | 'gitlab';
  method: string; // e.g. "GET", "POST"
  url: string;
  requestHeaders: Record<string, string>;
  status: number | null; // null if network error
  durationMs: number;
  responseBody: string; // raw text, truncated to 10_000 chars if longer
  error?: string; // set only on network-level failure (catch block)
  operation?: string; // optional operation label for grouping
}

interface DebugLogState {
  entries: ApiLogEntry[];
  append: (entry: ApiLogEntry) => void;
  clear: () => void;
}

const getRetentionLimit = () => {
  try {
    return (useSettingsStore.getState() as { retentionLimit?: number }).retentionLimit ?? 200;
  } catch {
    return 200;
  }
};

export const useDebugLogStore = create<DebugLogState>((set) => ({
  entries: [],
  append: (entry) =>
    set((s) => {
      const limit = getRetentionLimit();
      const next = [entry, ...s.entries];
      return { entries: next.length > limit ? next.slice(0, limit) : next };
    }),
  clear: () => set({ entries: [] }),
}));
