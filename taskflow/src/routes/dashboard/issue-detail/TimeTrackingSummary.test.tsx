import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TimedSource } from '@/lib/time-bar';
import { TimeTrackingSummary } from './TimeTrackingSummary';

const H = 3600;
type F = TimedSource['fields'] & { issuetype?: { subtask?: boolean } };
const issue = (f: Partial<F>, cat = 'indeterminate') => ({
  key: 'ABC-1',
  fields: { status: { statusCategory: { key: cat } }, issuetype: { subtask: false }, ...f },
});

describe('TimeTrackingSummary', () => {
  it('shows "No time logged" when nothing is tracked', () => {
    render(<TimeTrackingSummary issue={issue({})} />);
    expect(screen.getByText('No time logged')).toBeInTheDocument();
  });

  it('shows "No time logged" when everything is zero', () => {
    render(
      <TimeTrackingSummary
        issue={issue({
          timetracking: { timeSpentSeconds: 0, originalEstimateSeconds: 0 },
          aggregatetimespent: 0,
          aggregatetimeoriginalestimate: 0,
        })}
      />,
    );
    expect(screen.getByText('No time logged')).toBeInTheDocument();
  });

  it('prefers Jira aggregates over the (empty) nested timetracking object', () => {
    render(
      <TimeTrackingSummary
        issue={issue({
          timetracking: {},
          aggregatetimeoriginalestimate: 82800,
          aggregatetimespent: 61500,
        })}
      />,
    );
    expect(screen.getByText('17h 5m / 23h')).toBeInTheDocument();
  });

  it('logged without an estimate: dashed bar + "no estimate" caption', () => {
    const { container } = render(<TimeTrackingSummary issue={issue({ timespent: 2 * H })} />);
    expect(screen.getByText('2h · no estimate')).toBeInTheDocument();
    expect(container.querySelector('[data-no-estimate="true"]')).toBeInTheDocument();
  });

  it('remaining-only (Tempo) estimate: estimate = logged + remaining', () => {
    render(
      <TimeTrackingSummary
        issue={issue({ timetracking: {}, aggregatetimeestimate: 4 * H, aggregatetimespent: H })}
      />,
    );
    expect(screen.getByText('1h / 5h')).toBeInTheDocument();
  });

  it('done issue: done-coloured logged bar from spent / original', () => {
    const { container } = render(
      <TimeTrackingSummary
        issue={issue(
          {
            aggregatetimespent: 2 * H,
            aggregatetimeoriginalestimate: 4 * H,
            aggregatetimeestimate: 0,
          },
          'done',
        )}
      />,
    );
    expect(container.querySelector('[data-segment="done:logged"]')).toBeInTheDocument();
    expect(screen.getByText('2h / 4h')).toBeInTheDocument();
  });

  it('splits by subtask status when subtasks are passed, totals still Jira aggregates', () => {
    const { container } = render(
      <TimeTrackingSummary
        issue={issue({ aggregatetimespent: 3 * H, aggregatetimeoriginalestimate: 5 * H })}
        subtasks={[
          {
            fields: {
              status: { statusCategory: { key: 'done' } },
              timetracking: { timeSpentSeconds: 2 * H, originalEstimateSeconds: 2 * H },
            },
          },
        ]}
      />,
    );
    expect(container.querySelector('[data-segment="done:logged"]')).toBeInTheDocument();
    expect(container.querySelector('[data-segment="indeterminate:logged"]')).toBeInTheDocument();
    expect(screen.getByText('3h / 5h')).toBeInTheDocument();
  });

  it('forecast overrun shows striped red beyond the estimate', () => {
    const { container } = render(
      <TimeTrackingSummary
        issue={issue({
          aggregatetimespent: 3 * H,
          aggregatetimeoriginalestimate: 4 * H,
          aggregatetimeestimate: 3 * H,
        })}
      />,
    );
    expect(container.querySelector('[data-segment$=":remainingOver"]')).toHaveClass('bg-red-500');
  });
});
