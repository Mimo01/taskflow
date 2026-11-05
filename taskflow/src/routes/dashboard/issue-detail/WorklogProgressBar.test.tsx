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
    const { container } = render(<WorklogProgressBar issue={issue} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when estimate, logged and remaining are all 0 or missing', () => {
    const issue = makeIssue({});
    const { container } = render(<WorklogProgressBar issue={issue} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a full-width epic-style bar with a one-line caption', () => {
    const issue = makeIssue({ timeSpentSeconds: 3600, originalEstimateSeconds: 7200 });
    render(<WorklogProgressBar issue={issue} />);
    expect(screen.getByTestId('worklog-time-bar')).toHaveAttribute('aria-label', 'Logged 1h of 2h');
    expect(screen.getByText('1h / 2h')).toBeTruthy();
  });

  it('uses the issue aggregate fields (own + subtasks) when present', () => {
    const issue = makeIssue({ timeSpentSeconds: 1, originalEstimateSeconds: 1 });
    (issue.fields as unknown as Record<string, unknown>).aggregatetimespent = 7200;
    (issue.fields as unknown as Record<string, unknown>).aggregatetimeoriginalestimate = 10800;
    render(<WorklogProgressBar issue={issue} />);
    expect(screen.getByText('2h / 3h')).toBeTruthy();
  });

  it('flags overrun when logged exceeds the estimate', () => {
    const issue = makeIssue({ timeSpentSeconds: 10800, originalEstimateSeconds: 7200 });
    render(<WorklogProgressBar issue={issue} />);
    expect(screen.getByTestId('worklog-time-bar')).toHaveAttribute('data-overrun', 'true');
  });

  it('done issue measures logged against the original estimate with no overrun', () => {
    const issue = makeIssue({
      timeSpentSeconds: 7200,
      originalEstimateSeconds: 14400,
      statusCategoryKey: 'done',
    });
    render(<WorklogProgressBar issue={issue} />);
    expect(screen.getByTestId('worklog-time-bar')).not.toHaveAttribute('data-overrun');
    expect(screen.getByText('2h / 4h')).toBeTruthy();
  });
});
