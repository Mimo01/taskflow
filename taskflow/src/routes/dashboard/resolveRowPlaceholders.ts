import type { JiraIssueDetail } from '@/services/jira';
import type { SubtaskTemplateRow } from '@/stores/subtask-templates.store';

export interface PlaceholderContext {
  jiraUsername: string | null;
  jiraUserDisplayName: string | null;
  parentIssue: JiraIssueDetail;
}

export interface ResolvedAssignee {
  payloadName: string | null;
  displayHint: string;
}

/**
 * Resolves the assignee placeholder for a subtask template row.
 *
 * - @unassigned → payloadName: null (omit from createIssue payload)
 * - @current    → payloadName: jiraUsername (DC name field, never displayName)
 * - @inherit    → payloadName: parent assignee.name or null (D-12: missing → empty)
 * - concrete    → passed through as-is
 *
 * T-80-02: resolved value is returned as a discrete data field — never
 * interpolated into other field values.
 */
export function resolveAssignee(
  assignee: SubtaskTemplateRow['assignee'],
  ctx: PlaceholderContext,
): ResolvedAssignee {
  if (assignee === '@unassigned') {
    return { payloadName: null, displayHint: '@unassigned' };
  }

  if (assignee === '@current') {
    return {
      payloadName: ctx.jiraUsername,
      displayHint: ctx.jiraUserDisplayName ? `@current → ${ctx.jiraUserDisplayName}` : '@current',
    };
  }

  if (assignee === '@inherit') {
    const name = ctx.parentIssue.fields.assignee?.name ?? null;
    const display = ctx.parentIssue.fields.assignee?.displayName ?? '(none)';
    return {
      payloadName: name,
      displayHint: `@inherit → ${display}`,
    };
  }

  // Concrete username — pass through unchanged
  return { payloadName: assignee, displayHint: assignee };
}

/**
 * Resolves all placeholder fields in a template row at create time.
 *
 * Returns the row title and an options object suitable for passing to
 * createIssue. @inherit on priority/labels/duedate with a missing parent
 * value resolves to empty (no error, D-12).
 *
 * Pure function — no hooks, no side effects.
 */
export function resolveRowForCreate(
  row: SubtaskTemplateRow,
  ctx: PlaceholderContext,
): { title: string; options: Record<string, unknown> } {
  const resolved = resolveAssignee(row.assignee, ctx);
  const options: Record<string, unknown> = {};

  // Assignee — omit entirely for @unassigned (null payloadName)
  if (resolved.payloadName) {
    options.assignee = { name: resolved.payloadName };
  }

  // Priority — support @inherit sentinel (D-09)
  const priority =
    row.priority === '@inherit' ? (ctx.parentIssue.fields.priority?.name ?? null) : row.priority;
  if (priority) {
    options.priority = { name: priority };
  }

  // Labels — support ['@inherit'] sentinel (D-09)
  const labels =
    row.labels.length === 1 && row.labels[0] === '@inherit'
      ? (ctx.parentIssue.fields.labels ?? [])
      : row.labels;
  if (labels.length > 0) {
    options.labels = labels;
  }

  // Due date — support '@inherit' sentinel (D-09)
  const duedate =
    row.duedate === '@inherit' ? (ctx.parentIssue.fields.duedate ?? null) : row.duedate;
  if (duedate) {
    options.duedate = duedate;
  }

  return { title: row.title, options };
}
