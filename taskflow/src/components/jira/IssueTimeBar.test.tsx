import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { estimateOf, loggedOf, remainingOf } from '@/lib/epic-progress';
import { IssueTimeBar, timedIssue, timedIssueFromJiraFields } from './IssueTimeBar';

describe('timedIssue', () => {
  it('maps seconds onto the helper shape', () => {
    const i = timedIssue({
      statusCategoryKey: 'indeterminate',
      originalEstimate: 3600,
      logged: 1800,
      remaining: 1800,
    });
    expect(estimateOf(i)).toBe(3600);
    expect(loggedOf(i)).toBe(1800);
    expect(remainingOf(i)).toBe(1800);
  });

  it('falls back to estimate - logged when remaining is undefined', () => {
    const i = timedIssue({
      statusCategoryKey: 'indeterminate',
      originalEstimate: 3600,
      logged: 1000,
    });
    expect(i.fields).not.toHaveProperty('aggregatetimeestimate');
    expect(remainingOf(i)).toBe(2600);
  });

  it('done issues have zero remaining', () => {
    const i = timedIssue({ statusCategoryKey: 'done', originalEstimate: 3600, logged: 1800 });
    expect(remainingOf(i)).toBe(0);
  });
});

describe('timedIssueFromJiraFields', () => {
  it('prefers aggregates', () => {
    const i = timedIssueFromJiraFields({
      aggregatetimeoriginalestimate: 7200,
      aggregatetimespent: 3600,
      aggregatetimeestimate: 3600,
      timetracking: {
        originalEstimateSeconds: 100,
        timeSpentSeconds: 50,
        remainingEstimateSeconds: 50,
      },
    });
    expect(estimateOf(i)).toBe(7200);
    expect(loggedOf(i)).toBe(3600);
    expect(remainingOf(i)).toBe(3600);
  });

  it('falls back to timespent then nested timetracking when aggregates are null', () => {
    const i = timedIssueFromJiraFields({
      aggregatetimeoriginalestimate: null,
      aggregatetimespent: null,
      aggregatetimeestimate: null,
      timespent: 900,
      timetracking: { originalEstimateSeconds: 3600, remainingEstimateSeconds: 2700 },
    });
    expect(estimateOf(i)).toBe(3600);
    expect(loggedOf(i)).toBe(900);
    expect(remainingOf(i)).toBe(2700);
  });
});

describe('IssueTimeBar', () => {
  it('renders an accessible bar', () => {
    render(
      <IssueTimeBar
        testId="tb"
        issue={timedIssue({
          statusCategoryKey: 'indeterminate',
          originalEstimate: 3600,
          logged: 1800,
          remaining: 1800,
        })}
      />,
    );
    const el = screen.getByTestId('tb');
    expect(el).toHaveAttribute('role', 'img');
    expect(el).toHaveAttribute('aria-label', 'Logged 30m of 1h');
    expect(el).not.toHaveAttribute('data-overrun');
    expect(el).not.toHaveAttribute('data-empty');
  });

  it('flags overrun', () => {
    render(
      <IssueTimeBar
        testId="tb"
        issue={timedIssue({
          statusCategoryKey: 'indeterminate',
          originalEstimate: 1800,
          logged: 3600,
          remaining: 0,
        })}
      />,
    );
    expect(screen.getByTestId('tb')).toHaveAttribute('data-overrun', 'true');
  });

  it('renders a blank spacer when empty="spacer" and no data', () => {
    render(
      <IssueTimeBar testId="tb" empty="spacer" issue={timedIssue({ statusCategoryKey: 'new' })} />,
    );
    const el = screen.getByTestId('tb');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.querySelector('[data-testid="time-track"]')).toBeNull();
  });

  it('renders an empty track by default with no data', () => {
    render(<IssueTimeBar testId="tb" issue={timedIssue({ statusCategoryKey: 'new' })} />);
    const el = screen.getByTestId('tb');
    expect(el).toHaveAttribute('data-empty', 'true');
    expect(el.querySelector('[data-testid="time-track"]')).not.toBeNull();
  });
});

describe('IssueTimeBar with several issues', () => {
  it('splits one bar by each issue status and sums the caption', () => {
    const story = timedIssue({
      statusCategoryKey: 'indeterminate',
      originalEstimate: 3600,
      logged: 1800,
    });
    const done = timedIssue({ statusCategoryKey: 'done', originalEstimate: 3600, logged: 3600 });
    render(<IssueTimeBar issue={[story, done]} colorBy="health" caption />);
    const bar = screen.getByTestId('story-time-bar');
    expect(bar.querySelector('[data-segment="done:logged"]')?.className).toContain('bg-green-500');
    expect(bar.querySelector('[data-segment="indeterminate:logged"]')?.className).toContain(
      'bg-blue-500',
    );
    expect(screen.getByTestId('time-bar-caption')).toHaveTextContent('1h 30m / 2h');
  });
});
