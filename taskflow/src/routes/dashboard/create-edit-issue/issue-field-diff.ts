import type { FormState, IssueType } from './useCreateEditForm';

// Create-body and edit-diff helpers for the sidebar Labels / Fix version fields.
// Value shapes mirror FieldsSection: labels as string[], fixVersions as [{ id }].
// fixVersions replaces the whole set on PUT, which is safe only because the control
// is seeded with the issue's existing set (and never sent when that seed is unknown).

type LabelsFixVersions = Pick<FormState, 'labels' | 'fixVersions'>;

interface InitialLabelsFixVersions {
  labels?: string[];
  fixVersions?: { id: string; name: string }[];
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bs = new Set(b);
  return a.every((x) => bs.has(x));
}

/** `offered` is the current type's createmeta field ids; null means unknown (send as before). */
export function labelsFixVersionsCreateFields(
  state: LabelsFixVersions,
  issueType: IssueType,
  offered: Set<string> | null = null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (state.labels.length > 0 && (!offered || offered.has('labels'))) out.labels = state.labels;
  if (
    issueType !== 'Subtask' &&
    state.fixVersions.length > 0 &&
    (!offered || offered.has('fixVersions'))
  ) {
    out.fixVersions = state.fixVersions.map((v) => ({ id: v.id }));
  }
  return out;
}

export function labelsFixVersionsEditFields(
  state: LabelsFixVersions,
  initial: InitialLabelsFixVersions,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (initial.labels !== undefined && !sameSet(state.labels, initial.labels)) {
    out.labels = state.labels;
  }
  if (
    initial.fixVersions !== undefined &&
    !sameSet(
      state.fixVersions.map((v) => v.id),
      initial.fixVersions.map((v) => v.id),
    )
  ) {
    out.fixVersions = state.fixVersions.map((v) => ({ id: v.id }));
  }
  return out;
}
