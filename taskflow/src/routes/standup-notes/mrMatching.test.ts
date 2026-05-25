/**
 * mrMatching — unit tests for matchMrsToStories pure helper.
 *
 * Covers:
 *   1. Reviewer MR matched by title key → nested under story
 *   2. Reviewer MR matched by source_branch key → nested under story
 *   3. MR matching a subtask key → nested under subtask's parent story
 *   4. MR with no matching key → in unmatchedReviewerMrs
 *   5. Participating MR matched by title → nested under story
 *   6. Participating MR matched by sourceBranch → nested under story
 *   7. Participating MR with no match → in unmatchedParticipatingMrs
 *   8. Dedupe: MR in both reviewer + participating sets → nested once with kind='review'
 *   9. Multiple MRs under the same story → all nested
 *  10. Empty inputs → empty result
 */

import { describe, expect, it } from 'vitest';
import type { GitLabMR, ParticipatedMR } from '@/services/gitlab';
import type { SprintRow } from './filterSprintItems';
import { matchMrsToStories } from './mrMatching';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function makeRow(
  storyKey: string,
  subtaskKeys: string[] = [],
): SprintRow {
  return {
    issue: {
      key: storyKey,
      id: storyKey,
      fields: {
        summary: `Summary of ${storyKey}`,
        status: { id: '1', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
        assignee: { displayName: 'Test User' },
        issuetype: { name: 'Story', subtask: false },
        subtasks: [],
        parent: undefined,
        timetracking: {},
      },
    } as unknown as SprintRow['issue'],
    subtasks: subtaskKeys.map((k) => ({
      key: k,
      id: k,
      fields: {
        summary: `Summary of ${k}`,
        status: { id: '2', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
        assignee: { displayName: 'Test User' },
        issuetype: { name: 'Sub-task', subtask: true },
        subtasks: [],
        parent: { key: storyKey },
        timetracking: {},
      },
    } as unknown as SprintRow['issue'])),
  };
}

function makeReviewerMR(iid: number, title: string, sourceBranch: string): GitLabMR {
  return {
    id: iid * 100,
    iid,
    project_id: 1,
    title,
    source_branch: sourceBranch,
    state: 'opened',
    author: { id: 99, name: 'Author', username: 'author', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-05-25T00:00:00Z',
    web_url: `https://gitlab.example.com/mr/${iid}`,
    labels: [],
    milestone: null,
  } as GitLabMR;
}

function makeParticipatingMR(
  mrIid: number,
  title: string,
  sourceBranch: string,
  overrides: Partial<ParticipatedMR> = {},
): ParticipatedMR {
  return {
    projectId: 1,
    mrIid,
    title,
    commentCount: 1,
    lastCommentedAt: '2026-05-25T00:00:00Z',
    authoredByMe: false,
    approvedByMe: false,
    openThreadCount: 0,
    sourceBranch,
    webUrl: `https://gitlab.example.com/mr/${mrIid}`,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('matchMrsToStories', () => {
  it('1. reviewer MR matched by title key → nested under story with kind=review', () => {
    const rows = [makeRow('PROJ-1')];
    const reviewerMrs = [makeReviewerMR(10, '[PROJ-1] Fix login', 'feature/unrelated')];

    const { mrsByStory, unmatchedReviewerMrs } = matchMrsToStories(rows, reviewerMrs, []);

    expect(mrsByStory.get('PROJ-1')).toHaveLength(1);
    expect(mrsByStory.get('PROJ-1')![0]).toMatchObject({ iid: 10, kind: 'review' });
    expect(unmatchedReviewerMrs).toHaveLength(0);
  });

  it('2. reviewer MR matched by source_branch key (title has no key) → nested under story', () => {
    const rows = [makeRow('PROJ-2')];
    const reviewerMrs = [makeReviewerMR(11, 'Fix login button', 'feature/PROJ-2-fix-button')];

    const { mrsByStory, unmatchedReviewerMrs } = matchMrsToStories(rows, reviewerMrs, []);

    expect(mrsByStory.get('PROJ-2')).toHaveLength(1);
    expect(mrsByStory.get('PROJ-2')![0].iid).toBe(11);
    expect(unmatchedReviewerMrs).toHaveLength(0);
  });

  it('3. MR matching a subtask key → nested under subtask parent story', () => {
    const rows = [makeRow('PROJ-3', ['PROJ-3-SUB-1'])];
    // Note: subtask keys won't be Jira-style but we test with a valid Jira key
    const rows2 = [makeRow('PROJ-10', ['PROJ-11'])];
    const reviewerMrs = [makeReviewerMR(20, '[PROJ-11] Implement subtask', 'feature/other')];

    const { mrsByStory, unmatchedReviewerMrs } = matchMrsToStories(rows2, reviewerMrs, []);

    // PROJ-11 is a subtask of PROJ-10, so the MR should be under PROJ-10
    expect(mrsByStory.get('PROJ-10')).toHaveLength(1);
    expect(mrsByStory.get('PROJ-10')![0].iid).toBe(20);
    expect(mrsByStory.has('PROJ-11')).toBe(false);
    expect(unmatchedReviewerMrs).toHaveLength(0);

    // suppress unused variable warning
    void rows;
  });

  it('4. reviewer MR with no matching key → in unmatchedReviewerMrs', () => {
    const rows = [makeRow('PROJ-5')];
    const reviewerMrs = [makeReviewerMR(30, 'Unrelated MR', 'feature/unrelated-branch')];

    const { mrsByStory, unmatchedReviewerMrs } = matchMrsToStories(rows, reviewerMrs, []);

    expect(mrsByStory.size).toBe(0);
    expect(unmatchedReviewerMrs).toHaveLength(1);
    expect(unmatchedReviewerMrs[0].iid).toBe(30);
  });

  it('5. participating MR matched by title → nested under story with kind=participating', () => {
    const rows = [makeRow('PROJ-6')];
    const participatingMrs = [
      makeParticipatingMR(40, '[PROJ-6] Add feature', 'feature/unrelated', { openThreadCount: 2 }),
    ];

    const { mrsByStory, unmatchedParticipatingMrs } = matchMrsToStories(rows, [], participatingMrs);

    expect(mrsByStory.get('PROJ-6')).toHaveLength(1);
    expect(mrsByStory.get('PROJ-6')![0]).toMatchObject({
      iid: 40,
      kind: 'participating',
      openThreadCount: 2,
    });
    expect(unmatchedParticipatingMrs).toHaveLength(0);
  });

  it('6. participating MR matched by sourceBranch (title has no key) → nested under story', () => {
    const rows = [makeRow('PROJ-7')];
    const participatingMrs = [
      makeParticipatingMR(50, 'Implement thing', 'feature/PROJ-7-implement'),
    ];

    const { mrsByStory, unmatchedParticipatingMrs } = matchMrsToStories(rows, [], participatingMrs);

    expect(mrsByStory.get('PROJ-7')).toHaveLength(1);
    expect(mrsByStory.get('PROJ-7')![0].iid).toBe(50);
    expect(unmatchedParticipatingMrs).toHaveLength(0);
  });

  it('7. participating MR with no matching key → in unmatchedParticipatingMrs', () => {
    const rows = [makeRow('PROJ-8')];
    const participatingMrs = [makeParticipatingMR(60, 'No key here', 'feature/no-key')];

    const { mrsByStory, unmatchedParticipatingMrs } = matchMrsToStories(rows, [], participatingMrs);

    expect(mrsByStory.size).toBe(0);
    expect(unmatchedParticipatingMrs).toHaveLength(1);
    expect(unmatchedParticipatingMrs[0].mrIid).toBe(60);
  });

  it('8. dedupe: MR in both reviewer + participating → nested once with kind=review', () => {
    const rows = [makeRow('PROJ-9')];
    const reviewerMrs = [makeReviewerMR(70, '[PROJ-9] Big feature', 'feature/PROJ-9')];
    // Same iid (70) in participating set
    const participatingMrs = [
      makeParticipatingMR(70, '[PROJ-9] Big feature', 'feature/PROJ-9', { openThreadCount: 1 }),
    ];

    const { mrsByStory, unmatchedReviewerMrs, unmatchedParticipatingMrs } = matchMrsToStories(
      rows,
      reviewerMrs,
      participatingMrs,
    );

    const nested = mrsByStory.get('PROJ-9');
    expect(nested).toHaveLength(1);
    expect(nested![0]).toMatchObject({ iid: 70, kind: 'review' });
    expect(unmatchedReviewerMrs).toHaveLength(0);
    // The participating duplicate is silently dropped (not in unmatched either)
    expect(unmatchedParticipatingMrs).toHaveLength(0);
  });

  it('9. multiple MRs matching the same story → all nested under that story', () => {
    const rows = [makeRow('PROJ-12')];
    const reviewerMrs = [
      makeReviewerMR(80, '[PROJ-12] Part 1', 'feature/other1'),
      makeReviewerMR(81, 'Another fix', 'feature/PROJ-12-part2'),
    ];

    const { mrsByStory } = matchMrsToStories(rows, reviewerMrs, []);

    const nested = mrsByStory.get('PROJ-12');
    expect(nested).toHaveLength(2);
    expect(nested!.map((m) => m.iid).sort()).toEqual([80, 81]);
  });

  it('10. empty inputs → empty result', () => {
    const { mrsByStory, unmatchedReviewerMrs, unmatchedParticipatingMrs } = matchMrsToStories(
      [],
      [],
      [],
    );

    expect(mrsByStory.size).toBe(0);
    expect(unmatchedReviewerMrs).toHaveLength(0);
    expect(unmatchedParticipatingMrs).toHaveLength(0);
  });
});
