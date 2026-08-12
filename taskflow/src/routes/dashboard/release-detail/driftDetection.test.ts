import { describe, expect, it } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import {
  buildDriftRows,
  buildTaskMrAttachment,
  classifyMrState,
  countBrMsFlaggedMRs,
  type DriftRow,
  evaluateBranchDrift,
  evaluateMilestoneDrift,
  evaluateTaskDrift,
  extractMrTaskKeys,
  selectChannelA,
  unionMRs,
} from './driftDetection';

function makeMR(overrides: Partial<GitLabMR> = {}): GitLabMR {
  return {
    id: 1,
    iid: 1,
    project_id: 1,
    title: 'Fix thing',
    source_branch: 'fix-thing',
    target_branch: 'develop',
    state: 'opened',
    draft: false,
    author: { id: 1, name: 'A', username: 'a', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-01-01T00:00:00Z',
    web_url: 'https://gitlab.example.com/mr/1',
    labels: [],
    milestone: null,
    ...overrides,
  } as unknown as GitLabMR;
}

function makeIssue(
  overrides: { key?: string; statusCategoryKey?: string | undefined } = {},
): JiraIssue {
  return {
    id: '1',
    key: overrides.key ?? 'PROJ-1',
    fields: {
      summary: 'Something',
      status: {
        id: '1',
        name: 'Status',
        ...(overrides.statusCategoryKey !== undefined
          ? { statusCategory: { key: overrides.statusCategoryKey } }
          : {}),
      },
      assignee: null,
      customfield_10016: null,
      issuetype: { name: 'Story', subtask: false },
    },
  } as unknown as JiraIssue;
}

describe('unionMRs', () => {
  it('unions three arrays keyed by id, sharing channels for an MR present in all three', () => {
    const a2 = makeMR({ id: 2, iid: 2 });
    const a1 = makeMR({ id: 1, iid: 1 });
    const b1 = makeMR({ id: 3, iid: 3 });
    const union = unionMRs([a1, a2], [a2, b1], [a2]);
    expect(union.size).toBe(3);
    const entry = union.get(2);
    expect(entry).toBeDefined();
    expect(entry?.channels).toEqual(new Set(['A', 'B', 'C']));
  });

  it('keys by mr.id, not mr.iid — same iid, different id produce two entries', () => {
    const mrX = makeMR({ id: 10, iid: 99 });
    const mrY = makeMR({ id: 20, iid: 99 });
    const union = unionMRs([mrX], [mrY], []);
    expect(union.size).toBe(2);
  });

  it('preserves the FIRST-seen mr object for a duplicate id (Channel A wins) and does not mutate inputs', () => {
    const first = makeMR({ id: 5, title: 'Channel A title' });
    const second = makeMR({ id: 5, title: 'Channel B title' });
    const channelA = [first];
    const channelB = [second];
    const union = unionMRs(channelA, channelB, []);
    expect(union.get(5)?.mr).toBe(first);
    expect(channelA).toEqual([first]);
    expect(channelB).toEqual([second]);
  });

  it('returns an empty Map for three empty arrays', () => {
    const union = unionMRs([], [], []);
    expect(union.size).toBe(0);
  });
});

describe('Channel A', () => {
  it('selectChannelA returns only MRs for which linkMRToTask is non-null, including branch-only matches', () => {
    const titleMatch = makeMR({ id: 1, title: 'PROJ-1 fix thing', source_branch: 'random' });
    const branchOnlyMatch = makeMR({
      id: 2,
      title: 'Fix thing',
      source_branch: 'feature/PROJ-2-thing',
    });
    const noMatch = makeMR({ id: 3, title: 'Unrelated', source_branch: 'unrelated' });
    const keySet = new Set(['PROJ-1', 'PROJ-2']);
    const result = selectChannelA([titleMatch, branchOnlyMatch, noMatch], keySet);
    expect(result).toEqual([titleMatch, branchOnlyMatch]);
  });

  it('returns an empty array for an empty key set', () => {
    const mr = makeMR({ id: 1, title: 'PROJ-1 fix thing' });
    expect(selectChannelA([mr], new Set())).toEqual([]);
  });
});

describe('evaluateBranchDrift', () => {
  it('returns false when target_branch matches the release branch', () => {
    const mr = makeMR({ target_branch: 'release/33.5.0' });
    expect(evaluateBranchDrift(mr, 'release/33.5.0')).toBe(false);
  });

  it('returns true when target_branch does not match the release branch', () => {
    const mr = makeMR({ target_branch: 'develop' });
    expect(evaluateBranchDrift(mr, 'release/33.5.0')).toBe(true);
  });

  it('returns false (D-18 degraded state) when releaseBranchName is null', () => {
    const mr = makeMR({ target_branch: 'develop' });
    expect(evaluateBranchDrift(mr, null)).toBe(false);
  });
});

describe('evaluateMilestoneDrift', () => {
  it('returns true when milestone is null', () => {
    const mr = makeMR({ milestone: null });
    expect(evaluateMilestoneDrift(mr, 7)).toBe(true);
  });

  it('returns true when milestone.id mismatches', () => {
    const mr = makeMR({ milestone: { id: 9, title: 'v9' } });
    expect(evaluateMilestoneDrift(mr, 7)).toBe(true);
  });

  it('returns false when milestone.id matches', () => {
    const mr = makeMR({ milestone: { id: 7, title: 'v7' } });
    expect(evaluateMilestoneDrift(mr, 7)).toBe(false);
  });

  it('returns false (D-18 degraded state) when matchedMilestoneId is null', () => {
    const mr = makeMR({ milestone: null });
    expect(evaluateMilestoneDrift(mr, null)).toBe(false);
  });

  it('reads no milestone field other than id (Pitfall 1)', () => {
    const mr = makeMR({ milestone: { id: 7, title: 'v7' } });
    // TypeScript itself enforces this — GitLabMR['milestone'] has no due_date.
    // This test documents the contract for a future refactor.
    expect(mr.milestone).toEqual({ id: 7, title: 'v7' });
  });
});

describe('extractMrTaskKeys', () => {
  it('dedupes a key that appears in both title and source_branch (IN-01)', () => {
    const mr = makeMR({ title: 'PROJ-1 fix', source_branch: 'feature/PROJ-1' });
    expect(extractMrTaskKeys(mr)).toEqual(['PROJ-1']);
  });

  it('keeps a distinct title key and a distinct branch key, title key first', () => {
    const mr = makeMR({ title: 'PROJ-1 fix', source_branch: 'feature/PROJ-2' });
    expect(extractMrTaskKeys(mr)).toEqual(['PROJ-1', 'PROJ-2']);
  });

  it('buildDriftRows output carries deduplicated taskKeys for such an MR', () => {
    const mr = makeMR({ id: 1, title: 'PROJ-1 fix', source_branch: 'feature/PROJ-1' });
    const rows = buildDriftRows({
      channelA: [mr],
      channelB: [],
      channelC: [],
      releaseBranchName: null,
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(['PROJ-1']),
    });
    expect(rows[0].taskKeys).toHaveLength(1);
  });
});

describe('evaluateTaskDrift', () => {
  it("returns 'no-linked-task' when neither title nor source_branch yields a key (D-11)", () => {
    const mr = makeMR({ title: 'Unrelated change', source_branch: 'chore/bump-deps' });
    expect(evaluateTaskDrift(mr, new Set(['PROJ-1']))).toBe('no-linked-task');
  });

  it("returns 'not-in-fix-version' when keys are extractable but none is in the set", () => {
    const mr = makeMR({ title: 'PROJ-9 fix thing' });
    expect(evaluateTaskDrift(mr, new Set(['PROJ-1']))).toBe('not-in-fix-version');
  });

  it('returns null when ANY extracted key is in the set, including a branch-only key', () => {
    const mr = makeMR({ title: 'Unrelated title', source_branch: 'feature/PROJ-1-thing' });
    expect(evaluateTaskDrift(mr, new Set(['PROJ-1']))).toBe(null);
  });

  it('checks all extracted keys, not just the first (contrast with linkMRToTask)', () => {
    const mr = makeMR({ title: 'PROJ-9 and PROJ-1 both referenced', source_branch: 'chore/x' });
    expect(evaluateTaskDrift(mr, new Set(['PROJ-1']))).toBe(null);
  });
});

describe('state classification', () => {
  it("classifyMrState returns true for state: 'opened' regardless of draft", () => {
    expect(classifyMrState(makeMR({ state: 'opened', draft: false }))).toBe(true);
    expect(classifyMrState(makeMR({ state: 'opened', draft: true }))).toBe(true);
  });

  it("classifyMrState returns false for 'merged', 'closed' and 'locked'", () => {
    expect(classifyMrState(makeMR({ state: 'merged' }))).toBe(false);
    expect(classifyMrState(makeMR({ state: 'closed' }))).toBe(false);
    expect(classifyMrState(makeMR({ state: 'locked' }))).toBe(false);
  });

  it('D-10: a draft MR with a mismatched target branch is evaluated and flagged, not muted', () => {
    const draftMr = makeMR({
      id: 1,
      state: 'opened',
      draft: true,
      target_branch: 'develop',
    });
    const rows = buildDriftRows({
      channelA: [],
      channelB: [],
      channelC: [draftMr],
      releaseBranchName: 'release/33.5.0',
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].evaluated).toBe(true);
    expect(rows[0].br).toBe('flag');
    expect(rows[0].flagged).toBe(true);
  });
});

describe('buildDriftRows', () => {
  it('a merged MR yields br/ms/task all na, flagged false, and calls no predicate', () => {
    const merged = makeMR({ id: 1, state: 'merged', target_branch: 'develop', milestone: null });
    const rows = buildDriftRows({
      channelA: [merged],
      channelB: [],
      channelC: [],
      releaseBranchName: 'release/33.5.0',
      matchedMilestoneId: 7,
      fixVersionIssueKeys: new Set(),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].evaluated).toBe(false);
    expect(rows[0].br).toBe('na');
    expect(rows[0].ms).toBe('na');
    expect(rows[0].task).toBe('na');
    expect(rows[0].flagged).toBe(false);
  });

  it('with releaseBranchName null, every row gets br: na (D-18) while TASK still evaluates', () => {
    const mr = makeMR({
      id: 1,
      state: 'opened',
      title: 'Unrelated',
      source_branch: 'chore/x',
    });
    const rows = buildDriftRows({
      channelA: [mr],
      channelB: [],
      channelC: [],
      releaseBranchName: null,
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(),
    });
    expect(rows[0].br).toBe('na');
    expect(rows[0].task).toBe('flag');
  });

  it('with matchedMilestoneId null, every row gets ms: na', () => {
    const mr = makeMR({ id: 1, state: 'opened', milestone: null });
    const rows = buildDriftRows({
      channelA: [mr],
      channelB: [],
      channelC: [],
      releaseBranchName: null,
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(),
    });
    expect(rows[0].ms).toBe('na');
  });

  it('sorts flagged-first, then by mr.iid descending, order-independent of input order', () => {
    const clean1 = makeMR({
      id: 1,
      iid: 5,
      state: 'opened',
      target_branch: 'release/33.5.0',
      title: 'PROJ-1',
      source_branch: 'x',
    });
    const clean2 = makeMR({
      id: 2,
      iid: 3,
      state: 'opened',
      target_branch: 'release/33.5.0',
      title: 'PROJ-1',
      source_branch: 'x',
    });
    const flagged1 = makeMR({
      id: 3,
      iid: 10,
      state: 'opened',
      target_branch: 'develop',
      title: 'PROJ-1',
      source_branch: 'x',
    });
    const flagged2 = makeMR({
      id: 4,
      iid: 8,
      state: 'opened',
      target_branch: 'develop',
      title: 'PROJ-1',
      source_branch: 'x',
    });
    const keySet = new Set(['PROJ-1']);

    const build = (mrs: GitLabMR[]) =>
      buildDriftRows({
        channelA: mrs,
        channelB: [],
        channelC: [],
        releaseBranchName: 'release/33.5.0',
        matchedMilestoneId: null,
        fixVersionIssueKeys: keySet,
      });

    const order1 = build([clean1, flagged1, clean2, flagged2]);
    const order2 = build([flagged2, clean2, flagged1, clean1]);

    const iidSeq1 = order1.map((r) => r.mr.iid);
    const iidSeq2 = order2.map((r) => r.mr.iid);
    expect(iidSeq1).toEqual([10, 8, 5, 3]);
    expect(iidSeq2).toEqual(iidSeq1);
  });
});

describe('buildTaskMrAttachment', () => {
  it('D-09: one MR whose key is a release issue attaches under that task; secondaryRows is empty', () => {
    const issue = makeIssue({ key: 'PROJ-1' });
    const mr = makeMR({ id: 1, iid: 1, title: 'PROJ-1 fix', source_branch: 'x' });
    const rows = buildDriftRows({
      channelA: [mr],
      channelB: [],
      channelC: [],
      releaseBranchName: null,
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(['PROJ-1']),
    });
    const { primaryRows, secondaryRows } = buildTaskMrAttachment([issue], rows);
    expect(primaryRows).toHaveLength(1);
    expect(primaryRows[0].mrs).toHaveLength(1);
    expect(primaryRows[0].mrs[0].mr.id).toBe(1);
    expect(secondaryRows).toEqual([]);
  });

  it('a task with no matching MR still appears in primaryRows with an empty mrs array', () => {
    const issue = makeIssue({ key: 'PROJ-2' });
    const { primaryRows } = buildTaskMrAttachment([issue], []);
    expect(primaryRows).toHaveLength(1);
    expect(primaryRows[0].issue).toBe(issue);
    expect(primaryRows[0].mrs).toEqual([]);
  });

  it('D-09: an MR carrying two keys that are BOTH release issues appears under both tasks', () => {
    const issue1 = makeIssue({ key: 'PROJ-1' });
    const issue2 = makeIssue({ key: 'PROJ-2' });
    const mr = makeMR({
      id: 1,
      iid: 1,
      title: 'PROJ-1 and PROJ-2 both referenced',
      source_branch: 'x',
    });
    const rows = buildDriftRows({
      channelA: [mr],
      channelB: [],
      channelC: [],
      releaseBranchName: null,
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(['PROJ-1', 'PROJ-2']),
    });
    const { primaryRows } = buildTaskMrAttachment([issue1, issue2], rows);
    expect(primaryRows[0].mrs.map((r) => r.mr.id)).toEqual([1]);
    expect(primaryRows[1].mrs.map((r) => r.mr.id)).toEqual([1]);
  });

  it('a keyless MR lands in secondaryRows with an empty taskKeys array', () => {
    const mr = makeMR({ id: 1, title: 'Unrelated change', source_branch: 'chore/bump-deps' });
    const rows = buildDriftRows({
      channelA: [mr],
      channelB: [],
      channelC: [],
      releaseBranchName: null,
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(),
    });
    const { primaryRows, secondaryRows } = buildTaskMrAttachment([], rows);
    expect(primaryRows).toEqual([]);
    expect(secondaryRows).toHaveLength(1);
    expect(secondaryRows[0].taskKeys).toEqual([]);
  });

  it('an MR whose only key is not in the fix version lands in secondaryRows carrying that key', () => {
    const issue = makeIssue({ key: 'PROJ-1' });
    const mr = makeMR({ id: 1, title: 'PROJ-9 fix thing', source_branch: 'x' });
    const rows = buildDriftRows({
      channelA: [mr],
      channelB: [],
      channelC: [],
      releaseBranchName: null,
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(['PROJ-1']),
    });
    const { primaryRows, secondaryRows } = buildTaskMrAttachment([issue], rows);
    expect(primaryRows[0].mrs).toEqual([]);
    expect(secondaryRows).toHaveLength(1);
    expect(secondaryRows[0].taskKeys[0]).toBe('PROJ-9');
  });

  it('regression guard: a merged (non-evaluated, taskReason null) MR with an out-of-scope key lands in secondaryRows, not nowhere', () => {
    const issue = makeIssue({ key: 'PROJ-1' });
    const mergedMr = makeMR({
      id: 1,
      state: 'merged',
      title: 'PROJ-9 fix thing',
      source_branch: 'x',
    });
    const rows = buildDriftRows({
      channelA: [mergedMr],
      channelB: [],
      channelC: [],
      releaseBranchName: null,
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(['PROJ-1']),
    });
    expect(rows[0].taskReason).toBe(null);
    expect(rows[0].evaluated).toBe(false);
    const { primaryRows, secondaryRows } = buildTaskMrAttachment([issue], rows);
    expect(primaryRows[0].mrs).toEqual([]);
    expect(secondaryRows).toHaveLength(1);
    expect(secondaryRows[0].mr.id).toBe(1);
  });

  it('partition invariant: every input mr.id appears under a task or in secondaryRows, and the two sets are disjoint', () => {
    const issue1 = makeIssue({ key: 'PROJ-1' });
    const issue2 = makeIssue({ key: 'PROJ-2' });
    const mrBoth = makeMR({ id: 1, title: 'PROJ-1 and PROJ-2', source_branch: 'x' });
    const mrOne = makeMR({ id: 2, title: 'PROJ-1 only', source_branch: 'x' });
    const mrKeyless = makeMR({ id: 3, title: 'Unrelated', source_branch: 'chore/x' });
    const mrOutOfScope = makeMR({ id: 4, title: 'PROJ-9 out of scope', source_branch: 'x' });
    const rows = buildDriftRows({
      channelA: [mrBoth, mrOne, mrKeyless, mrOutOfScope],
      channelB: [],
      channelC: [],
      releaseBranchName: null,
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(['PROJ-1', 'PROJ-2']),
    });
    const { primaryRows, secondaryRows } = buildTaskMrAttachment([issue1, issue2], rows);

    const primaryIds = new Set(primaryRows.flatMap((p) => p.mrs.map((r) => r.mr.id)));
    const secondaryIds = new Set(secondaryRows.map((r) => r.mr.id));
    const inputIds = new Set(rows.map((r) => r.mr.id));

    expect(new Set([...primaryIds, ...secondaryIds])).toEqual(inputIds);
    expect([...primaryIds].some((id) => secondaryIds.has(id))).toBe(false);
  });

  it('D-18: primaryRows order equals the input releaseIssues order; each mrs array is ascending by mr.iid regardless of flag state', () => {
    const issue2 = makeIssue({ key: 'PROJ-2' });
    const issue1 = makeIssue({ key: 'PROJ-1' });
    const mrHigh = makeMR({
      id: 1,
      iid: 5,
      title: 'PROJ-1 fix',
      source_branch: 'x',
      target_branch: 'develop',
    });
    const mrLow = makeMR({
      id: 2,
      iid: 2,
      title: 'PROJ-1 fix',
      source_branch: 'x',
      target_branch: 'release/1',
    });
    const rows = buildDriftRows({
      channelA: [mrHigh, mrLow],
      channelB: [],
      channelC: [],
      releaseBranchName: 'release/1',
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(['PROJ-1']),
    });
    // one of these two is flagged (mismatched target branch) and one is not — order must still be by iid.
    const { primaryRows } = buildTaskMrAttachment([issue2, issue1], rows);
    expect(primaryRows[0].issue).toBe(issue2);
    expect(primaryRows[1].issue).toBe(issue1);
    expect(primaryRows[1].mrs.map((r) => r.mr.iid)).toEqual([2, 5]);
  });

  it('does not mutate the input driftRows array (order preserved after the call)', () => {
    const mrA = makeMR({ id: 1, iid: 3, title: 'PROJ-1', source_branch: 'x' });
    const mrB = makeMR({ id: 2, iid: 1, title: 'PROJ-1', source_branch: 'x' });
    const rows = buildDriftRows({
      channelA: [mrA, mrB],
      channelB: [],
      channelC: [],
      releaseBranchName: null,
      matchedMilestoneId: null,
      fixVersionIssueKeys: new Set(['PROJ-1']),
    });
    const idsBefore = rows.map((r) => r.mr.id);
    buildTaskMrAttachment([makeIssue({ key: 'PROJ-1' })], rows);
    expect(rows.map((r) => r.mr.id)).toEqual(idsBefore);
  });
});

describe('countBrMsFlaggedMRs', () => {
  function makeRow(overrides: Partial<DriftRow> = {}): DriftRow {
    return {
      mr: makeMR(),
      channels: new Set(['A']),
      evaluated: true,
      br: 'ok',
      ms: 'ok',
      task: 'ok',
      taskReason: null,
      taskKeys: [],
      flagged: false,
      ...overrides,
    };
  }

  it('D-15: a row flagged only on task contributes 0', () => {
    const row = makeRow({ task: 'flag', flagged: true });
    expect(countBrMsFlaggedMRs([row])).toBe(0);
  });

  it('D-15: a row flagged on both br and ms contributes 1, not 2', () => {
    const row = makeRow({ br: 'flag', ms: 'flag', flagged: true });
    expect(countBrMsFlaggedMRs([row])).toBe(1);
  });

  it("D-15: a row with br: 'na', ms: 'na' (non-evaluated) contributes 0", () => {
    const row = makeRow({ evaluated: false, br: 'na', ms: 'na', task: 'na', flagged: false });
    expect(countBrMsFlaggedMRs([row])).toBe(0);
  });

  it('D-15: a mixed list returns the BR-or-MS total, strictly less than the naive row.flagged count when a task-only flag is present', () => {
    const taskOnly = makeRow({ task: 'flag', flagged: true });
    const brFlagged = makeRow({ mr: makeMR({ id: 2 }), br: 'flag', flagged: true });
    const msFlagged = makeRow({ mr: makeMR({ id: 3 }), ms: 'flag', flagged: true });
    const rows = [taskOnly, brFlagged, msFlagged];
    const naiveFlaggedCount = rows.filter((r) => r.flagged).length;
    expect(countBrMsFlaggedMRs(rows)).toBe(2);
    expect(naiveFlaggedCount).toBe(3);
    expect(countBrMsFlaggedMRs(rows)).toBeLessThan(naiveFlaggedCount);
  });
});
