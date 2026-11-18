import { describe, expect, it } from 'vitest';
import { buildInitialState } from '@/routes/dashboard/create-edit-issue/useCreateEditForm';
import type { CreatemetaField } from '@/services/jira';
import {
  hasEpicContent,
  hasUserContent,
  keptFieldsAfterCreate,
  snapshotToFormPatch,
  toIssueSnapshot,
  validateSnapshot,
} from './issue-draft-snapshot';

const base = () => buildInitialState();
const meta = (
  fieldId: string,
  allowed?: Array<{ id: string; value: string }>,
): CreatemetaField => ({
  fieldId,
  name: fieldId,
  required: false,
  schema: { type: 'option', allowedValues: allowed },
});
const snap = (over = {}) => ({ ...toIssueSnapshot(base(), {}), ...over });
const ctx = { epicExists: true, parentExists: true, fixVersionIds: null };

describe('hasUserContent', () => {
  it('ignores type/assignee/priority/epic defaults', () => {
    const s = {
      ...base(),
      selectedIssueType: 'Bug' as never,
      priority: 'High',
      epicLinkKey: 'EP-1',
      selectedAssignee: { accountId: 'u', displayName: 'U' } as never,
    };
    expect(hasUserContent(s, 0)).toBe(false);
  });
  it('detects summary, description, staged file', () => {
    expect(hasUserContent({ ...base(), summary: '  x ' }, 0)).toBe(true);
    expect(hasUserContent({ ...base(), description: 'a' }, 0)).toBe(true);
    expect(hasUserContent(base(), 1)).toBe(true);
  });
  it('counts only filled link rows', () => {
    expect(
      hasUserContent({ ...base(), linkRows: [{ id: 'a', linkTypeId: '1', issueKey: '' }] }, 0),
    ).toBe(false);
    expect(
      hasUserContent({ ...base(), linkRows: [{ id: 'a', linkTypeId: '1', issueKey: 'ABC-1' }] }, 0),
    ).toBe(true);
  });
});

describe('hasEpicContent', () => {
  it('gates on name, description or files', () => {
    expect(hasEpicContent('', '', 0)).toBe(false);
    expect(hasEpicContent(' n', '', 0)).toBe(true);
    expect(hasEpicContent('', '', 1)).toBe(true);
  });
});

describe('snapshot round trip', () => {
  const state = {
    ...base(),
    summary: 'S',
    description: 'D',
    priority: 'High',
    storyPoints: '3',
    timeEstimate: '2h',
    labels: ['a'],
    fixVersions: [{ id: '9', name: 'v9' }],
    epicLinkKey: 'EP-1',
    parentKey: 'P-2',
    customFieldValues: { customfield_1: '5' },
    customFieldInputValues: { customfield_1: 'Five' },
    customFieldAutoResults: { x: [] },
    customFieldShowResults: { x: true },
    apiError: 'boom',
    assigneeUnassignPicked: true,
    linkRows: [{ id: 'l', linkTypeId: '1', issueKey: 'ABC-1' }],
  };
  it('omits transient fields and maps names', () => {
    const s = toIssueSnapshot(state, { customfield_1: 'Team' });
    for (const k of [
      'apiError',
      'customFieldAutoResults',
      'customFieldShowResults',
      'assigneeUnassignPicked',
    ]) {
      expect(k in s).toBe(false);
    }
    expect(s.customFieldNames).toEqual({ customfield_1: 'Team' });
    expect(toIssueSnapshot(state, {}).customFieldNames).toEqual({
      customfield_1: 'customfield_1',
    });
  });
  it('restores every persisted key', () => {
    const patch = snapshotToFormPatch(toIssueSnapshot(state, {}));
    const restored = { ...base(), ...patch };
    for (const k of Object.keys(patch) as (keyof typeof state)[]) {
      expect(restored[k]).toEqual(state[k]);
    }
  });
});

