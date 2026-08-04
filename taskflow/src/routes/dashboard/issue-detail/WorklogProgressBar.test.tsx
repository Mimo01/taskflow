import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { JiraIssueDetail } from '@/services/jira';
import { WorklogProgressBar } from './WorklogProgressBar';

function makeIssue(overrides: {
  issuetypeName?: string;
  isSubtask?: boolean;
  timeSpentSeconds?: number;
  originalEstimateSeconds?: number;
}): JiraIssueDetail {
  return {
    id: '1',
    key: 'ABC-1',
    fields: {
      issuetype: {
        name: overrides.issuetypeName ?? 'Story',
        subtask: overrides.isSubtask ?? false,
      },
      timetracking:
        overrides.timeSpentSeconds != null || overrides.originalEstimateSeconds != null
          ? {
              timeSpentSeconds: overrides.timeSpentSeconds,
              originalEstimateSeconds: overrides.originalEstimateSeconds,
            }
          : undefined,
    },
  } as unknown as JiraIssueDetail;
}

describe('WorklogProgressBar', () => {
  it('renders nothing when the issue type is Epic', () => {
    const issue = makeIssue({
      issuetypeName: 'Epic',
      timeSpentSeconds: 100,
      originalEstimateSeconds: 200,
    });
    const { container } = render(<WorklogProgressBar issue={issue} subtasks={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when estimate is 0 or missing', () => {
    const issue = makeIssue({ timeSpentSeconds: 100 });
    const { container } = render(<WorklogProgressBar issue={issue} subtasks={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a bar for a subtask using only its own numbers', () => {
    const issue = makeIssue({
      isSubtask: true,
      timeSpentSeconds: 3600,
      originalEstimateSeconds: 7200,
    });
    const subtasks = [
      {
        fields: { timetracking: { timeSpentSeconds: 999999, originalEstimateSeconds: 999999 } },
      },
    ];
    render(<WorklogProgressBar issue={issue} subtasks={subtasks} />);
    expect(screen.getByText('1h / 2h')).toBeTruthy();
  });

  it('renders a bar for a story aggregating own + subtask totals', () => {
    const issue = makeIssue({ timeSpentSeconds: 3600, originalEstimateSeconds: 7200 });
    const subtasks = [
      { fields: { timetracking: { timeSpentSeconds: 3600, originalEstimateSeconds: 3600 } } },
    ];
    render(<WorklogProgressBar issue={issue} subtasks={subtasks} />);
    expect(screen.getByText('2h / 3h')).toBeTruthy();
  });

  it('uses red indicator when spent >= estimate', () => {
    const issue = makeIssue({ timeSpentSeconds: 7200, originalEstimateSeconds: 7200 });
    const { container } = render(<WorklogProgressBar issue={issue} subtasks={undefined} />);
    expect(container.querySelector('.bg-red-500')).toBeTruthy();
  });

  it('uses amber indicator when fill >= 75%', () => {
    const issue = makeIssue({ timeSpentSeconds: 5400, originalEstimateSeconds: 7200 });
    const { container } = render(<WorklogProgressBar issue={issue} subtasks={undefined} />);
    expect(container.querySelector('.bg-amber-500')).toBeTruthy();
  });

  it('uses green indicator when fill < 75%', () => {
    const issue = makeIssue({ timeSpentSeconds: 1800, originalEstimateSeconds: 7200 });
    const { container } = render(<WorklogProgressBar issue={issue} subtasks={undefined} />);
    expect(container.querySelector('.bg-green-500')).toBeTruthy();
  });
});
