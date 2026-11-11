/**
 * Composer focus flag -- a one-shot "focus the comment composer of this issue" request.
 *
 * The notification Reply action sets it right before navigating to the issue; CommentComposer
 * consumes it (focus + clear) once it is mounted for the matching key. Session-only (no persist).
 * Lives in a store because onIssueClick only carries a key, so no route signature has to change.
 */
import { create } from 'zustand';

interface ComposerFocusState {
  composerFocus: string | null;
  requestComposerFocus: (issueKey: string) => void;
  clearComposerFocus: () => void;
}

export const useComposerFocus = create<ComposerFocusState>()((set) => ({
  composerFocus: null,
  requestComposerFocus: (issueKey) => set({ composerFocus: issueKey }),
  clearComposerFocus: () => set({ composerFocus: null }),
}));
