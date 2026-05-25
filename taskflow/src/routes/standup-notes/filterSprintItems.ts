/**
 * filterSprintItems — Grouped sprint issue filter for the Today column.
 *
 * STATUS PLACEMENT RULE (D-05 — revised for grouped display):
 *   The row's bucket (inProgress / upNext) is determined by the PARENT story's status
 *   category, NOT the subtask's own status. Subtasks nest under their parent regardless
 *   of the subtask's own statusCategory. This means a subtask in "done" state still
 *   appears under its in-progress parent — it shows MY work on that story.
 *
 * GROUPING RULE (Decision 1 — replaces old D-04 "leaf-only" rule):
 *   - Parent stories assigned to me → shown as top-level SprintRow rows.
 *   - MY subtasks are nested inside their parent's SprintRow.subtasks[].
 *   - Subtasks assigned to me whose parent is NOT in my parent list → rendered as
 *     standalone SprintRow (subtasks=[]), placed by the subtask's own status category.
 *   - The old rule that EXCLUDED parent stories with subtasks (isLeaf filter) is
 *     REMOVED — that was the bug causing "only one in-progress story shows."
 *
 * SERVER-SIDE PRE-FILTER:
 *   fetchSprintIssues(assignedToMe=true) already returns only issues assigned to me
 *   (parents + my subtasks of those parents). The displayName guard below is a
 *   defence-in-depth fallback in case the server returns extra rows.
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

  // Split flat list into parents (non-subtasks) and subtasks assigned to me.
  const parents = issues.filter((i) => !i.fields.issuetype.subtask && isAssignedToMe(i));
  const subtasks = issues.filter((i) => i.fields.issuetype.subtask && isAssignedToMe(i));

  // Index parents by key for O(1) lookup.
  const parentsByKey = new Map<string, JiraIssue>(parents.map((p) => [p.key, p]));

  // For each parent, collect my subtasks whose parent.key matches.
  const parentRows: SprintRow[] = parents.map((parent) => ({
    issue: parent,
    subtasks: subtasks.filter((s) => s.fields.parent?.key === parent.key),
  }));

  // Orphan subtasks: assigned to me, but parent not in my parent list.
  const orphanSubtasks: SprintRow[] = subtasks
    .filter((s) => {
      const pk = s.fields.parent?.key;
      return !pk || !parentsByKey.has(pk);
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
