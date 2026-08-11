import { describe, expect, it } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import {
  buildDriftRows,
  buildIssueMrIndex,
  classifyMrState,
  computeRowDriftCount,
  countFlaggedMRs,
  evaluateBranchDrift,
  evaluateMilestoneDrift,
  evaluateTaskDrift,
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

describe('countFlaggedMRs', () => {
  it('counts rows, not flags — one MR with all three columns flagged contributes 1', () => {
    const mr = makeMR({
      id: 1,
      state: 'opened',
      target_branch: 'develop',
      milestone: { id: 9, title: 'v9' },
      title: 'Unrelated',
      source_branch: 'chore/x',
    });
    const rows = buildDriftRows({
      channelA: [mr],
      channelB: [],
      channelC: [],
      releaseBranchName: 'release/33.5.0',
      matchedMilestoneId: 7,
      fixVersionIssueKeys: new Set(),
    });
    expect(rows[0].br).toBe('flag');
    expect(rows[0].ms).toBe('flag');
    expect(rows[0].task).toBe('flag');
    expect(countFlaggedMRs(rows)).toBe(1);
  });

  it('returns 0 for an empty row list', () => {
    expect(countFlaggedMRs([])).toBe(0);
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

describe('computeRowDriftCount', () => {
  it('counts only MRs relevant to this row (branch or milestone match) with branch/milestone drift, never TASK', () => {
    // Relevant via target branch match, but drifted on milestone (null vs 7).
    const relevantByBranch = makeMR({
      id: 1,
      state: 'opened',
      target_branch: 'release/33.5.0',
      milestone: null,
    });
    // Relevant via milestone match (id 7), but drifted on target branch.
    const relevantByMilestone = makeMR({
      id: 2,
      state: 'opened',
      target_branch: 'unrelated',
      milestone: { id: 7, title: 'v7' },
    });
    // Not relevant by either branch or milestone — excluded regardless of drift.
    const irrelevant = makeMR({
      id: 3,
      state: 'opened',
      target_branch: 'unrelated-branch',
      milestone: null,
    });
    const count = computeRowDriftCount(
      [relevantByBranch, relevantByMilestone, irrelevant],
      'release/33.5.0',
      7,
    );
    expect(count).toBe(2);
  });

  it('returns 0 when releaseBranchName and matchedMilestoneId are both null', () => {
    expect(computeRowDriftCount([makeMR({ id: 1 })], null, null)).toBe(0);
  });

  it('ignores MRs whose state is not opened', () => {
    const mergedMr = makeMR({
      id: 1,
      state: 'merged',
      target_branch: 'release/33.5.0',
      milestone: null,
    });
    const count = computeRowDriftCount([mergedMr], 'release/33.5.0', null);
    expect(count).toBe(0);
  });
});

describe('buildIssueMrIndex', () => {
  it('returns one matchedRows entry per fix-version issue, mr set when linked and milestone-qualified', () => {
    const issue = makeIssue({ key: 'PROJ-1' });
    const mr = makeMR({
      id: 1,
      title: 'PROJ-1 fix',
      source_branch: 'x',
      milestone: { id: 7, title: 'v7' },
    });
    const union = unionMRs([mr], [], []);
    const { matchedRows } = buildIssueMrIndex(union, [issue], 7);
    expect(matchedRows).toHaveLength(1);
    expect(matchedRows[0].mr).toBe(mr);
  });

  it('records wrongMilestoneByKey for issues with no qualifying MR but a wrong-milestone linked MR', () => {
    const issue = makeIssue({ key: 'PROJ-1' });
    const wrongMilestoneMr = makeMR({
      id: 1,
      title: 'PROJ-1 fix',
      source_branch: 'x',
      milestone: { id: 9, title: 'v9' },
    });
    const union = unionMRs([wrongMilestoneMr], [], []);
    const { matchedRows, wrongMilestoneByKey } = buildIssueMrIndex(union, [issue], 7);
    expect(matchedRows[0].mr).toBe(null);
    expect(wrongMilestoneByKey.get('PROJ-1')).toBe(wrongMilestoneMr);
  });

  it('with matchedMilestoneId null, every mr is null and wrongMilestoneByKey is empty', () => {
    const issue = makeIssue({ key: 'PROJ-1' });
    const mr = makeMR({ id: 1, title: 'PROJ-1 fix', source_branch: 'x', milestone: null });
    const union = unionMRs([mr], [], []);
    const { matchedRows, wrongMilestoneByKey } = buildIssueMrIndex(union, [issue], null);
    expect(matchedRows[0].mr).toBe(null);
    expect(wrongMilestoneByKey.size).toBe(0);
  });
});
