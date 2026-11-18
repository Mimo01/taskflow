import type { FormState } from '@/routes/dashboard/create-edit-issue/useCreateEditForm';
import type { CreatemetaField } from '@/services/jira';
import type { IssueDraftSnapshot } from '@/stores/issue-drafts.store';

export type StaleNotes = {
  epic?: string;
  parent?: string;
  fixVersions?: string;
  customFields: Record<string, string>;
};

/** D-12: only summary, description, a staged file or a filled link row count as content. */
export function hasUserContent(
  state: Pick<FormState, 'summary' | 'description' | 'linkRows'>,
  stagedCount: number,
): boolean {
  return (
    state.summary.trim() !== '' ||
    state.description.trim() !== '' ||
    stagedCount > 0 ||
    state.linkRows.some((r) => r.issueKey.trim() !== '')
  );
}

export function hasEpicContent(name: string, description: string, stagedCount: number): boolean {
  return name.trim() !== '' || description.trim() !== '' || stagedCount > 0;
}

export function toIssueSnapshot(
  state: FormState,
  fieldNames: Record<string, string>,
): IssueDraftSnapshot {
  const customFieldNames: Record<string, string> = {};
  for (const key of Object.keys(state.customFieldValues)) {
    customFieldNames[key] = fieldNames[key] ?? key;
  }
  return {
    selectedIssueType: state.selectedIssueType,
    summary: state.summary,
    description: state.description,
    selectedAssignee: state.selectedAssignee,
    selectedAssigneeName: state.selectedAssigneeName,
    timeEstimate: state.timeEstimate,
    priority: state.priority,
    storyPoints: state.storyPoints,
    epicLinkKey: state.epicLinkKey,
    parentKey: state.parentKey,
    labels: state.labels,
    fixVersions: state.fixVersions,
    customFieldValues: state.customFieldValues,
    customFieldInputValues: state.customFieldInputValues,
    customFieldNames,
    linkRows: state.linkRows,
  };
}

export function snapshotToFormPatch(s: IssueDraftSnapshot): Partial<FormState> {
  return {
    selectedIssueType: s.selectedIssueType,
    summary: s.summary,
    description: s.description,
    selectedAssignee: s.selectedAssignee,
    selectedAssigneeName: s.selectedAssigneeName,
    timeEstimate: s.timeEstimate,
    priority: s.priority,
    storyPoints: s.storyPoints,
    epicLinkKey: s.epicLinkKey,
    parentKey: s.parentKey,
    labels: s.labels,
    fixVersions: s.fixVersions,
    customFieldValues: s.customFieldValues,
    customFieldInputValues: s.customFieldInputValues,
    linkRows: s.linkRows,
  };
}

/** D-07: fields carried over into the next create. */
export function keptFieldsAfterCreate(state: FormState): Partial<FormState> {
  return {
    selectedIssueType: state.selectedIssueType,
    epicLinkKey: state.epicLinkKey,
    parentKey: state.parentKey,
    selectedAssignee: state.selectedAssignee,
    selectedAssigneeName: state.selectedAssigneeName,
    assigneeUnassignPicked: state.assigneeUnassignPicked,
    priority: state.priority,
    labels: state.labels,
    fixVersions: state.fixVersions,
    customFieldValues: state.customFieldValues,
    customFieldInputValues: state.customFieldInputValues,
  };
}

export interface SnapshotValidationContext {
  createmetaFields?: CreatemetaField[];
  epicExists: boolean | null;
  parentExists: boolean | null;
  fixVersionIds: Set<string> | null;
}

/** D-15: clear each invalid piece and describe it; unknown lookups never clear. */
export function validateSnapshot(
  snapshot: IssueDraftSnapshot,
  ctx: SnapshotValidationContext,
): { snapshot: IssueDraftSnapshot; notes: StaleNotes } {
  const out: IssueDraftSnapshot = { ...snapshot };
  const notes: StaleNotes = { customFields: {} };

  if (snapshot.epicLinkKey && ctx.epicExists === false) {
    out.epicLinkKey = null;
    notes.epic = `Epic ${snapshot.epicLinkKey} no longer exists`;
  }
  if (snapshot.parentKey && ctx.parentExists === false) {
    out.parentKey = null;
    notes.parent = `Parent ${snapshot.parentKey} no longer exists`;
  }

  if (ctx.createmetaFields) {
    const byId = new Map(ctx.createmetaFields.map((f) => [f.fieldId, f]));
    const values = { ...snapshot.customFieldValues };
    const inputs = { ...snapshot.customFieldInputValues };
    for (const key of Object.keys(snapshot.customFieldValues)) {
      const field = byId.get(key);
      if (!field) {
        delete values[key];
        delete inputs[key];
        const name = snapshot.customFieldNames[key] ?? key;
        notes.customFields[key] = `${name} is no longer available on this screen`;
        continue;
      }
      const allowed = field.schema.allowedValues;
      if (allowed && allowed.length > 0) {
        const stored = snapshot.customFieldValues[key];
        if (stored && !allowed.some((a) => a.id === stored)) {
          const label = snapshot.customFieldInputValues[key] || stored;
          delete values[key];
          delete inputs[key];
          notes.customFields[key] = `${label} is no longer an option, choose another`;
        }
      }
    }
    out.customFieldValues = values;
    out.customFieldInputValues = inputs;
  }

  if (ctx.fixVersionIds) {
    const ids = ctx.fixVersionIds;
    const gone = snapshot.fixVersions.filter((v) => !ids.has(v.id));
    if (gone.length > 0) {
      out.fixVersions = snapshot.fixVersions.filter((v) => ids.has(v.id));
      notes.fixVersions = gone
        .map((v) => `${v.name} is no longer an option, choose another`)
        .join('; ');
    }
  }

  return { snapshot: out, notes };
}
