// SUBTPL-03 / SUBTPL-05: resolveTemplateFields — field-drop computation tests

import { describe, expect, it } from 'vitest';
import type { CreatemetaField } from '@/services/jira';
import type { SubtaskTemplateRow } from '@/stores/subtask-templates.store';
import { resolveTemplateFields } from './resolveTemplateFields';

function makeRow(overrides: Partial<SubtaskTemplateRow> = {}): SubtaskTemplateRow {
  return {
    id: 'row-1',
    title: 'Test subtask',
    assignee: '@inherit',
    priority: null,
    labels: [],
    duedate: null,
    timeEstimate: '',
    storyPoints: null,
    components: [],
    customFieldValues: {},
    ...overrides,
  };
}

function makeField(fieldId: string): CreatemetaField {
  return {
    fieldId,
    name: fieldId,
    required: false,
    schema: { type: 'string' },
  } as CreatemetaField;
}

describe('resolveTemplateFields (SUBTPL-03/05)', () => {
  it('returns empty resolvedRows and totalSkipped=0 for empty rows array', () => {
    const { resolvedRows, totalSkipped } = resolveTemplateFields([], [], null);
    expect(resolvedRows).toEqual([]);
    expect(totalSkipped).toBe(0);
  });

  it('keeps a custom fieldId present in createmeta', () => {
    const row = makeRow({ customFieldValues: { customfield_10100: 'value' } });
    const creatmetaFields = [makeField('customfield_10100')];
    const { resolvedRows, totalSkipped } = resolveTemplateFields([row], creatmetaFields, null);
    expect(resolvedRows[0].row.customFieldValues.customfield_10100).toBe('value');
    expect(resolvedRows[0].skippedFieldIds).toEqual([]);
    expect(totalSkipped).toBe(0);
  });

  it('drops a custom fieldId absent from createmeta and counts it as skipped', () => {
    const row = makeRow({ customFieldValues: { customfield_99999: 'orphan' } });
    const creatmetaFields: CreatemetaField[] = []; // empty — field not supported
    const { resolvedRows, totalSkipped } = resolveTemplateFields([row], creatmetaFields, null);
    expect(resolvedRows[0].row.customFieldValues).not.toHaveProperty('customfield_99999');
    expect(resolvedRows[0].skippedFieldIds).toContain('customfield_99999');
    expect(totalSkipped).toBe(1);
  });

  it('NEVER counts core fields (summary/assignee/priority/labels/duedate/timetracking/parent) as skipped', () => {
    const coreFields = [
      'summary',
      'assignee',
      'priority',
      'labels',
      'duedate',
      'timetracking',
      'parent',
    ];
    // Even if createmeta is empty, these should never appear in skippedFieldIds
    // They are tracked in the row directly, not in customFieldValues, but test the guard explicitly
    const row = makeRow({
      customFieldValues: {
        // Add them to customFieldValues to test the ALWAYS_ALLOWED guard
        summary: 'x',
        assignee: 'y',
        priority: 'z',
      },
    });
    const creatmetaFields: CreatemetaField[] = []; // empty
    const { resolvedRows, totalSkipped } = resolveTemplateFields([row], creatmetaFields, null);
    for (const f of coreFields) {
      expect(resolvedRows[0].skippedFieldIds).not.toContain(f);
    }
    // summary/assignee/priority should be kept (ALWAYS_ALLOWED), not counted as skipped
    expect(totalSkipped).toBe(0);
  });

  it('storyPointsFieldKey is ALWAYS_ALLOWED when non-null', () => {
    const row = makeRow({ customFieldValues: { customfield_10016: '5' } });
    const creatmetaFields: CreatemetaField[] = []; // storyPoints not in createmeta
    const { resolvedRows, totalSkipped } = resolveTemplateFields(
      [row],
      creatmetaFields,
      'customfield_10016',
    );
    expect(resolvedRows[0].row.customFieldValues.customfield_10016).toBe('5');
    expect(resolvedRows[0].skippedFieldIds).not.toContain('customfield_10016');
    expect(totalSkipped).toBe(0);
  });

  it('components with value AND absent from createmeta: counted once and cleared', () => {
    const row = makeRow({ components: ['comp-1', 'comp-2'] });
    const creatmetaFields: CreatemetaField[] = []; // no components in createmeta
    const { resolvedRows, totalSkipped } = resolveTemplateFields([row], creatmetaFields, null);
    expect(resolvedRows[0].row.components).toEqual([]);
    expect(resolvedRows[0].skippedFieldIds).toContain('components');
    expect(totalSkipped).toBe(1);
  });

  it('components with value AND present in createmeta: kept, not counted as skipped', () => {
    const row = makeRow({ components: ['comp-1'] });
    const creatmetaFields = [makeField('components')];
    const { resolvedRows, totalSkipped } = resolveTemplateFields([row], creatmetaFields, null);
    expect(resolvedRows[0].row.components).toEqual(['comp-1']);
    expect(resolvedRows[0].skippedFieldIds).not.toContain('components');
    expect(totalSkipped).toBe(0);
  });

  it('totalSkipped equals sum of per-row skippedFieldIds lengths', () => {
    const row1 = makeRow({ id: 'r1', customFieldValues: { cf_a: 'v', cf_b: 'v' } });
    const row2 = makeRow({ id: 'r2', customFieldValues: { cf_c: 'v' } });
    const creatmetaFields: CreatemetaField[] = []; // all absent
    const { resolvedRows, totalSkipped } = resolveTemplateFields(
      [row1, row2],
      creatmetaFields,
      null,
    );
    const manualTotal = resolvedRows.reduce((sum, r) => sum + r.skippedFieldIds.length, 0);
    expect(totalSkipped).toBe(manualTotal);
    expect(totalSkipped).toBe(3);
  });

  it('row with empty components and absent createmeta: components NOT counted as skipped', () => {
    const row = makeRow({ components: [] }); // no components value
    const creatmetaFields: CreatemetaField[] = [];
    const { resolvedRows, totalSkipped } = resolveTemplateFields([row], creatmetaFields, null);
    expect(resolvedRows[0].skippedFieldIds).not.toContain('components');
    expect(totalSkipped).toBe(0);
  });
});
