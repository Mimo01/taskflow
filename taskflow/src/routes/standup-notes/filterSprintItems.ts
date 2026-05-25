import type { JiraIssue } from '@/services/jira';

export interface FilteredSprintItems {
  inProgress: JiraIssue[];
  upNext: JiraIssue[];
}

/**
 * Filters a flat sprint issues list to the current user's leaf items,
 * split by Jira status category (D-04/D-05).
 *
 * Leaf items (D-04):
 *   - Subtasks (issuetype.subtask === true) are ALWAYS leaf — short-circuits
 *     any subtasks.length check, avoiding undefined access on subtask rows
 *     where the subtasks field is not included in the API response.
 *   - Childless tasks/stories/bugs (issuetype.subtask === false &&
 *     subtasks.length === 0) are leaf. Parent stories that have subtasks
 *     (subtasks.length > 0) are excluded — they are coordinated, not directly
 *     worked.
 *
 * Status split (D-05):
 *   - inProgress: statusCategory.key === 'indeterminate'
 *   - upNext:     statusCategory.key === 'new'
 *   - Done (statusCategory.key === 'done') is excluded from both.
 */
export function filterSprintItems(
  issues: JiraIssue[],
  jiraUserDisplayName: string,
): FilteredSprintItems {
  const isLeaf = (issue: JiraIssue): boolean =>
    issue.fields.issuetype.subtask ||
    (!issue.fields.issuetype.subtask && (issue.fields.subtasks?.length ?? 0) === 0);

  const isAssignedToMe = (issue: JiraIssue): boolean =>
    issue.fields.assignee?.displayName === jiraUserDisplayName;

  return {
    inProgress: issues.filter(
      (i) =>
        isLeaf(i) &&
        isAssignedToMe(i) &&
        i.fields.status.statusCategory?.key === 'indeterminate',
    ),
    upNext: issues.filter(
      (i) =>
        isLeaf(i) &&
        isAssignedToMe(i) &&
        i.fields.status.statusCategory?.key === 'new',
    ),
  };
}
