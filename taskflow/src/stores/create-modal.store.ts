import { create } from 'zustand';
import type { EditInitialValues } from '@/routes/dashboard/create-edit-issue/useCreateEditForm';
import { useIssueDraftsStore } from './issue-drafts.store';

type DefaultIssueType = 'Story' | 'Subtask' | 'Bug';

interface OpenCreateOptions {
  initialValues?: EditInitialValues;
  defaultIssueType?: DefaultIssueType;
  defaultParentKey?: string;
  defaultEpicLinkKey?: string;
  refreshBacklogOnClose?: boolean;
}

interface CreateModalState {
  open: boolean;
  mode: 'create' | 'edit';
  initialValues?: EditInitialValues;
  defaultIssueType?: DefaultIssueType;
  defaultParentKey?: string;
  defaultEpicLinkKey?: string;
  resumeDraftId: string | null;
  refreshBacklogOnClose: boolean;
  epicOpen: boolean;
  epicResumeDraftId: string | null;
  openCreate: (opts?: OpenCreateOptions) => void;
  openEdit: (vals: EditInitialValues) => void;
  resumeDraft: (id: string) => void;
  close: () => void;
  openEpic: () => void;
  closeEpic: () => void;
}

/** Global entry for the Create/Edit/Epic dialogs. Every open action sets all fields (no carry-over). */
export const useCreateModalStore = create<CreateModalState>()((set) => ({
  open: false,
  mode: 'create',
  initialValues: undefined,
  defaultIssueType: undefined,
  defaultParentKey: undefined,
  defaultEpicLinkKey: undefined,
  resumeDraftId: null,
  refreshBacklogOnClose: false,
  epicOpen: false,
  epicResumeDraftId: null,
  openCreate: (opts) =>
    set({
      open: true,
      mode: 'create',
      initialValues: opts?.initialValues,
      defaultIssueType: opts?.defaultIssueType,
      defaultParentKey: opts?.defaultParentKey,
      defaultEpicLinkKey: opts?.defaultEpicLinkKey,
      resumeDraftId: null,
      refreshBacklogOnClose: opts?.refreshBacklogOnClose ?? false,
    }),
  openEdit: (vals) =>
    set({
      open: true,
      mode: 'edit',
      initialValues: vals,
      defaultIssueType: undefined,
      defaultParentKey: undefined,
      defaultEpicLinkKey: undefined,
      resumeDraftId: null,
      refreshBacklogOnClose: false,
    }),
  resumeDraft: (id) => {
    const draft = useIssueDraftsStore.getState().drafts[id];
    if (!draft) return;
    if (draft.kind === 'epic') {
      set({ epicOpen: true, epicResumeDraftId: id });
      return;
    }
    set({
      open: true,
      mode: 'create',
      initialValues: undefined,
      defaultIssueType: undefined,
      defaultParentKey: undefined,
      defaultEpicLinkKey: undefined,
      resumeDraftId: id,
      refreshBacklogOnClose: false,
    });
  },
  close: () => set({ open: false, resumeDraftId: null }),
  openEpic: () => set({ epicOpen: true, epicResumeDraftId: null }),
  closeEpic: () => set({ epicOpen: false, epicResumeDraftId: null }),
}));
