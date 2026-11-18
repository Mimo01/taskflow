import { type CreatemetaField, wrapCustomFieldValue } from '@/services/jira';
import { labelsFixVersionsCreateFields } from './issue-field-diff';
import type { FormState } from './useCreateEditForm';

interface BuildEpicCreateFieldsInput {
  state: FormState;
  epicNameFieldKey: string;
  storyPointsFieldKey: string | null;
  creatmetaFields: CreatemetaField[] | undefined;
}

/**
 * Extra fields for the Epic create call (summary is passed to createIssue separately).
 * Mirrors useIssueMutations.createMutation: only createmeta-offered fields are sent, the
 * epic name goes out once under epicNameFieldKey, and no epic link / parent / timetracking.
 */
export function buildEpicCreateFields({
  state,
  epicNameFieldKey,
  storyPointsFieldKey,
  creatmetaFields,
}: BuildEpicCreateFieldsInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    issuetype: 'Epic',
    [epicNameFieldKey]: state.summary.trim(),
  };
  if (state.description.trim()) out.description = state.description;
  if (state.selectedAssigneeName) out.assignee = { name: state.selectedAssigneeName };
  if (state.priority) out.priority = { name: state.priority };

  // An empty createmeta is unknown, never "offers nothing".
  const offered =
    creatmetaFields && creatmetaFields.length > 0
      ? new Set(creatmetaFields.map((f) => f.fieldId))
      : null;

  if (
    storyPointsFieldKey &&
    state.storyPoints !== '' &&
    (!offered || offered.has(storyPointsFieldKey))
  ) {
    out[storyPointsFieldKey] = Number(state.storyPoints);
  }

  Object.assign(out, labelsFixVersionsCreateFields(state, 'Epic', offered));

  for (const [k, v] of Object.entries(state.customFieldValues)) {
    if (k === epicNameFieldKey || v.trim() === '') continue;
    const fieldMeta = creatmetaFields?.find((f) => f.fieldId === k);
    if (offered && !fieldMeta) continue;
    out[k] = fieldMeta ? wrapCustomFieldValue(fieldMeta, v) : v;
  }
  return out;
}
