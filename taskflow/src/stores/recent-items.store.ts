import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

export interface RecentItem {
  type: 'jira' | 'gitlab';
  id: string; // Issue key (PROJ-123) or MR "project_id/iid"
  url?: string; // For GitLab MRs -- browser open URL
  title?: string; // Cached display title so it survives across sessions
  issueType?: string; // Jira issue type name (Story/Bug/...) cached so the popover icon survives a cold react-query cache
  parentKey?: string; // Subtask parent story key, so recents can show the subtask under its story with a cold cache
  parentTitle?: string;
  parentIssueType?: string;
  timestamp: number; // Date.now() when opened
}

interface RecentItemsState {
  items: RecentItem[];
  pushItem: (item: Omit<RecentItem, 'timestamp'>) => void;
}

export const useRecentItemsStore = create<RecentItemsState>()(
  persist(
    (set) => ({
      items: [],
      pushItem: (item) =>
        set((s) => {
          const existing = s.items.find((i) => i.type === item.type && i.id === item.id);
          const filtered = s.items.filter((i) => !(i.type === item.type && i.id === item.id));
          // Preserve existing title if caller didn't provide one
          const title = item.title ?? existing?.title;
          // Preserve existing issueType if caller didn't provide one
          const issueType = item.issueType ?? existing?.issueType;
          // Preserve existing parent info if caller didn't provide it. A push that carries the
          // parentKey property (even undefined) is authoritative: it replaces or clears the
          // stored parent, and the old parent's title/type only survive for the same parent.
          const parentAuthoritative = 'parentKey' in item;
          const parentKey = parentAuthoritative ? item.parentKey : existing?.parentKey;
          const keepOldParent = !!parentKey && parentKey === existing?.parentKey;
          const parentTitle =
            item.parentTitle ?? (keepOldParent ? existing?.parentTitle : undefined);
          const parentIssueType =
            item.parentIssueType ?? (keepOldParent ? existing?.parentIssueType : undefined);
          return {
            items: [
              {
                ...item,
                ...(title ? { title } : {}),
                ...(issueType ? { issueType } : {}),
                ...(parentKey ? { parentKey } : {}),
                ...(parentTitle ? { parentTitle } : {}),
                ...(parentIssueType ? { parentIssueType } : {}),
                timestamp: Date.now(),
              },
              ...filtered,
            ].slice(0, 10),
          };
        }),
    }),
    {
      name: 'recent-items-store',
      storage: createTauriStorage('recent-items.json'),
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as RecentItemsState;
        if (version >= 1) return state;
        // v1: MR ids are "project_id/iid". Legacy bare-iid ids cannot be routed
        // (/mr/:projectId/:iid) and never de-duplicate against composite pushes.
        return {
          ...state,
          items: (state.items ?? []).filter((i) => i.type !== 'gitlab' || i.id.includes('/')),
        };
      },
    },
  ),
);
