/**
 * filterSprintItems — Grouped sprint issue filter for the Today column.
 *
 * INCLUSION RULE:
 *   A parent story becomes a row when EITHER:
 *     (a) the parent is assigned to me (existing rule), OR
 *     (b) the parent has at least one subtask assigned to me.
 *   This lets stories appear even when I'm only assigned to a subtask of them,
 *   not to the story itself — with my subtask(s) nested underneath.
 *
 * STATUS PLACEMENT RULE (D-05 — revised for grouped display):
 *   The row's bucket (inProgress / upNext) is determined by the PARENT story's status
 *   category, NOT the subtask's own status. Subtasks nest under their parent regardless
 *   of the subtask's own statusCategory. This means a subtask in "done" state still
 *   appears under its in-progress parent — it shows MY work on that story.
 *
 * GROUPING RULE (Decision 1 — replaces old D-04 "leaf-only" rule):
 *   - Parent stories assigned to me → shown as top-level SprintRow rows.
 *   - Parent stories NOT assigned to me but with MY subtasks → also shown as top-level rows.
 *   - MY subtasks are nested inside their parent's SprintRow.subtasks[].
 *   - Subtasks assigned to me whose parent is NOT in the flat parent list at all →
 *     rendered as standalone SprintRow (subtasks=[]), placed by the subtask's own status.
 *   - Childless parents assigned to me with no nested subtasks → standalone rows.
 *   - The old rule that EXCLUDED parent stories with subtasks (isLeaf filter) is
 *     REMOVED — that was the bug causing "only one in-progress story shows."
 *
 * SERVER-SIDE FETCH:
 *   fetchSprintIssues(assignedToMe=false) returns all sprint parents PLUS all their
 *   subtasks as a flat array. The displayName guard below is the sole assignee filter.
 */

import type { JiraIssue } from '@/services/jira';

export interface SprintRow {
  /** The parent story or a standalone leaf item (childless task / orphan subtask). */
  issue: JiraIssue;
  /** My subtasks nested under this parent (empty array for standalone items). */
  subtasks: JiraIssue[];
}

export interface FilteredSprintItems {
  inProgress: SprintRow[];
  upNext: SprintRow[];
}

export function filterSprintItems(
  issues: JiraIssue[],
  jiraUserDisplayName: string,
): FilteredSprintItems {
  const isAssignedToMe = (issue: JiraIssue): boolean =>
    issue.fields.assignee?.displayName === jiraUserDisplayName;

  // All subtasks assigned to me in the flat list.
  const mySubtasks = issues.filter((i) => i.fields.issuetype.subtask && isAssignedToMe(i));

  // Set of parent keys that have at least one subtask assigned to me.
  const parentKeysWithMySubtask = new Set<string>(
    mySubtasks.map((s) => s.fields.parent?.key).filter((k): k is string => !!k),
  );

  // All non-subtask issues in the flat list.
  const allParents = issues.filter((i) => !i.fields.issuetype.subtask);

  // Index all parents by key for O(1) lookup and orphan detection.
  const allParentsByKey = new Map<string, JiraIssue>(allParents.map((p) => [p.key, p]));

  // A parent becomes a row when assigned to me OR I own one of its subtasks.
  const includedParents = allParents.filter(
    (p) => isAssignedToMe(p) || parentKeysWithMySubtask.has(p.key),
  );

  // Build parent rows: nest only MY subtasks under each parent.
  const parentRows: SprintRow[] = includedParents.map((parent) => ({
    issue: parent,
    subtasks: mySubtasks.filter((s) => s.fields.parent?.key === parent.key),
  }));

  // Orphan mySubtasks: assigned to me, but their parent is not present in allParentsByKey at all.
  const orphanSubtasks: SprintRow[] = mySubtasks
    .filter((s) => {
      const pk = s.fields.parent?.key;
      return !pk || !allParentsByKey.has(pk);
    })
    .map((s) => ({ issue: s, subtasks: [] }));

  const allRows = [...parentRows, ...orphanSubtasks];

  return {
    inProgress: allRows.filter(
      (r) => r.issue.fields.status.statusCategory?.key === 'indeterminate',
    ),
    upNext: allRows.filter(
      (r) => r.issue.fields.status.statusCategory?.key === 'new',
    ),
  };
}
