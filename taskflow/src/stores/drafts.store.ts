import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

export type DraftKind = 'comment-new' | 'comment-edit' | 'description';

export interface Draft {
  kind: DraftKind;
  issueKey: string;
  text: string;
  /** Jira text the edit started from (edit drafts only). */
  base?: string;
  updatedAt: number;
}

interface DraftsState {
  drafts: Record<string, Draft>;
  /** `${jiraBaseUrl}|${jiraUsername}` the drafts belong to (D-21). */
  owner: string | null;
  setDraft: (key: string, d: Omit<Draft, 'updatedAt'>) => void;
  clearDraft: (key: string) => void;
  clearIssue: (issueKey: string) => void;
  pruneCommentEdits: (issueKey: string, liveIds: readonly string[]) => void;
  clearAll: () => void;
  reconcileOwner: (owner: string) => void;
}

const COMMENT_EDIT_PREFIX = 'comment:edit:';

// Never log draft text: it may contain customer data.
export const useDraftsStore = create<DraftsState>()(
  persist(
    (set) => ({
      drafts: {},
      owner: null,
      setDraft: (key, d) =>
        set((s) => {
          const next = { ...s.drafts };
          if (
            typeof d.text !== 'string' ||
            d.text.trim() === '' ||
            (d.base !== undefined && d.text === d.base)
          ) {
            delete next[key];
          } else {
            next[key] = { ...d, updatedAt: Date.now() };
          }
          return { drafts: next };
        }),
      clearDraft: (key) =>
        set((s) => {
          if (!(key in s.drafts)) return s;
          const next = { ...s.drafts };
          delete next[key];
          return { drafts: next };
        }),
      clearIssue: (issueKey) =>
        set((s) => ({
          drafts: Object.fromEntries(
            Object.entries(s.drafts).filter(([, d]) => d.issueKey !== issueKey),
          ),
        })),
      pruneCommentEdits: (issueKey, liveIds) =>
        set((s) => ({
          drafts: Object.fromEntries(
            Object.entries(s.drafts).filter(([key, d]) => {
              if (d.kind !== 'comment-edit' || d.issueKey !== issueKey) return true;
              return liveIds.includes(key.slice(COMMENT_EDIT_PREFIX.length));
            }),
          ),
        })),
      clearAll: () => set({ drafts: {} }),
      reconcileOwner: (owner) =>
        set((s) => {
          if (s.owner === owner) return s;
          if (s.owner === null) return { owner };
          return { drafts: {}, owner };
        }),
    }),
    {
      name: 'drafts-store',
      storage: createTauriStorage('drafts.json'),
      version: 1,
      partialize: (s) => ({ drafts: s.drafts, owner: s.owner }),
    },
  ),
);

/** Pure helper: comment-edit drafts for one issue as [commentId, Draft][]. */
export function commentEditDraftsFor(
  drafts: Record<string, Draft>,
  issueKey: string,
): [string, Draft][] {
  return Object.entries(drafts)
    .filter(([, d]) => d.kind === 'comment-edit' && d.issueKey === issueKey)
    .map(([key, d]): [string, Draft] => [key.slice(COMMENT_EDIT_PREFIX.length), d]);
}

export function useDraftsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useDraftsStore.persist.hasHydrated());
  useEffect(() => {
    if (useDraftsStore.persist.hasHydrated()) setHydrated(true);
    return useDraftsStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}
