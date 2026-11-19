/**
 * wiki-editor-log.store — In-memory log of wiki editor events, shown in Developer Tools → Editor.
 *
 * Transient (no persist) — cleared on restart or via Clear Logs. Newest first, capped at the
 * dev tools retention limit (default 200). Observation only: nothing here alters the editor.
 */
import { create } from 'zustand';
import { useSettingsStore } from './settings.store';

export type WikiEditorLogEvent =
  | 'open'
  | 'close'
  | 'mode-switch'
  | 'load-failed'
  | 'save-failed'
  | 'save-recovered'
  | 'submit'
  | 'submit-blocked'
  | 'external-reset'
  | 'crash';

export type WikiEditorLogLevel = 'info' | 'warn' | 'error';

export interface WikiEditorLogEntry {
  id: string;
  /** ISO timestamp. */
  timestamp: string;
  /** Per-WikiEditor-mount id; null for the crash boundary. */
  session: number | null;
  event: WikiEditorLogEvent;
  level: WikiEditorLogLevel;
  /** One-line summary shown on the card row. */
  message: string;
  context?: { label?: string; issueKey?: string | null; preset?: string };
  /** Metadata only — never document text. */
  details?: Record<string, string | number | boolean | null>;
  /** Failure events only. */
  markup?: { original?: string; produced?: string };
  error?: { message: string; stack?: string; componentStack?: string };
  /** Failed saves: the first top-level block whose saved text reads back differently. */
  diagnosis?: SaveDiagnosisLog;
}

/** Mirrors SaveDiagnosis from the wiki engine (kept structural so this store never imports it). */
export interface SaveDiagnosisLog {
  reason: string;
  block: number | null;
  blockType: string | null;
  expected: unknown;
  readBack: unknown;
  savedSlice: string | null;
}

interface WikiEditorLogState {
  entries: WikiEditorLogEntry[];
  append: (entry: WikiEditorLogEntry) => void;
  clear: () => void;
}

const getRetentionLimit = () => {
  try {
    return (useSettingsStore.getState() as { retentionLimit?: number }).retentionLimit ?? 200;
  } catch {
    return 200;
  }
};

export const useWikiEditorLogStore = create<WikiEditorLogState>((set) => ({
  entries: [],
  append: (entry) =>
    set((s) => {
      const next = [entry, ...s.entries];
      const limit = getRetentionLimit();
      return { entries: next.length > limit ? next.slice(0, limit) : next };
    }),
  clear: () => set({ entries: [] }),
}));
