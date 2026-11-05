import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimeTrackingSummary } from './TimeTrackingSummary';

const bar = () => screen.getByTestId('sidebar-time-bar');

describe('TimeTrackingSummary', () => {
  it('shows "No time logged" when native timetracking and aggregate fields are all empty', () => {
    render(<TimeTrackingSummary timetracking={undefined} />);
    expect(screen.getByText('No time logged')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-time-bar')).not.toBeInTheDocument();
  });

  it('shows "No time logged" when everything is zero', () => {
    render(
      <TimeTrackingSummary
        timetracking={{ timeSpentSeconds: 0, originalEstimateSeconds: 0 }}
        aggregatetimespent={0}
        aggregatetimeoriginalestimate={0}
      />,
    );
    expect(screen.getByText('No time logged')).toBeInTheDocument();
  });

  it('prefers aggregate fields over the nested timetracking object', () => {
    // Parent's own nested timetracking is empty, but Jira's aggregates carry own+subtasks totals.
    render(
      <TimeTrackingSummary
        statusCategoryKey="indeterminate"
        timetracking={{}}
        aggregatetimeoriginalestimate={82800}
        aggregatetimespent={61500}
      />,
    );
    expect(screen.queryByText('No time logged')).not.toBeInTheDocument();
    expect(screen.getByText('17h 5m / 23h')).toBeInTheDocument();
    expect(bar()).toHaveAttribute('role', 'img');
  });

  it('falls back to timespent when aggregatetimespent is absent', () => {
    render(<TimeTrackingSummary timetracking={{}} timespent={7200} />);
    expect(screen.getByText('2h · No estimate')).toBeInTheDocument();
  });

  it('falls back to the nested timeSpentSeconds when no aggregate/top-level spent field exists', () => {
    render(<TimeTrackingSummary timetracking={{ timeSpentSeconds: 3600 }} />);
    expect(screen.getByText('1h · No estimate')).toBeInTheDocument();
    expect(bar()).toBeInTheDocument();
  });

  it('remaining-only estimate (Tempo style): estimate = remaining + logged', () => {
    render(
      <TimeTrackingSummary
        statusCategoryKey="indeterminate"
        timetracking={{}}
        aggregatetimeestimate={14400}
        aggregatetimespent={3600}
      />,
    );
    expect(screen.queryByText(/No estimate/)).not.toBeInTheDocument();
    expect(screen.getByText('1h / 5h')).toBeInTheDocument();
    expect(bar()).toHaveAttribute('aria-label', 'Logged 1h of 5h');
  });

  it('nested remaining-only estimate works the same', () => {
    render(
      <TimeTrackingSummary
        statusCategoryKey="indeterminate"
        timetracking={{ timeSpentSeconds: 3600, remainingEstimateSeconds: 14400 }}
      />,
    );
    expect(screen.getByText('1h / 5h')).toBeInTheDocument();
  });

  it('shows "No estimate" when neither aggregate nor nested estimate fields are present', () => {
    render(<TimeTrackingSummary timetracking={{ timeSpentSeconds: 3600 }} />);
    expect(screen.getByText('1h · No estimate')).toBeInTheDocument();
  });

  it('closed issue (remaining 0) measures logged against the original estimate', () => {
    render(
      <TimeTrackingSummary
        statusCategoryKey="done"
        timetracking={{}}
        aggregatetimespent={7200}
        aggregatetimeoriginalestimate={14400}
        aggregatetimeestimate={0}
      />,
    );
    expect(screen.getByText('2h / 4h')).toBeInTheDocument();
    expect(bar()).not.toHaveAttribute('data-overrun');
  });

  it('done issue without an original estimate does not treat remaining as an estimate', () => {
    render(
      <TimeTrackingSummary
        statusCategoryKey="done"
        timetracking={{ remainingEstimateSeconds: 14400 }}
        aggregatetimeestimate={14400}
        aggregatetimespent={3600}
      />,
    );
    expect(screen.getByText('1h · No estimate')).toBeInTheDocument();
  });

  it('flags overrun when logged exceeds the estimate', () => {
    render(
      <TimeTrackingSummary
        statusCategoryKey="indeterminate"
        timetracking={{}}
        aggregatetimeoriginalestimate={3600}
        aggregatetimespent={7200}
      />,
    );
    expect(bar()).toHaveAttribute('data-overrun', 'true');
    expect(screen.getByText('2h / 1h')).toBeInTheDocument();
  });
});
