import { describe, expect, it } from 'vitest';

import { MY_DAY_BANDS, classifyBand, groupByMyDay, subtreeBand } from './my-tasks-sort';
import type { JiraIssue } from '@/services/jira';

const FLAGGED_FIELD_KEY = 'customfield_10021';
const FIXED_TODAY = new Date('2026-06-14T12:00:00Z');
const EMPTY_MR_KEYS = new Set<string>();

// Helper: builds a minimal JiraIssue stub for testing
function makeIssue(
  overrides: {
    key?: string;
    statusCategoryKey?: string;
    statusName?: string;
    duedate?: string | null;
    flaggedValue?: unknown;
    isSubtask?: boolean;
    parentKey?: string;
  } = {},
): JiraIssue {
  return {
    key: overrides.key ?? 'PROJ-1',
    fields: {
      summary: 'Test issue',
      status: {
        name: overrides.statusName ?? 'To Do',
        id: '1',
        statusCategory: { key: overrides.statusCategoryKey ?? 'new' },
      },
      duedate: overrides.duedate ?? null,
      issuetype: {
        subtask: overrides.isSubtask ?? false,
        name: overrides.isSubtask ? 'Sub-task' : 'Story',
        id: '10001',
      },
      parent: overrides.parentKey ? { key: overrides.parentKey } : undefined,
      [FLAGGED_FIELD_KEY]: overrides.flaggedValue ?? [],
    },
  } as unknown as JiraIssue;
}

// --- MY_DAY_BANDS ---

describe('MY_DAY_BANDS', () => {
  it('is an array of 6 band labels in urgency order', () => {
    expect(MY_DAY_BANDS).toEqual([
      'flagged-blocked',
      'overdue',
      'in-review-my-mr',
      'in-progress',
      'to-do',
      'done',
    ]);
  });
});

// --- classifyBand ---

