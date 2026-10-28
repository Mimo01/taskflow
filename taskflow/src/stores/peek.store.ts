/**
 * Peek store -- which issue is currently open in the PeekPanel sidebar.
 *
 * Session-only (no persist). Lifted out of main.tsx so rows/cards can highlight
 * the peeked issue via useIsPeeked without prop-drilling through every page.
 */
import { create } from 'zustand';

interface PeekState {
  peekIssueKey: string | null;
  setPeekIssueKey: (key: string | null) => void;
}

export const usePeekStore = create<PeekState>()((set) => ({
  peekIssueKey: null,
  setPeekIssueKey: (key) => set({ peekIssueKey: key }),
}));

/** Boolean selector: a row re-renders only when its own peeked state flips. */
export function useIsPeeked(key: string): boolean {
  return usePeekStore((s) => s.peekIssueKey === key);
}
