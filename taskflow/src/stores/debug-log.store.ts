/**
 * debug-log.store — In-memory Zustand store for API call log entries.
 *
 * Transient (no persist middleware) — logs are cleared on app restart.
 * Retention limit enforced with FIFO eviction on overflow. Entries are appended when a request
 * STARTS (state 'pending') and patched in place via `update` when it completes.
 */
import { create } from 'zustand';
import type { EntryState } from '../lib/dev-tools/log-entry';
import { useSettingsStore } from './settings.store';

export interface ApiLogEntry {
  id: string; // crypto.randomUUID()
  timestamp: string; // ISO string, new Date().toISOString()
  source: 'jira' | 'gitlab' | 'updater' | 'aio' | 'tempo';
  method: string; // e.g. "GET", "POST"
  url: string;
  requestHeaders: Record<string, string>;
  // raw text body of the request; pretty-printed if JSON, truncated to 5_000 chars
  requestBody?: string;
  status: number | null; // null if network error
  durationMs: number;
  responseBody: string; // raw text, full (pretty-printed if JSON)
  // response headers with secrets redacted (set-cookie etc.); absent when capture is off / network error
  responseHeaders?: Record<string, string>;
  error?: string; // set only on network-level failure (catch block)
  operation?: string; // optional operation label for grouping
  state?: EntryState; // lifecycle; absent on legacy entries (derived from status)
  startedAt?: number; // epoch ms with fractions (high resolution) at request start
  endedAt?: number; // epoch ms with fractions at completion; absent while pending
  route?: string; // app route path at request start, used for timeline load grouping
  queuedAt?: number; // epoch ms the call was enqueued on the Jira limiter, when it waited for a slot
}

interface DebugLogState {
  entries: ApiLogEntry[];
  append: (entry: ApiLogEntry) => void;
  /** Patch an entry in place (new object, same index). No-op when the id was evicted. */
  update: (id: string, patch: Partial<ApiLogEntry>) => void;
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
  update: (id, patch) =>
    set((s) => {
      if (!s.entries.some((e) => e.id === id)) return s;
      return { entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
    }),
  clear: () => set({ entries: [] }),
}));
