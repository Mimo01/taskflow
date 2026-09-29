import { describe, expect, it } from 'vitest';

import {
  MY_DAY_BANDS,
  MY_DAY_BAND_DISPLAY_ORDER,
  classifyBand,
  groupByMyDay,
  isForeignReviewWithMySubtask,
  subtreeBand,
} from './my-tasks-sort';
import type { JiraIssue } from '@/services/jira';

const FLAGGED_FIELD_KEY = 'customfield_10021';
const FIXED_TODAY = new Date('2026-06-14T12:00:00Z');
const EMPTY_MR_KEYS = new Set<string>();
const B = (id: (typeof MY_DAY_BANDS)[number]) => MY_DAY_BANDS.indexOf(id);

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
  it('is an array of 8 band labels in precedence order', () => {
    expect(MY_DAY_BANDS).toEqual([
      'flagged-blocked',
      'overdue',
      'in-review-my-mr',
      'in-review-my-subtasks',
      'testing',
      'in-progress',
      'to-do',
      'done',
    ]);
  });
});

// --- classifyBand ---

describe('classifyBand', () => {
  it('returns 6 (done) for issue with statusCategory.key === "done"', () => {
    const issue = makeIssue({ statusCategoryKey: 'done', statusName: 'Done' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(B('done'));
  });

  it('returns 0 (flagged-blocked) for a flagged issue', () => {
    const issue = makeIssue({
      statusCategoryKey: 'new',
      statusName: 'To Do',
      flaggedValue: [{ value: 'Impediment' }],
    });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(
      B('flagged-blocked'),
    );
  });

  it('returns 0 (flagged-blocked) for an issue with "blocked" in status name', () => {
    const issue = makeIssue({ statusCategoryKey: 'indeterminate', statusName: 'Blocked' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(
      B('flagged-blocked'),
    );
  });

  it('returns 1 (overdue) for a non-done issue with past duedate', () => {
    // duedate = 2026-06-13, today = 2026-06-14 → overdue
    const issue = makeIssue({ statusCategoryKey: 'new', duedate: '2026-06-13' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(B('overdue'));
  });

  it('returns 5 (to-do) for non-done issue with future duedate', () => {
    // duedate = 2026-06-20, today = 2026-06-14 → not overdue
    const issue = makeIssue({ statusCategoryKey: 'new', duedate: '2026-06-20' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(B('to-do'));
  });

  it('returns 2 (in-review-my-mr) when status includes "review" and issue has my open MR', () => {
    const issue = makeIssue({
      key: 'PROJ-10',
      statusCategoryKey: 'indeterminate',
      statusName: 'In Review',
    });
    const myMRKeys = new Set(['PROJ-10']);
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, myMRKeys, FIXED_TODAY)).toBe(
      B('in-review-my-mr'),
    );
  });

  it('returns 4 (in-progress) when status includes "review" but no my MR', () => {
    const issue = makeIssue({
      key: 'PROJ-10',
      statusCategoryKey: 'indeterminate',
      statusName: 'In Review',
    });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(
      B('in-progress'),
    );
  });

  it('returns 4 (in-progress) for indeterminate status not containing "review"', () => {
    const issue = makeIssue({ statusCategoryKey: 'indeterminate', statusName: 'In Progress' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(
      B('in-progress'),
    );
  });

  it('returns 5 (to-do) for statusCategory "new"', () => {
    const issue = makeIssue({ statusCategoryKey: 'new', statusName: 'To Do' });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(B('to-do'));
  });

  it('flagged takes priority over done (flagged always wins per D-04 must_haves)', () => {
    // A flagged parent sorts into band 0 regardless of status — plan must_haves truth
    const issue = makeIssue({
      statusCategoryKey: 'done',
      statusName: 'Done',
      flaggedValue: [{ value: 'Impediment' }],
    });
    expect(classifyBand(issue, FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(
      B('flagged-blocked'),
    );
  });
});

// --- subtreeBand (D-04 subtree evaluation) ---

describe('subtreeBand — D-04 subtree evaluation', () => {
  it('parent To Do (band 5) + overdue subtask (band 1) → returns 1 (overdue)', () => {
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
    ).toBe(B('overdue'));
  });

  it('parent Done (band 6) + In Progress subtask (band 4) → returns 4 (in-progress)', () => {
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
    ).toBe(B('in-progress'));
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
    ).toBe(B('flagged-blocked'));
  });

  it('no subtasks → returns parent band', () => {
    const parent = makeIssue({ key: 'PROJ-1', statusCategoryKey: 'new', statusName: 'To Do' });
    expect(subtreeBand(parent, [], FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(B('to-do'));
  });

  it('all subtasks done, parent in-progress → returns 4', () => {
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
      B('in-progress'),
    );
  });
});

// --- groupByMyDay ---

describe('groupByMyDay', () => {
  it('orders subtasks by parent fields.subtasks, unlisted last by numeric key, status ignored', () => {
    const parent = makeIssue({ key: 'PROJ-1', statusCategoryKey: 'new' });
    (parent.fields as unknown as { subtasks: Array<{ key: string }> }).subtasks = [
      { key: 'S-10' },
      { key: 'S-12' },
      { key: 'S-3' },
    ];
    const mk = (key: string, statusCategoryKey = 'new') =>
      makeIssue({ key, statusCategoryKey, isSubtask: true, parentKey: 'PROJ-1' });
    const groups = groupByMyDay(
      [parent, mk('S-12'), mk('S-3'), mk('S-2'), mk('S-10', 'done')],
      new Set(['PROJ-1']),
      FLAGGED_FIELD_KEY,
      EMPTY_MR_KEYS,
      FIXED_TODAY,
    );
    expect(groups[0].parents[0].subtasks.map((s) => s.key)).toEqual([
      'S-10',
      'S-12',
      'S-3',
      'S-2',
    ]);
  });

  it('keeps parent rank order within a band', () => {
    const p1 = makeIssue({ key: 'PROJ-9', statusCategoryKey: 'new' });
    const p2 = makeIssue({ key: 'PROJ-2', statusCategoryKey: 'new' });
    const groups = groupByMyDay(
      [p1, p2],
      new Set(['PROJ-9', 'PROJ-2']),
      FLAGGED_FIELD_KEY,
      EMPTY_MR_KEYS,
      FIXED_TODAY,
    );
    expect(groups[0].parents.map((p) => p.parent.key)).toEqual(['PROJ-9', 'PROJ-2']);
  });

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

// --- in-review-my-subtasks band ---

const foreignReview = (over: Parameters<typeof makeIssue>[0] = {}) =>
  makeIssue({
    key: 'PROJ-1',
    statusCategoryKey: 'indeterminate',
    statusName: 'In Review',
    ...over,
  });
const mySub = (over: Parameters<typeof makeIssue>[0] = {}) =>
  makeIssue({
    key: 'PROJ-2',
    statusCategoryKey: 'indeterminate',
    statusName: 'In Progress',
    isSubtask: true,
    parentKey: 'PROJ-1',
    ...over,
  });
const run = (issues: JiraIssue[], mine: string[], mrKeys: string[] = []) =>
  groupByMyDay(issues, new Set(mine), FLAGGED_FIELD_KEY, new Set(mrKeys), FIXED_TODAY);

describe('isForeignReviewWithMySubtask', () => {
  const mine = new Set(['PROJ-2']);
  it('true for foreign review parent with my subtask (case-insensitive)', () => {
    const p = foreignReview({ statusName: 'CODE REVIEW' });
    expect(isForeignReviewWithMySubtask(p, [mySub()], mine)).toBe(true);
  });
  it('false when parent is mine', () => {
    const keys = new Set(['PROJ-1', 'PROJ-2']);
    expect(isForeignReviewWithMySubtask(foreignReview(), [mySub()], keys)).toBe(false);
  });
  it('false when no subtask is mine', () => {
    expect(isForeignReviewWithMySubtask(foreignReview(), [mySub()], new Set())).toBe(false);
  });
  it('false when status lacks "review"', () => {
    const p = foreignReview({ statusName: 'In Progress' });
    expect(isForeignReviewWithMySubtask(p, [mySub()], mine)).toBe(false);
  });
  it('false when parent is itself a subtask', () => {
    const p = foreignReview({ isSubtask: true });
    expect(isForeignReviewWithMySubtask(p, [mySub()], mine)).toBe(false);
  });
});

describe('groupByMyDay — in-review-my-subtasks', () => {
  it.each([
    ['In Progress', 'indeterminate'],
    ['To Do', 'new'],
    ['Done', 'done'],
  ])('lifts foreign review parent when my subtask is %s', (statusName, statusCategoryKey) => {
    const groups = run([foreignReview(), mySub({ statusName, statusCategoryKey })], ['PROJ-2']);
    expect(groups).toHaveLength(1);
    expect(groups[0].band).toBe('in-review-my-subtasks');
  });

  it('own story in review without MR stays in-progress (D-05)', () => {
    expect(run([foreignReview()], ['PROJ-1'])[0].band).toBe('in-progress');
  });

  it('foreign non-review parent with my subtask stays in-progress', () => {
    const groups = run([foreignReview({ statusName: 'In Progress' }), mySub()], ['PROJ-2']);
    expect(groups[0].band).toBe('in-progress');
  });

  it('foreign review parent without my subtask is excluded', () => {
    expect(run([foreignReview(), mySub()], [])).toHaveLength(0);
  });

  it('overdue subtask wins', () => {
    const groups = run([foreignReview(), mySub({ duedate: '2026-06-13' })], ['PROJ-2']);
    expect(groups[0].band).toBe('overdue');
  });

  it('flagged subtask wins', () => {
    const groups = run(
      [foreignReview(), mySub({ flaggedValue: [{ value: 'Impediment' }] })],
      ['PROJ-2'],
    );
    expect(groups[0].band).toBe('flagged-blocked');
  });

  it('parent in my open MR keys wins', () => {
    const groups = run([foreignReview(), mySub()], ['PROJ-2'], ['PROJ-1']);
    expect(groups[0].band).toBe('in-review-my-mr');
  });

  it('flagged parent wins', () => {
    const groups = run(
      [foreignReview({ flaggedValue: [{ value: 'Impediment' }] }), mySub()],
      ['PROJ-2'],
    );
    expect(groups[0].band).toBe('flagged-blocked');
  });

  it('done "Reviewed" parent with my done subtask stays done', () => {
    const groups = run(
      [
        foreignReview({ statusName: 'Reviewed', statusCategoryKey: 'done' }),
        mySub({ statusName: 'Done', statusCategoryKey: 'done' }),
      ],
      ['PROJ-2'],
    );
    expect(groups[0].band).toBe('done');
  });

  it('emits in-progress, my-mr, my-subtasks in display order', () => {
    const mrParent = makeIssue({
      key: 'PROJ-10',
      statusCategoryKey: 'indeterminate',
      statusName: 'In Review',
    });
    const ipParent = makeIssue({
      key: 'PROJ-20',
      statusCategoryKey: 'indeterminate',
      statusName: 'In Progress',
    });
    const groups = run(
      [ipParent, foreignReview(), mySub(), mrParent],
      ['PROJ-2', 'PROJ-10', 'PROJ-20'],
      ['PROJ-10'],
    );
    expect(groups.map((g) => g.band)).toEqual([
      'in-progress',
      'in-review-my-mr',
      'in-review-my-subtasks',
    ]);
  });
});

// --- testing band ---

describe('classifyBand — testing', () => {
  const cls = (i: JiraIssue, mr = EMPTY_MR_KEYS) =>
    classifyBand(i, FLAGGED_FIELD_KEY, mr, FIXED_TODAY);

  it.each([
    ['Ready to test', 'indeterminate'],
    ['Testing', 'indeterminate'],
    ['TESTING', 'indeterminate'],
    ['Ready for Testing', 'new'],
  ])('"%s" (%s) is testing', (statusName, statusCategoryKey) => {
    expect(cls(makeIssue({ statusName, statusCategoryKey }))).toBe(B('testing'));
  });

  it('flagged testing issue is flagged-blocked', () => {
    const i = makeIssue({
      statusName: 'Testing',
      statusCategoryKey: 'indeterminate',
      flaggedValue: [{ value: 'Impediment' }],
    });
    expect(cls(i)).toBe(B('flagged-blocked'));
  });

  it('"Blocked in test" is flagged-blocked', () => {
    const i = makeIssue({ statusName: 'Blocked in test', statusCategoryKey: 'indeterminate' });
    expect(cls(i)).toBe(B('flagged-blocked'));
  });

  it('overdue testing issue is overdue', () => {
    const i = makeIssue({
      statusName: 'Testing',
      statusCategoryKey: 'indeterminate',
      duedate: '2026-06-13',
    });
    expect(cls(i)).toBe(B('overdue'));
  });

  it('done-category "Tested" is done', () => {
    expect(cls(makeIssue({ statusName: 'Tested', statusCategoryKey: 'done' }))).toBe(B('done'));
  });

  it('review with my MR is in-review-my-mr', () => {
    const i = makeIssue({
      key: 'PROJ-10',
      statusName: 'In Review',
      statusCategoryKey: 'indeterminate',
    });
    expect(cls(i, new Set(['PROJ-10']))).toBe(B('in-review-my-mr'));
  });

  it('review without MR is in-progress; indeterminate is in-progress; new is to-do', () => {
    expect(cls(makeIssue({ statusName: 'In Review', statusCategoryKey: 'indeterminate' }))).toBe(
      B('in-progress'),
    );
    expect(cls(makeIssue({ statusName: 'In Progress', statusCategoryKey: 'indeterminate' }))).toBe(
      B('in-progress'),
    );
    expect(cls(makeIssue({ statusName: 'To Do', statusCategoryKey: 'new' }))).toBe(B('to-do'));
  });

  it('subtreeBand: in-progress parent with testing subtask is testing', () => {
    const parent = makeIssue({
      key: 'PROJ-1',
      statusName: 'In Progress',
      statusCategoryKey: 'indeterminate',
    });
    const sub = makeIssue({
      key: 'PROJ-2',
      statusName: 'Testing',
      statusCategoryKey: 'indeterminate',
      isSubtask: true,
      parentKey: 'PROJ-1',
    });
    expect(subtreeBand(parent, [sub], FLAGGED_FIELD_KEY, EMPTY_MR_KEYS, FIXED_TODAY)).toBe(
      B('testing'),
    );
  });
});

describe('groupByMyDay — testing and display order', () => {
  it('foreign review parent with my subtask in Testing stays in-review-my-subtasks (fnq)', () => {
    const groups = run(
      [foreignReview(), mySub({ statusName: 'Testing', statusCategoryKey: 'indeterminate' })],
      ['PROJ-2'],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].band).toBe('in-review-my-subtasks');
  });

  it('renders all 8 bands in display order regardless of input order', () => {
    const mk = (
      key: string,
      statusName: string,
      statusCategoryKey: string,
      extra: Parameters<typeof makeIssue>[0] = {},
    ) => makeIssue({ key, statusName, statusCategoryKey, ...extra });
    const issues = [
      mk('A-1', 'Done', 'done'),
      mk('A-2', 'To Do', 'new'),
      mk('A-3', 'Testing', 'indeterminate'),
      mk('A-4', 'In Progress', 'indeterminate'),
      mk('A-5', 'In Review', 'indeterminate'),
      mk('A-6', 'To Do', 'new', { duedate: '2026-06-13' }),
      mk('A-7', 'To Do', 'new', { flaggedValue: [{ value: 'Impediment' }] }),
      mk('F-1', 'In Review', 'indeterminate'),
      mk('F-2', 'In Progress', 'indeterminate', { isSubtask: true, parentKey: 'F-1' }),
    ];
    const mine = ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'A-6', 'A-7', 'F-2'];
    const groups = run(issues, mine, ['A-5']);
    expect(groups.map((g) => g.band)).toEqual([...MY_DAY_BAND_DISPLAY_ORDER]);
  });

  it('non-adjacent same-band parents form ONE group in input order', () => {
    const t1 = makeIssue({ key: 'T-1', statusName: 'Testing', statusCategoryKey: 'indeterminate' });
    const d1 = makeIssue({ key: 'D-1', statusName: 'To Do', statusCategoryKey: 'new' });
    const t2 = makeIssue({ key: 'T-2', statusName: 'Testing', statusCategoryKey: 'indeterminate' });
    const groups = run([t1, d1, t2], ['T-1', 'D-1', 'T-2']);
    expect(groups.map((g) => g.band)).toEqual(['testing', 'to-do']);
    expect(groups[0].parents.map((p) => p.parent.key)).toEqual(['T-1', 'T-2']);
  });

  it('display order is a permutation of MY_DAY_BANDS', () => {
    expect([...MY_DAY_BAND_DISPLAY_ORDER].sort()).toEqual([...MY_DAY_BANDS].sort());
  });
});
