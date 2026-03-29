/**
 * update.store — Non-persisted Zustand store for update lifecycle state machine.
 *
 * States: idle -> checking -> available -> downloading -> error (or relaunch on success)
 * Transient (no persist middleware) — status resets on app restart.
 * Per D-06: consistent with debug-log.store pattern.
 * Per D-08: full lifecycle built upfront for Phase 39 UX consumption.
 */
import { create } from 'zustand';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'error';

export interface UpdateState {
  status: UpdateStatus;
  availableVersion: string | null;
  changelog: string | null;
  releaseDate: string | null;
  downloadProgress: number | null;
  errorMessage: string | null;

  setChecking: () => void;
  setAvailable: (version: string, changelog: string | null, date: string | null) => void;
  setDownloading: () => void;
  setProgress: (pct: number) => void;
  setError: (msg: string) => void;
  resetToIdle: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: 'idle',
  availableVersion: null,
  changelog: null,
  releaseDate: null,
  downloadProgress: null,
  errorMessage: null,

  setChecking: () => set({ status: 'checking', errorMessage: null }),
  setAvailable: (version, changelog, date) =>
    set({ status: 'available', availableVersion: version, changelog, releaseDate: date }),
  setDownloading: () => set({ status: 'downloading', downloadProgress: 0 }),
  setProgress: (pct) => set({ downloadProgress: pct }),
  setError: (msg) => set({ status: 'error', errorMessage: msg, downloadProgress: null }),
  resetToIdle: () =>
    set({
      status: 'idle',
      errorMessage: null,
      downloadProgress: null,
    }),
}));
