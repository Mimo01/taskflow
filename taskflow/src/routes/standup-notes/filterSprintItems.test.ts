/**
 * Unit tests for filterSprintItems() — the pure sprint-issue filter helper
 * used by the Today column (STAND-07).
 *
 * Tests verify:
 *   - Leaf detection (D-04): subtasks always leaf; childless tasks leaf; parent tasks excluded
 *   - Status-category split (D-05): indeterminate → inProgress, new → upNext, done excluded
 *   - Assignee match: only issues assigned to jiraUserDisplayName are returned
 */

import { describe, expect, it } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import { filterSprintItems } from './filterSprintItems';

const ME = 'Me Myself';
const OTHER = 'Someone Else';

/**
 * Builds a minimal JiraIssue-shaped fixture. Only the fields used by
 * filterSprintItems are populated; everything else is cast through as JiraIssue.
 */
function makeIssue(overrides: {
  key: string;
  statusKey: 'new' | 'indeterminate' | 'done';
  isSubtask: boolean;
  subtasksLen?: number;
  displayName?: string;
}): JiraIssue {
  const { key, statusKey, isSubtask, subtasksLen = 0, displayName } = overrides;
  return {
    id: key,
    key,
    fields: {
      summary: `Summary of ${key}`,
      issuetype: { name: isSubtask ? 'Sub-task' : 'Task', subtask: isSubtask },
      status: {
        id: '1',
        name: statusKey,
        statusCategory: { key: statusKey },
      },
      assignee: displayName ? { displayName, avatarUrls: { '48x48': '' } } : null,
      customfield_10016: null,
      subtasks: Array.from({ length: subtasksLen }, (_, i) => ({
        id: `${key}-child-${i}`,
        key: `${key}-child-${i}`,
        fields: {
          summary: `Child ${i}`,
          status: { name: 'To Do', statusCategory: { key: 'new' as const } },
        },
      })),
    },
  } as unknown as JiraIssue;
}

describe('filterSprintItems', () => {
  it('includes subtask with indeterminate status assigned to me in inProgress', () => {
    const issue = makeIssue({ key: 'SHOP-1', statusKey: 'indeterminate', isSubtask: true, displayName: ME });
    const { inProgress, upNext } = filterSprintItems([issue], ME);
    expect(inProgress.map((i) => i.key)).toContain('SHOP-1');
    expect(upNext.map((i) => i.key)).not.toContain('SHOP-1');
  });

  it('includes childless task with new status in upNext', () => {
    const issue = makeIssue({ key: 'SHOP-2', statusKey: 'new', isSubtask: false, subtasksLen: 0, displayName: ME });
    const { inProgress, upNext } = filterSprintItems([issue], ME);
    expect(upNext.map((i) => i.key)).toContain('SHOP-2');
    expect(inProgress.map((i) => i.key)).not.toContain('SHOP-2');
  });

  it('excludes task-with-subtasks (parent) from both lists', () => {
    // Parent task: non-subtask with subtasksLen > 0, indeterminate status, assigned to me
    const issue = makeIssue({ key: 'SHOP-3', statusKey: 'indeterminate', isSubtask: false, subtasksLen: 2, displayName: ME });
    const { inProgress, upNext } = filterSprintItems([issue], ME);
    expect(inProgress.map((i) => i.key)).not.toContain('SHOP-3');
    expect(upNext.map((i) => i.key)).not.toContain('SHOP-3');
  });

  it('excludes done items from both lists', () => {
    const subtaskDone = makeIssue({ key: 'SHOP-4', statusKey: 'done', isSubtask: true, displayName: ME });
    const taskDone = makeIssue({ key: 'SHOP-5', statusKey: 'done', isSubtask: false, subtasksLen: 0, displayName: ME });
    const { inProgress, upNext } = filterSprintItems([subtaskDone, taskDone], ME);
    const allKeys = [...inProgress, ...upNext].map((i) => i.key);
    expect(allKeys).not.toContain('SHOP-4');
    expect(allKeys).not.toContain('SHOP-5');
  });

  it('excludes items not assigned to me', () => {
    const issue = makeIssue({ key: 'SHOP-6', statusKey: 'indeterminate', isSubtask: true, displayName: OTHER });
    const { inProgress, upNext } = filterSprintItems([issue], ME);
    expect(inProgress.map((i) => i.key)).not.toContain('SHOP-6');
    expect(upNext.map((i) => i.key)).not.toContain('SHOP-6');
  });

  it('excludes items with no assignee', () => {
    // displayName omitted → assignee is null
    const issue = makeIssue({ key: 'SHOP-7', statusKey: 'new', isSubtask: false, subtasksLen: 0 });
    const { inProgress, upNext } = filterSprintItems([issue], ME);
    expect(inProgress.map((i) => i.key)).not.toContain('SHOP-7');
    expect(upNext.map((i) => i.key)).not.toContain('SHOP-7');
  });
});
