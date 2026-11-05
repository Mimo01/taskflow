import { describe, expect, it } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import { accumulateTime } from './accumulate-time';

const issue = (t?: Record<string, number>) =>
  ({ key: 'X-1', fields: { timetracking: t } }) as unknown as JiraIssue;

describe('accumulateTime', () => {
  it('adds subtasks to the story', () => {
    const r = accumulateTime(
      issue({
        timeSpentSeconds: 600,
        originalEstimateSeconds: 3600,
        remainingEstimateSeconds: 3000,
      }),
      [
        issue({
          timeSpentSeconds: 300,
          originalEstimateSeconds: 1800,
          remainingEstimateSeconds: 1500,
        }),
        issue({ timeSpentSeconds: 100 }),
      ],
    );
    expect(r).toEqual({
      accumulatedSpentSeconds: 1000,
      accumulatedEstimateSeconds: 5400,
      accumulatedRemainingSeconds: 4500,
    });
  });
  it('leaves remaining undefined when nobody has one', () => {
    expect(accumulateTime(issue(), []).accumulatedRemainingSeconds).toBeUndefined();
  });
});
