/**
 * Unit tests for filterSprintItems() — grouped sprint-issue filter (STAND-07).
 *
 * Tests verify:
 *   - Grouped output: parent stories show as top-level SprintRows with nested subtasks
 *   - Old "leaf-only" exclusion is GONE: parent with subtasks now appears (regression guard)
 *   - Status-category split (D-05): placement uses parent status when parent is assigned
 *     to me; uses subtask status when parent is NOT assigned to me
 *   - Orphan subtasks (my subtask, parent not in my list) → standalone SprintRow
 *   - Assignee guard: only issues assigned to jiraUserDisplayName appear
 *   - Done items excluded from both buckets
 */

import { describe, expect, it } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import { filterSprintItems } from './filterSprintItems';

const ME = 'Me Myself';
const OTHER = 'Someone Else';

/**
 * Builds a minimal JiraIssue fixture. Only fields used by filterSprintItems
 * are populated; everything else is cast through as JiraIssue.
 */
function makeIssue(overrides: {
  key: string;
  statusKey: 'new' | 'indeterminate' | 'done';
  isSubtask: boolean;
  subtasksLen?: number;
  displayName?: string;
  parentKey?: string;
}): JiraIssue {
  const { key, statusKey, isSubtask, subtasksLen = 0, displayName, parentKey } = overrides;
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
      parent: parentKey
        ? { id: parentKey, key: parentKey, fields: { summary: `Parent ${parentKey}` } }
        : undefined,
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

describe('filterSprintItems — grouped output', () => {
  it('includes a childless task (standalone) with indeterminate status in inProgress', () => {
    const issue = makeIssue({
      key: 'ESHOP-1',
      statusKey: 'indeterminate',
      isSubtask: false,
      displayName: ME,
    });
    const { inProgress, upNext } = filterSprintItems([issue], ME);
    expect(inProgress.map((r) => r.issue.key)).toContain('ESHOP-1');
    expect(upNext.map((r) => r.issue.key)).not.toContain('ESHOP-1');
    expect(inProgress[0].subtasks).toHaveLength(0);
  });

  it('includes a childless task with new status in upNext as standalone row', () => {
    const issue = makeIssue({
      key: 'ESHOP-2',
      statusKey: 'new',
      isSubtask: false,
      subtasksLen: 0,
      displayName: ME,
    });
    const { inProgress, upNext } = filterSprintItems([issue], ME);
    expect(upNext.map((r) => r.issue.key)).toContain('ESHOP-2');
    expect(inProgress.map((r) => r.issue.key)).not.toContain('ESHOP-2');
    expect(upNext[0].subtasks).toHaveLength(0);
  });

  it('REGRESSION: parent story WITH subtasks now appears (old leaf-exclusion bug removed)', () => {
    // Parent: non-subtask with subtasksLen > 0, indeterminate status, assigned to me
    const parent = makeIssue({
      key: 'ESHOP-3',
      statusKey: 'indeterminate',
      isSubtask: false,
      subtasksLen: 2,
      displayName: ME,
    });
    const { inProgress, upNext } = filterSprintItems([parent], ME);
    // Must appear — the old filter that excluded this is removed
    expect(inProgress.map((r) => r.issue.key)).toContain('ESHOP-3');
    expect(upNext.map((r) => r.issue.key)).not.toContain('ESHOP-3');
  });

  it('nests my subtasks under their parent story in the same row', () => {
    const parent = makeIssue({
      key: 'ESHOP-10',
      statusKey: 'indeterminate',
      isSubtask: false,
      displayName: ME,
    });
    const sub1 = makeIssue({
      key: 'ESHOP-10-S1',
      statusKey: 'new',
      isSubtask: true,
      displayName: ME,
      parentKey: 'ESHOP-10',
    });
    const sub2 = makeIssue({
      key: 'ESHOP-10-S2',
      statusKey: 'indeterminate',
      isSubtask: true,
      displayName: ME,
      parentKey: 'ESHOP-10',
    });

    const { inProgress } = filterSprintItems([parent, sub1, sub2], ME);

    const row = inProgress.find((r) => r.issue.key === 'ESHOP-10');
    expect(row).toBeDefined();
    expect(row?.subtasks.map((s) => s.key)).toContain('ESHOP-10-S1');
    expect(row?.subtasks.map((s) => s.key)).toContain('ESHOP-10-S2');
  });

  it('subtasks nest under parent regardless of subtask own status when parent is assigned to me (placed by parent status)', () => {
    const parent = makeIssue({
      key: 'ESHOP-11',
      statusKey: 'new',
      isSubtask: false,
      displayName: ME,
    });
    // subtask has indeterminate status but parent is 'new' and assigned to me → should be upNext row
    const sub = makeIssue({
      key: 'ESHOP-11-S1',
      statusKey: 'indeterminate',
      isSubtask: true,
      displayName: ME,
      parentKey: 'ESHOP-11',
    });

    const { inProgress, upNext } = filterSprintItems([parent, sub], ME);

    const upNextRow = upNext.find((r) => r.issue.key === 'ESHOP-11');
    expect(upNextRow).toBeDefined();
    expect(upNextRow?.subtasks.map((s) => s.key)).toContain('ESHOP-11-S1');
    // Parent must NOT appear in inProgress
    expect(inProgress.map((r) => r.issue.key)).not.toContain('ESHOP-11');
  });

  it('renders orphan subtask (my subtask, parent not in my list) as standalone row placed by subtask status', () => {
    // No parent issue in the flat list for this subtask
    const orphan = makeIssue({
      key: 'ESHOP-20',
      statusKey: 'indeterminate',
      isSubtask: true,
      displayName: ME,
      parentKey: 'ESHOP-99',
    });

    const { inProgress } = filterSprintItems([orphan], ME);

    const row = inProgress.find((r) => r.issue.key === 'ESHOP-20');
    expect(row).toBeDefined();
    expect(row?.subtasks).toHaveLength(0);
  });

  it('excludes done items from both lists', () => {
    const subtaskDone = makeIssue({
      key: 'ESHOP-4',
      statusKey: 'done',
      isSubtask: true,
      displayName: ME,
    });
    const taskDone = makeIssue({
      key: 'ESHOP-5',
      statusKey: 'done',
      isSubtask: false,
      subtasksLen: 0,
      displayName: ME,
    });
    const { inProgress, upNext } = filterSprintItems([subtaskDone, taskDone], ME);
    const allKeys = [...inProgress, ...upNext].map((r) => r.issue.key);
    expect(allKeys).not.toContain('ESHOP-4');
    expect(allKeys).not.toContain('ESHOP-5');
  });

  it('does NOT nest a done subtask under an active parent', () => {
    const parent = makeIssue({
      key: 'ESHOP-40',
      statusKey: 'indeterminate',
      isSubtask: false,
      displayName: ME,
    });
    const doneSub = makeIssue({
      key: 'ESHOP-40-S1',
      statusKey: 'done',
      isSubtask: true,
      displayName: ME,
      parentKey: 'ESHOP-40',
    });
    const activeSub = makeIssue({
      key: 'ESHOP-40-S2',
      statusKey: 'new',
      isSubtask: true,
      displayName: ME,
      parentKey: 'ESHOP-40',
    });

    const { inProgress } = filterSprintItems([parent, doneSub, activeSub], ME);

    const row = inProgress.find((r) => r.issue.key === 'ESHOP-40');
    expect(row).toBeDefined();
    expect(row?.subtasks.map((s) => s.key)).toContain('ESHOP-40-S2');
    expect(row?.subtasks.map((s) => s.key)).not.toContain('ESHOP-40-S1');
  });

  it('resurfaces an active subtask of a DONE parent as a standalone row', () => {
    // Parent is done (excluded), but I still have an in-progress subtask under it.
    const doneParent = makeIssue({
      key: 'ESHOP-41',
      statusKey: 'done',
      isSubtask: false,
      subtasksLen: 1,
      displayName: ME,
    });
    const activeSub = makeIssue({
      key: 'ESHOP-41-S1',
      statusKey: 'indeterminate',
      isSubtask: true,
      displayName: ME,
      parentKey: 'ESHOP-41',
    });

    const { inProgress, upNext } = filterSprintItems([doneParent, activeSub], ME);

    // Done parent never shows.
    expect([...inProgress, ...upNext].map((r) => r.issue.key)).not.toContain('ESHOP-41');
    // My active subtask resurfaces standalone, placed by its own status.
    const row = inProgress.find((r) => r.issue.key === 'ESHOP-41-S1');
    expect(row).toBeDefined();
    expect(row?.subtasks).toHaveLength(0);
  });

  it('excludes items not assigned to me', () => {
    const issue = makeIssue({
      key: 'ESHOP-6',
      statusKey: 'indeterminate',
      isSubtask: true,
      displayName: OTHER,
    });
    const { inProgress, upNext } = filterSprintItems([issue], ME);
    const allKeys = [...inProgress, ...upNext].map((r) => r.issue.key);
    expect(allKeys).not.toContain('ESHOP-6');
  });

  it('excludes items with no assignee', () => {
    const issue = makeIssue({ key: 'ESHOP-7', statusKey: 'new', isSubtask: false, subtasksLen: 0 });
    const { inProgress, upNext } = filterSprintItems([issue], ME);
    const allKeys = [...inProgress, ...upNext].map((r) => r.issue.key);
    expect(allKeys).not.toContain('ESHOP-7');
  });

  it('includes parent NOT assigned to me when I own a subtask of it, nested under parent', () => {
    // Parent is assigned to OTHER (not me) — without this fix it would be excluded.
    const parent = makeIssue({
      key: 'ESHOP-30',
      statusKey: 'indeterminate',
      isSubtask: false,
      displayName: OTHER,
    });
    // My subtask under that parent.
    const mySub = makeIssue({
      key: 'ESHOP-30-S1',
      statusKey: 'new',
      isSubtask: true,
      displayName: ME,
      parentKey: 'ESHOP-30',
    });
    // Another subtask under same parent — NOT mine.
    const otherSub = makeIssue({
      key: 'ESHOP-30-S2',
      statusKey: 'new',
      isSubtask: true,
      displayName: OTHER,
      parentKey: 'ESHOP-30',
    });

    const { inProgress, upNext } = filterSprintItems([parent, mySub, otherSub], ME);

    // Parent must appear — placed by MY subtask's status ('new' → upNext),
    // not the parent's own status ('indeterminate' → inProgress).
    const row = upNext.find((r) => r.issue.key === 'ESHOP-30');
    expect(row).toBeDefined();
    expect(inProgress.map((r) => r.issue.key)).not.toContain('ESHOP-30');

    // Only MY subtask is nested — the other subtask must NOT appear.
    expect(row?.subtasks.map((s) => s.key)).toContain('ESHOP-30-S1');
    expect(row?.subtasks.map((s) => s.key)).not.toContain('ESHOP-30-S2');
  });

  it('section placement uses subtask status when parent is NOT assigned to me', () => {
    // Parent is 'new' (would be upNext), assigned to OTHER — but placement must use MY subtask's status.
    const parent = makeIssue({
      key: 'ESHOP-31',
      statusKey: 'new',
      isSubtask: false,
      displayName: OTHER,
    });
    // My subtask has indeterminate status — governs placement because parent is not mine.
    const mySub = makeIssue({
      key: 'ESHOP-31-S1',
      statusKey: 'indeterminate',
      isSubtask: true,
      displayName: ME,
      parentKey: 'ESHOP-31',
    });

    const { inProgress, upNext } = filterSprintItems([parent, mySub], ME);

    // Must be in inProgress (my subtask's status), not upNext (parent's status).
    const row = inProgress.find((r) => r.issue.key === 'ESHOP-31');
    expect(row).toBeDefined();
    expect(upNext.map((r) => r.issue.key)).not.toContain('ESHOP-31');
    expect(row?.subtasks.map((s) => s.key)).toContain('ESHOP-31-S1');
  });

  it('section placement uses parent status when parent IS assigned to me (even with subtasks)', () => {
    // Parent is 'new' (upNext), assigned to ME — placement must use parent's status.
    const parent = makeIssue({
      key: 'ESHOP-32',
      statusKey: 'new',
      isSubtask: false,
      displayName: ME,
    });
    // My subtask has indeterminate status — but parent is mine, so parent's status wins.
    const mySub = makeIssue({
      key: 'ESHOP-32-S1',
      statusKey: 'indeterminate',
      isSubtask: true,
      displayName: ME,
      parentKey: 'ESHOP-32',
    });

    const { inProgress, upNext } = filterSprintItems([parent, mySub], ME);

    // Must be in upNext (parent's status 'new'), not inProgress (subtask's status).
    const row = upNext.find((r) => r.issue.key === 'ESHOP-32');
    expect(row).toBeDefined();
    expect(inProgress.map((r) => r.issue.key)).not.toContain('ESHOP-32');
    expect(row?.subtasks.map((s) => s.key)).toContain('ESHOP-32-S1');
  });
});
