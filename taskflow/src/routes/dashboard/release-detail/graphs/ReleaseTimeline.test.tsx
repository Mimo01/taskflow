import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BurnupAxis } from '../releaseBurnup';
import { ReleaseTimeline, type TimelineSummary } from './ReleaseTimeline';

const axis: BurnupAxis = {
  start: '2026-10-20',
  end: '2026-11-03',
  seriesEnd: '2026-10-30',
  previousName: 'Previous release',
  releaseDate: '2026-11-03',
  showToday: true,
  showRelease: true,
};
const base: TimelineSummary = {
  done: 1,
  total: 3,
  today: '2026-10-30',
  releaseDate: '2026-11-03',
  released: false,
};

describe('ReleaseTimeline', () => {
  it('shows done figure, days left, markers and the start label', () => {
    render(<ReleaseTimeline axis={axis} summary={base} />);
    const el = screen.getByTestId('release-graph-burnup-thin');
    expect(el).toHaveTextContent('1 / 3');
    expect(el).toHaveTextContent('4 days left');
    expect(el).toHaveTextContent('Today');
    expect(el).toHaveTextContent('Release');
    expect(el).toHaveTextContent('Previous release');
  });

  it('released, overdue and undated wording', () => {
    const { rerender } = render(
      <ReleaseTimeline
        axis={axis}
        summary={{ ...base, released: true, releaseDate: '2026-10-25' }}
      />,
    );
    expect(screen.getByTestId('release-graph-burnup-thin')).toHaveTextContent('Released');
    rerender(<ReleaseTimeline axis={axis} summary={{ ...base, releaseDate: '2026-10-27' }} />);
    expect(screen.getByTestId('release-graph-burnup-thin')).toHaveTextContent('3 days overdue');
    rerender(<ReleaseTimeline axis={null} summary={{ ...base, releaseDate: null }} />);
    expect(screen.getByTestId('release-graph-burnup-thin')).toHaveTextContent('No release date');
  });
});
