import { describe, expect, it } from 'vitest';
import { timedIssue } from '@/components/jira/IssueTimeBar';
import { estimateOf, loggedOf } from '@/lib/epic-progress';
import type { JiraIssue } from '@/services/jira';
import { storyTimeParts } from './storyTimeParts';

const sub = (cat: string, est: number, logged: number) =>
  ({
    ...timedIssue({ key: 'S', statusCategoryKey: cat }),
    fields: {
      status: { statusCategory: { key: cat } },
      timetracking: {
        originalEstimateSeconds: est,
        timeSpentSeconds: logged,
        remainingEstimateSeconds: Math.max(est - logged, 0),
      },
    },
  }) as unknown as JiraIssue;

const fields = {
  status: { statusCategory: { key: 'indeterminate' } },
  aggregatetimeoriginalestimate: 10800,
  aggregatetimespent: 5400,
  aggregatetimeestimate: 5400,
};

describe('storyTimeParts', () => {
  it('is a single issue without subtasks', () => {
    expect(Array.isArray(storyTimeParts(fields, 'A-1', []))).toBe(false);
    expect(Array.isArray(storyTimeParts(fields, 'A-1', undefined))).toBe(false);
  });

  it('splits into story-itself + one part per subtask that add up to the aggregate', () => {
    const parts = storyTimeParts(fields, 'A-1', [sub('done', 3600, 3600), sub('new', 3600, 0)]);
    expect(Array.isArray(parts)).toBe(true);
    const list = parts as JiraIssue[];
    expect(list).toHaveLength(3);
    expect(list.reduce((n, i) => n + estimateOf(i), 0)).toBe(10800);
    expect(list.reduce((n, i) => n + loggedOf(i), 0)).toBe(5400);
  });
});
