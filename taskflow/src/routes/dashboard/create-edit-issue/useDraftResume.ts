import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { type Dispatch, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { WikiEditorHandle } from '@/components/wiki-editor/types';
import { useProjectFixVersions } from '@/hooks/useProjectFixVersions';
import { type StaleNotes, snapshotToFormPatch, validateSnapshot } from '@/lib/issue-draft-snapshot';
import { type CreatemetaField, fetchIssueDescription } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import {
  type DraftFileRef,
  type IssueDraftSnapshot,
  useIssueDraftsHydrated,
  useIssueDraftsStore,
} from '@/stores/issue-drafts.store';
import type { FormAction, FormState, IssueType } from './useCreateEditForm';

interface Options {
  /** True only for an open Create modal. */
  open: boolean;
  resumeDraftId: string | null | undefined;
  dispatch: Dispatch<FormAction>;
  issueDraft: { adopt: (id: string | null) => void };
  staged: { restore: (refs: DraftFileRef[]) => Promise<File[]> };
  editorRef: RefObject<WikiEditorHandle | null>;
  creatmetaFields: CreatemetaField[] | undefined;
  creatmetaLoading: boolean;
  selectedIssueType: IssueType;
  jiraBaseUrl: string | null | undefined;
}

const PREVIEW_MAX_FRAMES = 120;

// A query that will never produce data (disabled) or already has: not worth waiting for.
function settled(q: UseQueryResult<unknown>): boolean {
  return q.status !== 'pending' || q.fetchStatus === 'idle';
}

/**
 * Resume an issue draft into the Create modal: restore every field and file once drafts are
 * hydrated, then validate stale pieces once against live data (D-14, D-15). Validation only
 * clears pieces and leaves a note; it never blocks submit. Never log draft content.
 */
export function useDraftResume({
  open,
  resumeDraftId,
  dispatch,
  issueDraft,
  staged,
  editorRef,
  creatmetaFields,
  creatmetaLoading,
  selectedIssueType,
  jiraBaseUrl,
}: Options) {
  const hydrated = useIssueDraftsHydrated();
  const [snapshot, setSnapshot] = useState<IssueDraftSnapshot | null>(null);
  const [resumedProjectKey, setResumedProjectKey] = useState<string | null>(null);
  const [staleNotes, setStaleNotes] = useState<StaleNotes | undefined>(undefined);
  const resumedOnceRef = useRef<string | null>(null);
  const validatedRef = useRef(false);
  const blobUrlsRef = useRef<string[]>([]);
  const adoptRef = useRef(issueDraft.adopt);
  adoptRef.current = issueDraft.adopt;
  const restoreRef = useRef(staged.restore);
  restoreRef.current = staged.restore;

  const revokeAll = useCallback(() => {
    for (const url of blobUrlsRef.current) URL.revokeObjectURL(url);
    blobUrlsRef.current = [];
  }, []);

  // Restore once per open session, after drafts hydrated (DRAFT-06).
  useEffect(() => {
    if (!open) {
      resumedOnceRef.current = null;
      validatedRef.current = false;
      revokeAll();
      setSnapshot(null);
      setResumedProjectKey(null);
      setStaleNotes(undefined);
      return;
    }
    if (!resumeDraftId || !hydrated) return;
    if (resumedOnceRef.current === resumeDraftId) return;
    resumedOnceRef.current = resumeDraftId;
    validatedRef.current = false;

    const draft = useIssueDraftsStore.getState().drafts[resumeDraftId];
    if (!draft || draft.kind !== 'issue') {
      adoptRef.current(null);
      return;
    }
    adoptRef.current(draft.id);
    dispatch({ type: 'HYDRATE', state: snapshotToFormPatch(draft.snapshot) });
    setSnapshot(draft.snapshot);
    setResumedProjectKey(draft.projectKey);

    void restoreRef.current(draft.files).then((files) => {
      // Previews only for images shown in <img>; never blob URLs for iframe/embed types.
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const url = URL.createObjectURL(file);
        blobUrlsRef.current.push(url);
        let frames = 0;
        const apply = () => {
          // The handle can briefly point at a destroyed editor instance; retry until one takes it.
          if (editorRef.current?.setLocalPreview(file.name, url)) return;
          if (++frames < PREVIEW_MAX_FRAMES) requestAnimationFrame(apply);
        };
        apply();
      }
    });
  }, [open, resumeDraftId, hydrated, dispatch, editorRef, revokeAll]);

  useEffect(() => revokeAll, [revokeAll]);

  // Existence lookups: null = unknown (never clears), false = gone.
  const exists = (key: string | null | undefined) =>
    async function lookup(): Promise<boolean | null> {
      try {
        const token = await readSecret('jira-pat').catch(() => null);
        if (!token || !jiraBaseUrl || !key) return null;
        return (await fetchIssueDescription(jiraBaseUrl, token, key)) !== null;
      } catch {
        return null;
      }
    };
  const epicKey = snapshot?.epicLinkKey ?? null;
  const parentKey = snapshot?.parentKey ?? null;
  const epicQuery = useQuery({
    queryKey: ['issue-exists', epicKey, jiraBaseUrl],
    queryFn: exists(epicKey),
    enabled: open && !!epicKey && !!jiraBaseUrl,
    retry: false,
  });
  const parentQuery = useQuery({
    queryKey: ['issue-exists', parentKey, jiraBaseUrl],
    queryFn: exists(parentKey),
    enabled: open && !!parentKey && !!jiraBaseUrl,
    retry: false,
  });
  const hasFixVersions = (snapshot?.fixVersions.length ?? 0) > 0;
  // Validate against the draft's own project, the one the issue is created in (D-14).
  const fixVersionsQuery = useProjectFixVersions(
    open && hasFixVersions && !!resumedProjectKey,
    resumedProjectKey,
  );

  // Validate once, after the hydrated type's createmeta and the lookups settled (Pitfall 10).
  useEffect(() => {
    if (!open || !snapshot || validatedRef.current) return;
    if (selectedIssueType !== snapshot.selectedIssueType) return;
    if (creatmetaLoading) return;
    if (!settled(epicQuery) || !settled(parentQuery)) return;
    if (hasFixVersions && !settled(fixVersionsQuery)) return;
    validatedRef.current = true;

    const fixVersionIds = fixVersionsQuery.data
      ? new Set(fixVersionsQuery.data.map((v) => v.id))
      : null;
    const result = validateSnapshot(snapshot, {
      // Empty means the fetch failed or returned nothing: unknown, never "field removed".
      createmetaFields: creatmetaFields && creatmetaFields.length > 0 ? creatmetaFields : undefined,
      epicExists: epicKey ? (epicQuery.data ?? null) : null,
      parentExists: parentKey ? (parentQuery.data ?? null) : null,
      fixVersionIds,
    });

    // Dispatch only what changed so typing done in the meantime is not overwritten.
    const patch: Partial<FormState> = {};
    const out = result.snapshot;
    if (out.epicLinkKey !== snapshot.epicLinkKey) patch.epicLinkKey = out.epicLinkKey;
    if (out.parentKey !== snapshot.parentKey) patch.parentKey = out.parentKey;
    if (JSON.stringify(out.fixVersions) !== JSON.stringify(snapshot.fixVersions))
      patch.fixVersions = out.fixVersions;
    if (JSON.stringify(out.customFieldValues) !== JSON.stringify(snapshot.customFieldValues))
      patch.customFieldValues = out.customFieldValues;
    if (
      JSON.stringify(out.customFieldInputValues) !== JSON.stringify(snapshot.customFieldInputValues)
    )
      patch.customFieldInputValues = out.customFieldInputValues;
    if (Object.keys(patch).length > 0) dispatch({ type: 'HYDRATE', state: patch });

    const n = result.notes;
    if (n.epic || n.parent || n.fixVersions || Object.keys(n.customFields).length > 0)
      setStaleNotes(n);
  }, [
    open,
    snapshot,
    selectedIssueType,
    creatmetaLoading,
    creatmetaFields,
    epicQuery,
    parentQuery,
    fixVersionsQuery,
    hasFixVersions,
    epicKey,
    parentKey,
    dispatch,
  ]);

  /** Drop one note once its field is edited: 'epic' | 'parent' | 'fixVersions' | custom field id. */
  const clearNote = useCallback((key: string) => {
    setStaleNotes((prev) => {
      if (!prev) return prev;
      if (key === 'epic' || key === 'parent' || key === 'fixVersions') {
        if (!prev[key]) return prev;
        return { ...prev, [key]: undefined };
      }
      if (!(key in prev.customFields)) return prev;
      const { [key]: _gone, ...rest } = prev.customFields;
      return { ...prev, customFields: rest };
    });
  }, []);

  return { resumedProjectKey, staleNotes, clearNote };
}
