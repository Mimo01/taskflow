import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { type PersistStorage, persist } from 'zustand/middleware';
import type { PersonValue } from '@/components/ui/person-picker';
import type { IssueType } from '@/routes/dashboard/create-edit-issue/useCreateEditForm';
import type { IssueLinkRowValue } from '@/routes/dashboard/IssueLinkRow';
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
