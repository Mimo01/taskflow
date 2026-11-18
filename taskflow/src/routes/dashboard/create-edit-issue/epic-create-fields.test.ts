import { describe, expect, it } from 'vitest';
import type { CreatemetaField } from '@/services/jira';
import { buildEpicCreateFields } from './epic-create-fields';
import { buildInitialState } from './useCreateEditForm';

const NAME_KEY = 'customfield_10011';
const SP_KEY = 'customfield_10016';
const field = (
  fieldId: string,
  schema: CreatemetaField['schema'] = { type: 'string' },
): CreatemetaField => ({ fieldId, name: fieldId, required: false, schema });
const meta: CreatemetaField[] = [
  field(NAME_KEY),
  field('labels', { type: 'array', items: 'string' }),
  field('fixVersions', { type: 'array', items: 'version' }),
  field('customfield_20000', {
    type: 'option',
    allowedValues: [{ id: '1', value: 'One' }],
  }),
  field(SP_KEY, { type: 'number' }),
];
const state = (over = {}) => ({ ...buildInitialState(), summary: '  My epic ', ...over });
const build = (
  s = state(),
  creatmetaFields: CreatemetaField[] | undefined = meta,
  storyPointsFieldKey: string | null = SP_KEY,
) =>
  buildEpicCreateFields({
    state: s,
    epicNameFieldKey: NAME_KEY,
    storyPointsFieldKey,
    creatmetaFields,
  });

describe('buildEpicCreateFields', () => {
  it('sends issuetype and the trimmed epic name; description only when non-blank', () => {
    expect(build()).toEqual({ issuetype: 'Epic', [NAME_KEY]: 'My epic' });
    expect(build(state({ description: 'D' })).description).toBe('D');
    expect('description' in build(state({ description: '   ' }))).toBe(false);
  });

  it('sends assignee and priority as { name }, never assignee null', () => {
    const f = build(state({ selectedAssigneeName: 'bob', priority: 'High' }));
    expect(f.assignee).toEqual({ name: 'bob' });
    expect(f.priority).toEqual({ name: 'High' });
    expect('assignee' in build()).toBe(false);
    expect('priority' in build()).toBe(false);
  });

  it('sends labels and fixVersions when offered, skips when createmeta lacks them', () => {
    const s = state({ labels: ['a'], fixVersions: [{ id: '9', name: 'v9' }] });
    const f = build(s);
    expect(f.labels).toEqual(['a']);
    expect(f.fixVersions).toEqual([{ id: '9' }]);
    const g = build(s, [field(NAME_KEY)]);
    expect('labels' in g).toBe(false);
    expect('fixVersions' in g).toBe(false);
    expect(build(s, []).labels).toEqual(['a']);
    expect(build(s, []).fixVersions).toEqual([{ id: '9' }]);
  });

  it('sends story points as a Number only when key set, value non-empty and offered', () => {
    expect(build(state({ storyPoints: '5' }))[SP_KEY]).toBe(5);
    expect(SP_KEY in build(state({ storyPoints: '' }))).toBe(false);
    expect(SP_KEY in build(state({ storyPoints: '5' }), meta, null)).toBe(false);
    expect(SP_KEY in build(state({ storyPoints: '5' }), [field(NAME_KEY)])).toBe(false);
    expect(build(state({ storyPoints: '5' }), [])[SP_KEY]).toBe(5);
  });

  it('skips blank and unoffered custom fields, wraps offered ones', () => {
    const f = build(
      state({
        customFieldValues: {
          customfield_20000: '1',
          customfield_30000: 'x',
          customfield_40000: '  ',
        },
      }),
    );
    expect(f.customfield_20000).toBe('1');
    expect('customfield_30000' in f).toBe(false);
    expect('customfield_40000' in f).toBe(false);
    const u = build(state({ customFieldValues: { customfield_30000: 'x' } }), []);
    expect(u.customfield_30000).toBe('x');
  });

  it('wraps user custom fields with wrapCustomFieldValue', () => {
    const userMeta = [field('customfield_50000', { type: 'user' })];
    const f = build(state({ customFieldValues: { customfield_50000: 'bob' } }), userMeta);
    expect(f.customfield_50000).toEqual({ name: 'bob' });
  });

  it('ignores a custom field value under the epic name key', () => {
    const f = build(state({ customFieldValues: { [NAME_KEY]: 'other' } }));
    expect(f[NAME_KEY]).toBe('My epic');
  });

  it('never includes epic link, parent, timetracking or links', () => {
    const f = build(
      state({
        epicLinkKey: 'EP-1',
        parentKey: 'P-1',
        timeEstimate: '2h',
        linkRows: [{ id: 'a', linkTypeId: '1', issueKey: 'A-1' }],
      }),
    );
    expect(Object.keys(f).sort()).toEqual(['issuetype', NAME_KEY].sort());
  });
});
