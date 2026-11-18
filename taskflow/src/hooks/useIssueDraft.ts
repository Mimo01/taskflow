import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type DraftFileRef,
  type EpicDraftSnapshot,
  type IssueDraft,
  type IssueDraftSnapshot,
  useIssueDraftsStore,
} from '@/stores/issue-drafts.store';
import { DRAFT_DEBOUNCE_MS } from './useEditorDraft';

export interface DraftPayload {
  projectKey: string;
  snapshot: IssueDraftSnapshot | EpicDraftSnapshot;
  files: DraftFileRef[];
  /** True once user-entered content exists (D-12); gates id allocation. */
  hasContent: boolean;
}

// Never log draft payloads: they may contain customer data.
export function useIssueDraft({ kind }: { kind: 'issue' | 'epic' }) {
  const idRef = useRef<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const pendingRef = useRef<DraftPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const saveFailed = useIssueDraftsStore((s) => s.saveFailed);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setId = useCallback((id: string | null) => {
    idRef.current = id;
    setDraftId(id);
  }, []);

  const ensureId = useCallback((): string => {
    if (idRef.current === null) setId(crypto.randomUUID());
    return idRef.current as string;
  }, [setId]);

  const flush = useCallback(() => {
    clearTimer();
    const p = pendingRef.current;
    if (!p) return;
    // Never write before hydration: an empty mount must not clobber stored drafts.
    if (!useIssueDraftsStore.persist.hasHydrated()) return;
    // No id yet and no content: nothing to save (D-12).
    if (idRef.current === null && !p.hasContent) {
      pendingRef.current = null;
      return;
    }
    pendingRef.current = null;
    const id = ensureId();
    const state = useIssueDraftsStore.getState();
    const existing = state.drafts[id];
    const fingerprint = (v: { snapshot: unknown; files: unknown; projectKey: string }) =>
      JSON.stringify({ snapshot: v.snapshot, files: v.files, projectKey: v.projectKey });
    if (existing && fingerprint(existing) === fingerprint(p)) return;
    state.upsertDraft({
      id,
      kind: kindRef.current,
      updatedAt: Date.now(),
      projectKey: p.projectKey,
      snapshot: p.snapshot,
      files: p.files,
    } as IssueDraft);
  }, [clearTimer, ensureId]);

  const schedule = useCallback(
    (p: DraftPayload) => {
      if (idRef.current === null && !p.hasContent) {
        pendingRef.current = null;
        clearTimer();
        return;
      }
      pendingRef.current = p;
      clearTimer();
      timerRef.current = setTimeout(flush, DRAFT_DEBOUNCE_MS);
    },
    [clearTimer, flush],
  );

  const adopt = useCallback(
    (id: string | null) => {
      clearTimer();
      pendingRef.current = null;
      setId(id);
    },
    [clearTimer, setId],
  );

  const discard = useCallback((): IssueDraft | undefined => {
    clearTimer();
    pendingRef.current = null;
    const id = idRef.current;
    const removed = id === null ? undefined : useIssueDraftsStore.getState().removeDraft(id);
    setId(null);
    return removed;
  }, [clearTimer, setId]);

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

  return { draftId, ensureId, adopt, schedule, flush, discard, saveFailed };
}
