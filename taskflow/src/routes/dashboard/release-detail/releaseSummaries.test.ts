import { describe, expect, it } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import {
  computeHasStoryPoints,
  computeIssueStatusCounts,
  computeLabelCoverage,
  computeLabelSummary,
  computeMilestoneWindow,
  computeMrStateCounts,
  computeStoryPoints,
} from './releaseSummaries';

function makeMR(overrides: Partial<GitLabMR> = {}): GitLabMR {
  return {
    id: 1,
    iid: 1,
    project_id: 1,
    title: 'Fix thing',
    source_branch: 'fix-thing',
    state: 'opened',
    author: { id: 1, name: 'A', username: 'a', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-01-01T00:00:00Z',
    web_url: 'https://gitlab.example.com/mr/1',
    labels: [],
    milestone: null,
    ...overrides,
  } as unknown as GitLabMR;
}

function makeIssue(overrides: {
  key?: string;
  statusCategoryKey?: string | undefined;
  storyPoints?: number | null | undefined;
  storyPointsFieldKey?: string;
} = {}): JiraIssue {
  const fieldKey = overrides.storyPointsFieldKey ?? 'customfield_10016';
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
      [fieldKey]: overrides.storyPoints,
    },
  } as unknown as JiraIssue;
}

describe('computeLabelSummary', () => {
  it('returns [] for an empty MR list', () => {
    expect(computeLabelSummary([])).toEqual([]);
  });

  it('omits MRs whose labels array is empty from the result map', () => {
    const mrs = [
      makeMR({ labels: [] }),
      makeMR({ labels: [{ name: 'bug', color: '#f00', text_color: '#fff' }] }),
    ];
    const result = computeLabelSummary(mrs);
    expect(result).toHaveLength(1);
    expect(result[0].label.name).toBe('bug');
  });

  it('breaks equal counts alphabetically by label.name', () => {
    const zebra = { name: 'zebra', color: '#000', text_color: '#fff' };
    const alpha = { name: 'alpha', color: '#000', text_color: '#fff' };
    const mrs = [
      makeMR({ labels: [zebra] }),
      makeMR({ labels: [zebra] }),
      makeMR({ labels: [alpha] }),
      makeMR({ labels: [alpha] }),
    ];
    const result = computeLabelSummary(mrs);
    expect(result[0].label.name).toBe('alpha');
    expect(result[0].count).toBe(2);
    expect(result[1].label.name).toBe('zebra');
    expect(result[1].count).toBe(2);
  });
});

describe('computeLabelCoverage', () => {
  it('returns null (not an object with total: 0) for an empty MR list', () => {
    expect(computeLabelCoverage([])).toBeNull();
  });

  it('returns allLabeled: false and unlabeled.length === total when none carry labels', () => {
    const mrs = [makeMR({ labels: [] }), makeMR({ labels: [] })];
    const result = computeLabelCoverage(mrs);
    expect(result).not.toBeNull();
    expect(result?.allLabeled).toBe(false);
    expect(result?.unlabeled.length).toBe(result?.total);
  });
});

describe('computeMrStateCounts', () => {
  it('buckets merged -> merged, opened -> opened, and closed AND locked -> closed', () => {
    const mrs = [
      makeMR({ state: 'merged' }),
      makeMR({ state: 'opened' }),
      makeMR({ state: 'closed' }),
      makeMR({ state: 'locked' }),
    ];
    const result = computeMrStateCounts(mrs);
    expect(result).toEqual({ merged: 1, opened: 1, closed: 2 });
  });
});

describe('computeStoryPoints', () => {
  it('excludes issues whose SP field is null, undefined, or a non-number from total', () => {
    const issues = [
      makeIssue({ storyPoints: 3 }),
      makeIssue({ storyPoints: null }),
      makeIssue({ storyPoints: undefined }),
      makeIssue({ storyPoints: 'not-a-number' as unknown as number }),
    ];
    const result = computeStoryPoints(issues, 'customfield_10016');
    expect(result.total).toBe(3);
  });

  it('adds to completed only when statusCategory.key === done', () => {
    const issues = [
      makeIssue({ storyPoints: 5, statusCategoryKey: 'done' }),
      makeIssue({ storyPoints: 2, statusCategoryKey: 'indeterminate' }),
      makeIssue({ storyPoints: 1, statusCategoryKey: 'new' }),
    ];
    const result = computeStoryPoints(issues, 'customfield_10016');
    expect(result.total).toBe(8);
    expect(result.completed).toBe(5);
  });
});

describe('computeHasStoryPoints', () => {
  it('returns false when every issue SP is 0 (proves > 0, not !== null)', () => {
    const issues = [makeIssue({ storyPoints: 0 }), makeIssue({ storyPoints: 0 })];
    expect(computeHasStoryPoints(issues, 'customfield_10016')).toBe(false);
  });

  it('returns true when at least one issue has SP > 0', () => {
    const issues = [makeIssue({ storyPoints: 0 }), makeIssue({ storyPoints: 3 })];
    expect(computeHasStoryPoints(issues, 'customfield_10016')).toBe(true);
  });
});

describe('computeIssueStatusCounts', () => {
  it('counts an unknown statusCategory.key and a missing statusCategory in the new bucket', () => {
    const issues = [
      makeIssue({ statusCategoryKey: 'wat' }),
      makeIssue({ statusCategoryKey: undefined }),
      makeIssue({ statusCategoryKey: 'done' }),
    ];
    const result = computeIssueStatusCounts(issues);
    expect(result.new).toBe(2);
    expect(result.done).toBe(1);
    expect(result.indeterminate).toBe(0);
  });
});

describe('computeMilestoneWindow', () => {
  it('returns null for undefined and null releaseDate', () => {
    expect(computeMilestoneWindow(undefined)).toBeNull();
    expect(computeMilestoneWindow(null)).toBeNull();
  });

  it("rolls back across the month boundary for '2026-03-05'", () => {
    const result = computeMilestoneWindow('2026-03-05');
    expect(result).toEqual({ from: '2026-02-26', to: '2026-03-12' });
  });
});
