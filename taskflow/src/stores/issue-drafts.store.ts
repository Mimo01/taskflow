import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { type PersistStorage, persist } from 'zustand/middleware';
import type { PersonValue } from '@/components/ui/person-picker';
import type { IssueType } from '@/routes/dashboard/create-edit-issue/useCreateEditForm';
import type { IssueLinkRowValue } from '@/routes/dashboard/IssueLinkRow';
import { isDraftFilePath } from '../lib/draft-file-path';
import { createTauriStorage } from '../lib/tauri-storage';

/** Structurally identical to StagedFileRef in lib/issue-draft-files.ts. */
export interface DraftFileRef {
  name: string;
  size: number;
  type: string;
  path: string;
}

/** Serialisable subset of the create form state (no transient/UI-only fields). */
export interface IssueDraftSnapshot {
  selectedIssueType: IssueType;
  summary: string;
  description: string;
  selectedAssignee: PersonValue | null;
  selectedAssigneeName: string | null;
  timeEstimate: string;
  priority: string | null;
  storyPoints: string;
  epicLinkKey: string | null;
  parentKey: string | null;
  labels: string[];
  fixVersions: { id: string; name: string }[];
  customFieldValues: Record<string, string>;
  customFieldInputValues: Record<string, string>;
  /** Field display names captured at save time, so a stale note can name a gone field. */
  customFieldNames: Record<string, string>;
  linkRows: IssueLinkRowValue[];
}

export interface EpicDraftSnapshot {
  epicName: string;
  description: string;
}

export type IssueDraft = {
  id: string;
  updatedAt: number;
  projectKey: string;
  files: DraftFileRef[];
} & (
  | { kind: 'issue'; snapshot: IssueDraftSnapshot }
  | { kind: 'epic'; snapshot: EpicDraftSnapshot }
);

interface IssueDraftsState {
  drafts: Record<string, IssueDraft>;
  /** `${jiraBaseUrl}|${jiraUsername}` the drafts belong to. */
  owner: string | null;
  /** True when the last persisted write was rejected. Not persisted. */
  saveFailed: boolean;
  upsertDraft: (draft: IssueDraft) => void;
  removeDraft: (id: string) => IssueDraft | undefined;
  restoreDraft: (draft: IssueDraft) => void;
  /** Returns true when drafts were cleared because the owner changed (caller purges files). */
  reconcileOwner: (owner: string) => boolean;
  clearAll: () => void;
}

type Persisted = Pick<IssueDraftsState, 'drafts' | 'owner'>;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrOrNull = (v: unknown) => v === null || isStr(v);
const isStrRecord = (v: unknown) => isObj(v) && Object.values(v).every(isStr);

function isFileRef(v: unknown): v is DraftFileRef {
  return (
    isObj(v) &&
    isStr(v.name) &&
    typeof v.size === 'number' &&
    isStr(v.type) &&
    isDraftFilePath(v.path)
  );
}

function isIssueSnapshot(s: Record<string, unknown>): boolean {
  return (
    isStr(s.selectedIssueType) &&
    isStr(s.summary) &&
    isStr(s.description) &&
    isStr(s.timeEstimate) &&
    isStr(s.storyPoints) &&
    isStrOrNull(s.selectedAssigneeName) &&
    isStrOrNull(s.priority) &&
    isStrOrNull(s.epicLinkKey) &&
    isStrOrNull(s.parentKey) &&
    (s.selectedAssignee === null ||
      (isObj(s.selectedAssignee) && isStr(s.selectedAssignee.name))) &&
    Array.isArray(s.labels) &&
    s.labels.every(isStr) &&
    Array.isArray(s.fixVersions) &&
    s.fixVersions.every((v) => isObj(v) && isStr(v.id) && isStr(v.name)) &&
    isStrRecord(s.customFieldValues) &&
    isStrRecord(s.customFieldInputValues) &&
    isStrRecord(s.customFieldNames) &&
    Array.isArray(s.linkRows) &&
    s.linkRows.every((r) => isObj(r) && isStr(r.id) && isStr(r.linkTypeId) && isStr(r.issueKey))
  );
}