describe('keptFieldsAfterCreate', () => {
  it('keeps sticky fields and drops content', () => {
    const kept = keptFieldsAfterCreate({
      ...base(),
      summary: 's',
      description: 'd',
      storyPoints: '1',
      timeEstimate: '1h',
      labels: ['x'],
    });
    expect(kept.labels).toEqual(['x']);
    for (const k of [
      'selectedIssueType',
      'epicLinkKey',
      'parentKey',
      'selectedAssignee',
      'selectedAssigneeName',
      'assigneeUnassignPicked',
      'priority',
      'fixVersions',
      'customFieldValues',
      'customFieldInputValues',
    ]) {
      expect(k in kept).toBe(true);
    }
    for (const k of ['summary', 'description', 'storyPoints', 'timeEstimate', 'linkRows']) {
      expect(k in kept).toBe(false);
    }
  });
});

describe('validateSnapshot', () => {
  it('clears a missing epic with a note, keeps on unknown', () => {
    const r = validateSnapshot(snap({ epicLinkKey: 'EP-1' }), { ...ctx, epicExists: false });
    expect(r.snapshot.epicLinkKey).toBeNull();
    expect(r.notes.epic).toBe('Epic EP-1 no longer exists');
    const u = validateSnapshot(snap({ epicLinkKey: 'EP-1' }), { ...ctx, epicExists: null });
    expect(u.snapshot.epicLinkKey).toBe('EP-1');
    expect(u.notes.epic).toBeUndefined();
  });
  it('clears a missing parent but keeps the type', () => {
    const r = validateSnapshot(snap({ parentKey: 'P-2', selectedIssueType: 'Subtask' }), {
      ...ctx,
      parentExists: false,
    });
    expect(r.snapshot.parentKey).toBeNull();
    expect(r.snapshot.selectedIssueType).toBe('Subtask');
    expect(r.notes.parent).toBe('Parent P-2 no longer exists');
  });
  const custom = () =>
    snap({
      customFieldValues: { customfield_1: '5' },
      customFieldInputValues: { customfield_1: 'Five' },
      customFieldNames: { customfield_1: 'Team' },
    });
  it('removes unavailable custom fields', () => {
    const r = validateSnapshot(custom(), { ...ctx, createmetaFields: [] });
    expect(r.snapshot.customFieldValues).toEqual({});
    expect(r.snapshot.customFieldInputValues).toEqual({});
    expect(r.notes.customFields.customfield_1).toBe('Team is no longer available on this screen');
  });
  it('clears values no longer in allowedValues', () => {
    const r = validateSnapshot(custom(), {
      ...ctx,
      createmetaFields: [meta('customfield_1', [{ id: '6', value: 'Six' }])],
    });
    expect(r.snapshot.customFieldValues).toEqual({});
    expect(r.notes.customFields.customfield_1).toBe('Five is no longer an option, choose another');
  });
  it('leaves custom fields alone when createmeta is not loaded', () => {
    const r = validateSnapshot(custom(), ctx);
    expect(r.snapshot.customFieldValues).toEqual({ customfield_1: '5' });
    expect(r.notes.customFields).toEqual({});
  });
  it('drops stale fix versions, ignores unknown set', () => {
    const s = snap({
      fixVersions: [
        { id: '9', name: 'v9' },
        { id: '1', name: 'v1' },
      ],
    });
    const r = validateSnapshot(s, { ...ctx, fixVersionIds: new Set(['1']) });
    expect(r.snapshot.fixVersions).toEqual([{ id: '1', name: 'v1' }]);
    expect(r.notes.fixVersions).toBe('v9 is no longer an option, choose another');
    expect(validateSnapshot(s, ctx).snapshot.fixVersions).toHaveLength(2);
  });
  it('valid snapshot yields no changes or notes and does not mutate input', () => {
    const s = snap({
      epicLinkKey: 'EP-1',
      customFieldValues: { customfield_1: '5' },
      customFieldInputValues: { customfield_1: 'Five' },
    });
    const copy = JSON.parse(JSON.stringify(s));
    const r = validateSnapshot(s, {
      ...ctx,
      createmetaFields: [meta('customfield_1', [{ id: '5', value: 'Five' }])],
      fixVersionIds: new Set(),
    });
    expect(r.snapshot).toEqual(s);
    expect(r.notes).toEqual({ customFields: {} });
    expect(s).toEqual(copy);
  });
});
