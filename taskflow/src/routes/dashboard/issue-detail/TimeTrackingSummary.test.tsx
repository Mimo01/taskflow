import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimeTrackingSummary } from './TimeTrackingSummary';

describe('TimeTrackingSummary', () => {
  it('shows "No time logged" when native timetracking and aggregate fields are all empty', () => {
    render(<TimeTrackingSummary timetracking={undefined} />);
    expect(screen.getByText('No time logged')).toBeInTheDocument();
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

  it('prefers aggregatetimespent/aggregatetimeoriginalestimate over the nested timetracking object', () => {
    // Real-world case: parent issue's own nested timetracking is empty (estimated/logged
    // only at the subtask level), but Jira's own server-computed aggregate fields already
    // reflect the correct own+subtasks totals.
    render(
      <TimeTrackingSummary
        timetracking={{}}
        aggregatetimeoriginalestimate={82800}
        aggregatetimespent={61500}
      />,
    );
    expect(screen.queryByText('No time logged')).not.toBeInTheDocument();
    expect(screen.getByText('17h 5m / 23h')).toBeInTheDocument();
  });

  it('falls back to timespent when aggregatetimespent is absent', () => {
    render(<TimeTrackingSummary timetracking={{}} timespent={7200} />);
    expect(screen.getByText(/Spent:/)).toBeInTheDocument();
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });

  it('falls back to the nested timetracking timeSpentSeconds when no aggregate/top-level spent field is present', () => {
    render(<TimeTrackingSummary timetracking={{ timeSpentSeconds: 3600 }} />);
    expect(screen.getByText(/Spent:/)).toBeInTheDocument();
    expect(screen.getByText(/1h/)).toBeInTheDocument();
  });

  it('falls back to aggregatetimeestimate (remaining) when aggregatetimeoriginalestimate is absent', () => {
    render(
      <TimeTrackingSummary
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
    render(<TimeTrackingSummary timetracking={{ timeSpentSeconds: 3600 }} />);
    expect(screen.getByText('No estimate')).toBeInTheDocument();
  });

  describe('progress bar', () => {
    it('renders with the correct percent for the normal (computed) case', () => {
      render(
        <TimeTrackingSummary
          timetracking={{
            timeSpentSeconds: 3600,
            originalEstimateSeconds: 28800,
            originalEstimate: '8h',
          }}
        />,
      );
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('1h / 8h')).toBeInTheDocument();
    });

    it('uses aggregateprogress.percent when present instead of the computed ratio', () => {
      render(
        <TimeTrackingSummary
          timetracking={{}}
          aggregatetimeoriginalestimate={82800}
          aggregatetimespent={61500}
          aggregateprogress={{ progress: 61500, total: 82800, percent: 74 }}
        />,
      );
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('17h 5m / 23h')).toBeInTheDocument();
    });

    it('caps the visual fill at 100% on overrun and signals overrun distinctly', () => {
      render(
        <TimeTrackingSummary
          timetracking={{}}
          aggregatetimeoriginalestimate={3600}
          aggregatetimespent={7200}
        />,
      );
      const bar = screen.getByRole('progressbar');
      // base-ui Progress exposes the clamped percent via aria-valuenow.
      expect(bar).toHaveAttribute('aria-valuenow', '100');
      expect(screen.getByText('2h / 1h')).toBeInTheDocument();
    });

    it('does not render a bar when there is no estimate', () => {
      render(<TimeTrackingSummary timetracking={{ timeSpentSeconds: 3600 }} />);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('does not render a bar when nothing has been logged ("No time logged" text state)', () => {
      render(<TimeTrackingSummary timetracking={undefined} />);
      expect(screen.getByText('No time logged')).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});