/** Persisted drafts are untrusted JSON: keep only well-formed drafts and safe file refs. */
export function sanitizePersistedDrafts(raw: unknown): Record<string, IssueDraft> {
  const out: Record<string, IssueDraft> = {};
  if (!isObj(raw)) return out;
  for (const [key, d] of Object.entries(raw)) {
    if (!isObj(d) || d.id !== key || !isStr(d.projectKey) || typeof d.updatedAt !== 'number')
      continue;
    if (!Array.isArray(d.files) || !isObj(d.snapshot)) continue;
    const s = d.snapshot;
    const ok =
      d.kind === 'issue'
        ? isIssueSnapshot(s)
        : d.kind === 'epic' && isStr(s.epicName) && isStr(s.description);
    if (!ok) continue;
    out[key] = { ...d, files: d.files.filter(isFileRef) } as IssueDraft;
  }
  return out;
}

function createDraftStorage(): PersistStorage<Persisted> | undefined {
  const base = createTauriStorage('issue-drafts.json');
  if (!base) return undefined;
  return {
    getItem: base.getItem,
    removeItem: base.removeItem,
    setItem: async (name, value) => {
      try {
        await base.setItem(name, value);
        if (useIssueDraftsStore.getState().saveFailed) {
          useIssueDraftsStore.setState({ saveFailed: false });
        }
      } catch {
        // Guard: setState re-enters persist, so only flip on a change to avoid a retry loop.
        if (!useIssueDraftsStore.getState().saveFailed) {
          useIssueDraftsStore.setState({ saveFailed: true });
        }
      }
    },
  } as PersistStorage<Persisted>;
}

// Never log draft text: it may contain customer data.
export const useIssueDraftsStore = create<IssueDraftsState>()(
  persist(
    (set, get) => ({
      drafts: {},
      owner: null,
      saveFailed: false,
      upsertDraft: (draft) => set((s) => ({ drafts: { ...s.drafts, [draft.id]: draft } })),
      removeDraft: (id) => {
        const existing = get().drafts[id];
        if (!existing) return undefined;
        set((s) => {
          const next = { ...s.drafts };
          delete next[id];
          return { drafts: next };
        });
        return existing;
      },
      restoreDraft: (draft) => set((s) => ({ drafts: { ...s.drafts, [draft.id]: draft } })),
      reconcileOwner: (owner) => {
        const s = get();
        if (s.owner === owner) return false;
        if (s.owner === null) {
          set({ owner });
          return false;
        }
        set({ drafts: {}, owner });
        return true;
      },
      clearAll: () => set({ drafts: {} }),
    }),
    {
      name: 'issue-drafts-store',
      storage: createDraftStorage(),
      version: 1,
      partialize: (s) => ({ drafts: s.drafts, owner: s.owner }),
      merge: (persisted, current) => {
        const p = isObj(persisted) ? persisted : {};
        return {
          ...current,
          drafts: sanitizePersistedDrafts(p.drafts),
          owner: isStr(p.owner) ? p.owner : current.owner,
        };
      },
    },
  ),
);

export function useIssueDraftsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useIssueDraftsStore.persist.hasHydrated());
  useEffect(() => {
    if (useIssueDraftsStore.persist.hasHydrated()) setHydrated(true);
    return useIssueDraftsStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

/** Drafts newest first. Selects the record and sorts in useMemo (a fresh array selector loops). */
export function useSortedIssueDrafts(): IssueDraft[] {
  const drafts = useIssueDraftsStore((s) => s.drafts);
  return useMemo(() => Object.values(drafts).sort((a, b) => b.updatedAt - a.updatedAt), [drafts]);
}
