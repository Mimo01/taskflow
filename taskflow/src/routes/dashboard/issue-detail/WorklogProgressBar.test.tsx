import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { JiraIssueDetail } from '@/services/jira';
import { WorklogProgressBar } from './WorklogProgressBar';

function makeIssue(overrides: {
  issuetypeName?: string;
  isSubtask?: boolean;
  timeSpentSeconds?: number;
  originalEstimateSeconds?: number;
  statusCategoryKey?: string;
}): JiraIssueDetail {
  return {
    id: '1',
    key: 'ABC-1',
    fields: {
      issuetype: {
        name: overrides.issuetypeName ?? 'Story',
        subtask: overrides.isSubtask ?? false,
      },
      status: { statusCategory: { key: overrides.statusCategoryKey ?? 'indeterminate' } },
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

  it('renders nothing when there is no time at all', () => {
    const issue = makeIssue({});
    const { container } = render(<WorklogProgressBar issue={issue} subtasks={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('logged without an estimate: dashed track + "no estimate" caption', () => {
    const issue = makeIssue({ timeSpentSeconds: 7200 });
    const { container } = render(<WorklogProgressBar issue={issue} subtasks={undefined} />);
    expect(container.querySelector('[data-no-estimate="true"]')).toBeTruthy();
    expect(screen.getByText('2h · no estimate')).toBeTruthy();
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

  it('colours the part beyond the estimate red when spent > 125% of estimate', () => {
    const issue = makeIssue({ timeSpentSeconds: 10800, originalEstimateSeconds: 7200 });
    const { container } = render(<WorklogProgressBar issue={issue} subtasks={undefined} />);
    expect(container.querySelector('[data-segment$=":loggedOver"]')).toHaveClass('bg-red-500');
  });

  it('colours the part beyond the estimate amber when within 125%', () => {
    const issue = makeIssue({ timeSpentSeconds: 9000, originalEstimateSeconds: 7200 });
    const { container } = render(<WorklogProgressBar issue={issue} subtasks={undefined} />);
    expect(container.querySelector('[data-segment$=":loggedOver"]')).toHaveClass('bg-amber-500');
  });

  it('done issue spent 2h / original 4h is a solid done-coloured bar', () => {
    const issue = makeIssue({
      timeSpentSeconds: 7200,
      originalEstimateSeconds: 14400,
      statusCategoryKey: 'done',
    });
    const { container } = render(<WorklogProgressBar issue={issue} subtasks={undefined} />);
    expect(container.querySelector('[data-segment="done:logged"]')).toBeTruthy();
    expect(container.querySelector('[data-segment$=":remaining"]')).toBeNull();
  });

  it('under estimate and not done: logged plus faint remaining', () => {
    const issue = makeIssue({ timeSpentSeconds: 1800, originalEstimateSeconds: 7200 });
    const { container } = render(<WorklogProgressBar issue={issue} subtasks={undefined} />);
    expect(container.querySelector('[data-segment$=":remaining"]')).toBeTruthy();
  });
});
