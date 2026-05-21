/**
 * operation-profiler.store — In-memory Zustand store for operation-level fetch profiling.
 *
 * Groups fetches by operation label with wall-clock and server timing.
 * Not persisted — data is cleared on app restart.
 */
import { create } from 'zustand';
import { useSettingsStore } from './settings.store';

export interface FetchRecord {
  id: string;
  source: 'jira' | 'gitlab' | 'updater' | 'aio' | 'tempo';
  method: string;
  url: string;
  status: number | null;
  durationMs: number;
  startTime: number;
  responseSize?: number;
  error?: string;
}

export interface Operation {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  wallClockMs: number;
  serverTimeMs: number;
  fetches: FetchRecord[];
  timestamp: string;
}

interface ActiveOp {
  label: string;
  fetches: FetchRecord[];
  timer: ReturnType<typeof setTimeout>;
}

interface OperationProfilerState {
  operations: Operation[];
  ungrouped: FetchRecord[];
  activeOps: Map<string, ActiveOp>;
  addFetch: (label: string | undefined, record: FetchRecord) => void;
  clear: () => void;
}

const OP_TIMEOUT_MS = 2000;

const getRetentionLimit = () => {
  try {
    return (useSettingsStore.getState() as { retentionLimit?: number }).retentionLimit ?? 200;
  } catch {
    return 200;
  }
};

export const useOperationProfilerStore = create<OperationProfilerState>((set, get) => ({
  operations: [],
  ungrouped: [],
  activeOps: new Map(),

  addFetch: (label, record) => {
    if (label === undefined) {
      set((s) => ({ ungrouped: [record, ...s.ungrouped] }));
      return;
    }

    const state = get();
    const existing = state.activeOps.get(label);

    const finalizeOp = (opLabel: string) => {
      const current = get();
      const active = current.activeOps.get(opLabel);
      if (!active) return;

      const fetches = active.fetches;
      const startTime = Math.min(...fetches.map((f) => f.startTime));
      const endTime = Math.max(...fetches.map((f) => f.startTime + f.durationMs));
      const wallClockMs = Math.round(endTime - startTime);
      const serverTimeMs = Math.round(fetches.reduce((sum, f) => sum + f.durationMs, 0));

      const operation: Operation = {
        id: crypto.randomUUID(),
        label: opLabel,
        startTime,
        endTime,
        wallClockMs,
        serverTimeMs,
        fetches,
        timestamp: new Date().toISOString(),
      };

      const limit = getRetentionLimit();
      const nextOps = [operation, ...current.operations];
      const newActiveOps = new Map(current.activeOps);
      newActiveOps.delete(opLabel);

      set({
        operations: nextOps.length > limit ? nextOps.slice(0, limit) : nextOps,
        activeOps: newActiveOps,
      });
    };

    if (existing) {
      clearTimeout(existing.timer);
      existing.fetches.push(record);
      const timer = setTimeout(() => finalizeOp(label), OP_TIMEOUT_MS);
      const newActiveOps = new Map(state.activeOps);
      newActiveOps.set(label, { ...existing, timer });
      set({ activeOps: newActiveOps });
    } else {
      const timer = setTimeout(() => finalizeOp(label), OP_TIMEOUT_MS);
      const newActiveOps = new Map(state.activeOps);
      newActiveOps.set(label, { label, fetches: [record], timer });
      set({ activeOps: newActiveOps });
    }
  },

  clear: () => {
    const state = get();
    for (const active of state.activeOps.values()) {
      clearTimeout(active.timer);
    }
    set({ operations: [], ungrouped: [], activeOps: new Map() });
  },
}));
