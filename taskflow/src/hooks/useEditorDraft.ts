import { useCallback, useEffect, useRef } from 'react';
import {
  type Draft,
  type DraftKind,
  useDraftsHydrated,
  useDraftsStore,
} from '@/stores/drafts.store';

export const DRAFT_DEBOUNCE_MS = 500;

interface UseEditorDraftArgs {
  /** Draft key (see lib/draft-keys); null makes the hook inert. */
  key: string | null;
  kind: DraftKind;
  issueKey: string;
  /** Jira text the edit started from (edit drafts); undefined for new comments. */
  base?: string;
  /** Current live Jira text, for the stale check (D-05). */
  liveBase?: string | null;
}

interface Pending {
  key: string;
  kind: DraftKind;
  issueKey: string;
  base: string | undefined;
  text: string;
}

export type EditorDraftState = 'draft' | 'stale' | null;

export function useEditorDraft({ key, kind, issueKey, base, liveBase }: UseEditorDraftArgs) {
  const hydrated = useDraftsHydrated();
  const draft: Draft | undefined = useDraftsStore((s) => (key ? s.drafts[key] : undefined));

  const pendingRef = useRef<Pending | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest identity, so schedule() always captures the draft being edited.
  const latestRef = useRef({ key, kind, issueKey, base });
  latestRef.current = { key, kind, issueKey, base };

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    clearTimer();
    const p = pendingRef.current;
    if (!p) return;
    // Never write before hydration: an empty mount must not clobber a stored draft.
    if (!useDraftsStore.persist.hasHydrated()) return;
    pendingRef.current = null;
    const state = useDraftsStore.getState();
    if (state.drafts[p.key]?.text === p.text) return;
    state.setDraft(p.key, { kind: p.kind, issueKey: p.issueKey, text: p.text, base: p.base });
  }, [clearTimer]);

  const schedule = useCallback(
    (text: string) => {
      const l = latestRef.current;
      if (l.key === null) return;
      pendingRef.current = {
        key: l.key,
        kind: l.kind,
        issueKey: l.issueKey,
        base: l.base,
        text,
      };
      clearTimer();
      timerRef.current = setTimeout(flush, DRAFT_DEBOUNCE_MS);
    },
    [clearTimer, flush],
  );

  const discard = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    const k = latestRef.current.key;
    if (k !== null) useDraftsStore.getState().clearDraft(k);
  }, [clearTimer]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [flush]);

  // Switching key (e.g. comment-edit switch) flushes the draft being left.
  // biome-ignore lint/correctness/useExhaustiveDependencies: key is the trigger
  useEffect(() => () => flush(), [key, flush]);

  let state: EditorDraftState = null;
  if (key !== null && draft) {
    state =
      draft.base !== undefined && liveBase != null && draft.base !== liveBase ? 'stale' : 'draft';
  }

  return { hydrated, draft, state, schedule, flush, discard };
}
