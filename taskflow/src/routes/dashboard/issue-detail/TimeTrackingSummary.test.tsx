import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimeTrackingSummary } from './TimeTrackingSummary';

describe('TimeTrackingSummary', () => {
  it('shows "No time logged" when native timetracking and aggregate fields are all empty', () => {
    render(<TimeTrackingSummary isDone={false} timetracking={undefined} />);
    expect(screen.getByText('No time logged')).toBeInTheDocument();
  });

  it('shows "No time logged" when everything is zero', () => {
    render(
      <TimeTrackingSummary
        isDone={false}
        timetracking={{ timeSpentSeconds: 0, originalEstimateSeconds: 0 }}
        aggregatetimespent={0}
        aggregatetimeoriginalestimate={0}
      />,
    );
    expect(screen.getByText('No time logged')).toBeInTheDocument();
  });

  it('prefers aggregatetimespent/aggregatetimeoriginalestimate over the nested timetracking object', () => {
    // Real-world case: parent issue's own nested timetracking is empty (estimated/logged
    // only at the subtask level), but Jira's own server-computed aggregate fields already
    // reflect the correct own+subtasks totals.
    render(
      <TimeTrackingSummary
        isDone={false}
        timetracking={{}}
        aggregatetimeoriginalestimate={82800}
        aggregatetimespent={61500}
      />,
    );
    expect(screen.queryByText('No time logged')).not.toBeInTheDocument();
    expect(screen.getByText('17h 5m / 23h')).toBeInTheDocument();
  });

  it('falls back to timespent when aggregatetimespent is absent', () => {
    render(<TimeTrackingSummary isDone={false} timetracking={{}} timespent={7200} />);
    expect(screen.getByText(/Spent:/)).toBeInTheDocument();
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });

  it('falls back to the nested timetracking timeSpentSeconds when no aggregate/top-level spent field is present', () => {
    render(<TimeTrackingSummary isDone={false} timetracking={{ timeSpentSeconds: 3600 }} />);
    expect(screen.getByText(/Spent:/)).toBeInTheDocument();
    expect(screen.getByText(/1h/)).toBeInTheDocument();
  });

  it('falls back to aggregatetimeestimate (remaining) when aggregatetimeoriginalestimate is absent', () => {
    render(
      <TimeTrackingSummary
        isDone={false}
        timetracking={{}}
        aggregatetimeestimate={14400}
        aggregatetimespent={3600}
      />,
    );
    expect(screen.queryByText('No estimate')).not.toBeInTheDocument();
    expect(screen.getByText('1h / 4h')).toBeInTheDocument();
  });

  it('falls back to nested originalEstimateSeconds/remainingEstimateSeconds when no aggregate estimate field is present', () => {
    render(
      <TimeTrackingSummary
        isDone={false}
        timetracking={{
          timeSpentSeconds: 3600,
          remainingEstimateSeconds: 14400,
          remainingEstimate: '4h',
        }}
      />,
    );
    expect(screen.queryByText('No estimate')).not.toBeInTheDocument();
    expect(screen.getByText('1h / 4h')).toBeInTheDocument();
  });

  it('still shows "No estimate" when neither aggregate nor nested estimate fields are present', () => {
    render(<TimeTrackingSummary isDone={false} timetracking={{ timeSpentSeconds: 3600 }} />);
    expect(screen.getByText('No estimate')).toBeInTheDocument();
  });

  describe('progress bar', () => {
    it('renders with the correct percent for the normal (computed) case', () => {
      render(
        <TimeTrackingSummary
          isDone={false}
          timetracking={{
            timeSpentSeconds: 3600,
            originalEstimateSeconds: 28800,
            originalEstimate: '8h',
          }}
        />,
      );
      expect(screen.getByTestId('time-tracking-bar')).toBeInTheDocument();
      expect(screen.getByText('1h / 8h')).toBeInTheDocument();
    });

    it('closed issue (remaining 0) shows a done-coloured logged bar from spent / original', () => {
      render(
        <TimeTrackingSummary
          isDone
          timetracking={{}}
          aggregatetimespent={7200}
          aggregatetimeoriginalestimate={14400}
          aggregatetimeestimate={0}
        />,
      );
      const bar = screen.getByTestId('time-tracking-bar');
      expect(bar.querySelector('[data-segment="done:logged"]')).toBeInTheDocument();
      expect(screen.getByText('2h / 4h')).toBeInTheDocument();
    });

    it('done issue without an original estimate shows no bar (remaining is not an estimate)', () => {
      render(
        <TimeTrackingSummary
          isDone
          timetracking={{ remainingEstimateSeconds: 14400 }}
          aggregatetimeestimate={14400}
          aggregatetimespent={3600}
        />,
      );
      expect(screen.queryByTestId('time-tracking-bar')).not.toBeInTheDocument();
      expect(screen.getByText(/Spent:/)).toBeInTheDocument();
      expect(screen.getByText('No estimate')).toBeInTheDocument();
    });

    it('not done: spent > original is red beyond the estimate', () => {
      render(
        <TimeTrackingSummary
          isDone={false}
          timetracking={{}}
          aggregatetimeoriginalestimate={3600}
          aggregatetimespent={7200}
        />,
      );
      expect(
        screen.getByTestId('time-tracking-bar').querySelector('[data-segment$=":loggedOver"]'),
      ).toHaveClass('bg-red-500');
    });

    it('shows the overrun caption', () => {
      render(
        <TimeTrackingSummary
          isDone={false}
          timetracking={{}}
          aggregatetimeoriginalestimate={3600}
          aggregatetimespent={7200}
        />,
      );
      expect(screen.getByText('2h / 1h')).toBeInTheDocument();
    });

    it('does not render a bar when there is no estimate', () => {
      render(<TimeTrackingSummary isDone={false} timetracking={{ timeSpentSeconds: 3600 }} />);
      expect(screen.queryByTestId('time-tracking-bar')).not.toBeInTheDocument();
    });

    it('does not render a bar when nothing has been logged ("No time logged" text state)', () => {
      render(<TimeTrackingSummary isDone={false} timetracking={undefined} />);
      expect(screen.getByText('No time logged')).toBeInTheDocument();
      expect(screen.queryByTestId('time-tracking-bar')).not.toBeInTheDocument();
    });
  });
});
