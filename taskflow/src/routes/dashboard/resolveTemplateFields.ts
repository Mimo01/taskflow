import type { CreatemetaField } from '@/services/jira';
import type { SubtaskTemplateRow } from '@/stores/subtask-templates.store';

export interface ResolvedRowResult {
  row: SubtaskTemplateRow;
  skippedFieldIds: string[];
}

/**
 * Resolves template rows against a project's createmeta fields.
 *
 * Custom fields absent from createmeta are dropped (D-02) and counted in
 * skippedFieldIds. Core fields (summary, assignee, priority, labels,
 * duedate, timetracking, parent) and the storyPointsFieldKey are ALWAYS
 * kept regardless of createmeta content.
 *
 * T-80-02: resolved values are returned as discrete data — never
 * string-interpolated into other field values.
 */
export function resolveTemplateFields(
  rows: SubtaskTemplateRow[],
  creatmetaFields: CreatemetaField[],
  storyPointsFieldKey: string | null,
): { resolvedRows: ResolvedRowResult[]; totalSkipped: number } {
  const creatmetaFieldIds = new Set(creatmetaFields.map((f) => f.fieldId));

  const ALWAYS_ALLOWED = new Set([
    'summary',
    'assignee',
    'priority',
    'labels',
    'duedate',
    'timetracking',
    'parent',
    ...(storyPointsFieldKey ? [storyPointsFieldKey] : []),
  ]);

  let totalSkipped = 0;

  const resolvedRows = rows.map((row) => {
    const skippedFieldIds: string[] = [];
    const cleanCustomFields: Record<string, string> = {};

    for (const [fid, val] of Object.entries(row.customFieldValues)) {
      if (creatmetaFieldIds.has(fid) || ALWAYS_ALLOWED.has(fid)) {
        cleanCustomFields[fid] = val;
      } else {
        skippedFieldIds.push(fid);
      }
    }

    // components: drop if row has components but 'components' absent from createmeta
    let components = row.components;
    if (row.components.length > 0 && !creatmetaFieldIds.has('components')) {
      skippedFieldIds.push('components');
      components = [];
    }

    totalSkipped += skippedFieldIds.length;
    return {
      row: { ...row, customFieldValues: cleanCustomFields, components },
      skippedFieldIds,
    };
  });

  return { resolvedRows, totalSkipped };
}
