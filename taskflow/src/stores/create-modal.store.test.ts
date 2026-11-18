import { beforeEach, describe, expect, it } from 'vitest';
import type { EditInitialValues } from '@/routes/dashboard/create-edit-issue/useCreateEditForm';
import { useCreateModalStore } from './create-modal.store';
import { type IssueDraft, useIssueDraftsStore } from './issue-drafts.store';

const get = () => useCreateModalStore.getState();

const vals: EditInitialValues = {
  issueKey: 'PROJ-1',
  summary: 's',
  description: '',
  assigneeName: null,
  priority: null,
  storyPoints: null,
  epicLinkKey: null,
};

const epicDraft: IssueDraft = {
  id: 'e1',
  kind: 'epic',
  updatedAt: 1,
  projectKey: 'PROJ',
  files: [],
  snapshot: { epicName: 'x', description: '' },
};
const issueDraft: IssueDraft = {
  id: 'i1',
  kind: 'issue',
  updatedAt: 1,
  projectKey: 'PROJ',
  files: [],
  snapshot: {
    selectedIssueType: 'Story',
    summary: 'x',
    description: '',
    selectedAssignee: null,
    selectedAssigneeName: null,
    timeEstimate: '',
    priority: null,
    storyPoints: '',
    epicLinkKey: null,
    parentKey: null,
    labels: [],
    fixVersions: [],
    customFieldValues: {},
    customFieldInputValues: {},
    customFieldNames: {},
    linkRows: [],
  },
};

beforeEach(() => {
  useCreateModalStore.setState({
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
  });
  useIssueDraftsStore.setState({
    drafts: { e1: epicDraft, i1: issueDraft },
    owner: null,
    saveFailed: false,
  });
});

describe('create-modal store', () => {
  it('openCreate resets everything', () => {
    get().openEdit(vals);
    get().openCreate();
    expect(get()).toMatchObject({
      open: true,
      mode: 'create',
      initialValues: undefined,
      defaultIssueType: undefined,
      defaultEpicLinkKey: undefined,
      resumeDraftId: null,
      refreshBacklogOnClose: false,
    });
  });

  it('openCreate stores defaults', () => {
    get().openCreate({
      defaultIssueType: 'Story',
      defaultEpicLinkKey: 'EP-1',
      refreshBacklogOnClose: true,
    });
    expect(get()).toMatchObject({
      defaultIssueType: 'Story',
      defaultEpicLinkKey: 'EP-1',
      refreshBacklogOnClose: true,
    });
  });

  it('openEdit sets edit mode and initial values', () => {
    get().openCreate({ defaultIssueType: 'Bug' });
    get().openEdit(vals);
    expect(get()).toMatchObject({
      open: true,
      mode: 'edit',
      initialValues: vals,
      defaultIssueType: undefined,
    });
  });

  it('resumeDraft routes by draft kind and ignores unknown ids', () => {
    get().resumeDraft('i1');
    expect(get()).toMatchObject({ open: true, mode: 'create', resumeDraftId: 'i1' });
    expect(get().defaultIssueType).toBeUndefined();
    get().resumeDraft('e1');
    expect(get()).toMatchObject({ epicOpen: true, epicResumeDraftId: 'e1' });
    get().close();
    get().closeEpic();
    get().resumeDraft('nope');
    expect(get().open).toBe(false);
    expect(get().epicOpen).toBe(false);
  });

  it('close, openEpic and closeEpic reset resume ids', () => {
    get().resumeDraft('i1');
    get().close();
    expect(get()).toMatchObject({ open: false, resumeDraftId: null });
    get().openEpic();
    expect(get()).toMatchObject({ epicOpen: true, epicResumeDraftId: null });
    get().resumeDraft('e1');
    get().closeEpic();
    expect(get()).toMatchObject({ epicOpen: false, epicResumeDraftId: null });
  });
});