describe('classifyBand', () => {
  it('returns 5 (done) for issue with statusCategory.key === "done"', () => {
    const issue = makeIssue({ statusCategoryKey: 'done', statusName: 'Done' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(5);
  });

  it('returns 0 (flagged-blocked) for a flagged issue', () => {
    const issue = makeIssue({
      statusCategoryKey: 'new',
      statusName: 'To Do',
      flaggedValue: [{ value: 'Impediment' }],
    });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(0);
  });

  it('returns 0 (flagged-blocked) for an issue with "blocked" in status name', () => {
    const issue = makeIssue({ statusCategoryKey: 'indeterminate', statusName: 'Blocked' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(0);
  });

  it('returns 1 (overdue) for a non-done issue with past duedate', () => {
    // duedate = 2026-06-13, today = 2026-06-14 → overdue
    const issue = makeIssue({ statusCategoryKey: 'new', duedate: '2026-06-13' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(1);
  });

  it('returns 4 (to-do) for non-done issue with future duedate', () => {
    // duedate = 2026-06-20, today = 2026-06-14 → not overdue
    const issue = makeIssue({ statusCategoryKey: 'new', duedate: '2026-06-20' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(4);
  });

  it('returns 2 (in-review-my-mr) when status includes "review" and issue has my open MR', () => {
    const issue = makeIssue({
      key: 'PROJ-10',
      statusCategoryKey: 'indeterminate',
      statusName: 'In Review',
    });
    const myMRKeys = new Set(['PROJ-10']);
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, myMRKeys, FIXED_TODAY)).toBe(2);
  });

  it('returns 3 (in-progress) when status includes "review" but no my MR', () => {
    const issue = makeIssue({
      key: 'PROJ-10',
      statusCategoryKey: 'indeterminate',
      statusName: 'In Review',
    });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(3);
  });

  it('returns 3 (in-progress) for indeterminate status not containing "review"', () => {
    const issue = makeIssue({ statusCategoryKey: 'indeterminate', statusName: 'In Progress' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(3);
  });

  it('returns 4 (to-do) for statusCategory "new"', () => {
    const issue = makeIssue({ statusCategoryKey: 'new', statusName: 'To Do' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(4);
  });

  it('flagged takes priority over done (flagged always wins per D-04 must_haves)', () => {
    // A flagged parent sorts into band 0 regardless of status — plan must_haves truth
    const issue = makeIssue({
      statusCategoryKey: 'done',
      statusName: 'Done',
      flaggedValue: [{ value: 'Impediment' }],
    });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(0);
  });
});

// --- subtreeBand (D-04 subtree evaluation) ---

describe('subtreeBand — D-04 subtree evaluation', () => {
  it('parent To Do (band 4) + overdue subtask (band 1) → returns 1 (overdue)', () => {
    const parent = makeIssue({ key: 'PROJ-1', statusCategoryKey: 'new', statusName: 'To Do' });
    const overdueSubtask = makeIssue({
      key: 'PROJ-2',
      statusCategoryKey: 'new',
      duedate: '2026-06-13', // past date
      isSubtask: true,
      parentKey: 'PROJ-1',
    });
    expect(
      subtreeBand(parent, [overdueSubtask], FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY),
    ).toBe(1);
  });

  it('parent Done (band 5) + In Progress subtask (band 3) → returns 3 (in-progress)', () => {
    const parent = makeIssue({ key: 'PROJ-1', statusCategoryKey: 'done', statusName: 'Done' });
    const inProgressSubtask = makeIssue({
      key: 'PROJ-2',
      statusCategoryKey: 'indeterminate',
      statusName: 'In Progress',
      isSubtask: true,
      parentKey: 'PROJ-1',
    });
    expect(
      subtreeBand(parent, [inProgressSubtask], FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY),
    ).toBe(3);
  });

  it('flagged parent → returns 0 (flagged-blocked) regardless of subtask bands', () => {
    const flaggedParent = makeIssue({
      key: 'PROJ-1',
      statusCategoryKey: 'done',
      statusName: 'Done',
      flaggedValue: [{ value: 'Impediment' }],
    });
    const doneSubtask = makeIssue({
      key: 'PROJ-2',
      statusCategoryKey: 'done',
      statusName: 'Done',
      isSubtask: true,
      parentKey: 'PROJ-1',
    });
    expect(
      subtreeBand(flaggedParent, [doneSubtask], FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY),
    ).toBe(0);
  });

  it('no subtasks → returns parent band', () => {
    const parent = makeIssue({ key: 'PROJ-1', statusCategoryKey: 'new', statusName: 'To Do' });
    expect(subtreeBand(parent, [], FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(4);
  });

  it('all subtasks done, parent in-progress → returns 3', () => {
    const parent = makeIssue({
      key: 'PROJ-1',
      statusCategoryKey: 'indeterminate',
      statusName: 'In Progress',
    });
    const doneSubtask = makeIssue({
      key: 'PROJ-2',
      statusCategoryKey: 'done',
      statusName: 'Done',
      isSubtask: true,
    });
    expect(subtreeBand(parent, [doneSubtask], FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(
      3,
    );
  });
});

// --- groupByMyDay ---

describe('groupByMyDay', () => {
  it('groups a single to-do parent into the to-do band', () => {
    const parent = makeIssue({ key: 'PROJ-1', statusCategoryKey: 'new', statusName: 'To Do' });
    const myIssueKeys = new Set(['PROJ-1']);

    const groups = groupByMyDay(
      [parent],
      myIssueKeys,
      FLAGGED_FIELD_KEY,
      EMPTY_MR_KEYS,
      FIXED_TODAY,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].band).toBe('to-do');
    expect(groups[0].parents).toHaveLength(1);
    expect(groups[0].parents[0].parent.key).toBe('PROJ-1');
  });

  it('sorts overdue parent before to-do parent', () => {
    const todoPar = makeIssue({ key: 'PROJ-1', statusCategoryKey: 'new', statusName: 'To Do' });
    const overduePar = makeIssue({
      key: 'PROJ-2',
      statusCategoryKey: 'new',
      duedate: '2026-06-13',
    });
    const myIssueKeys = new Set(['PROJ-1', 'PROJ-2']);

    const groups = groupByMyDay(
      [todoPar, overduePar],
      myIssueKeys,
      FLAGGED_FIELD_KEY,
      EMPTY_MR_KEYS,
      FIXED_TODAY,
    );
    expect(groups[0].band).toBe('overdue');
    expect(groups[1].band).toBe('to-do');
  });

  it('floats parent to overdue band because of overdue subtask (D-04)', () => {
    const parent = makeIssue({ key: 'PROJ-1', statusCategoryKey: 'new', statusName: 'To Do' });
    const overdueSubtask = makeIssue({
      key: 'PROJ-2',
      statusCategoryKey: 'new',
      duedate: '2026-06-13',
      isSubtask: true,
      parentKey: 'PROJ-1',
    });
    const myIssueKeys = new Set(['PROJ-1']);

    const groups = groupByMyDay(
      [parent, overdueSubtask],
      myIssueKeys,
      FLAGGED_FIELD_KEY,
      EMPTY_MR_KEYS,
      FIXED_TODAY,
    );
    // Parent should be in overdue band, not to-do
    expect(groups).toHaveLength(1);
    expect(groups[0].band).toBe('overdue');
  });

  it('excludes parents not in myIssueKeys and without my subtasks', () => {
    const parent = makeIssue({ key: 'PROJ-99', statusCategoryKey: 'new' });
    const myIssueKeys = new Set<string>(); // empty — I own nothing

    const groups = groupByMyDay(
      [parent],
      myIssueKeys,
      FLAGGED_FIELD_KEY,
      EMPTY_MR_KEYS,
      FIXED_TODAY,
    );
    expect(groups).toHaveLength(0);
  });

  it('includes parent when I own a subtask (not the parent itself)', () => {
    const parent = makeIssue({ key: 'PROJ-1', statusCategoryKey: 'new' });
    const mySubtask = makeIssue({
      key: 'PROJ-2',
      statusCategoryKey: 'indeterminate',
      statusName: 'In Progress',
      isSubtask: true,
      parentKey: 'PROJ-1',
    });
    const myIssueKeys = new Set(['PROJ-2']); // only the subtask is mine

    const groups = groupByMyDay(
      [parent, mySubtask],
      myIssueKeys,
      FLAGGED_FIELD_KEY,
      EMPTY_MR_KEYS,
      FIXED_TODAY,
    );
    expect(groups).toHaveLength(1);
  });

  it('merges consecutive same-band parents into one group', () => {
    const p1 = makeIssue({ key: 'PROJ-1', statusCategoryKey: 'new', statusName: 'To Do' });
    const p2 = makeIssue({ key: 'PROJ-2', statusCategoryKey: 'new', statusName: 'To Do' });
    const myIssueKeys = new Set(['PROJ-1', 'PROJ-2']);

    const groups = groupByMyDay(
      [p1, p2],
      myIssueKeys,
      FLAGGED_FIELD_KEY,
      EMPTY_MR_KEYS,
      FIXED_TODAY,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].band).toBe('to-do');
    expect(groups[0].parents).toHaveLength(2);
  });
});
