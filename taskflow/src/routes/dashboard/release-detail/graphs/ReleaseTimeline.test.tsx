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
  it('renders the track only: markers and the start label, no figures or countdown', () => {
    render(<ReleaseTimeline axis={axis} summary={base} />);
    const el = screen.getByTestId('release-graph-burnup-thin');
    expect(el).toHaveTextContent('Today');
    expect(el).toHaveTextContent('Release');
    expect(el).toHaveTextContent('Previous release');
    expect(el).not.toHaveTextContent('issues done');
    expect(el).not.toHaveTextContent('days left');
  });

  it('omits the Release marker without an axis release date', () => {
    render(<ReleaseTimeline axis={null} summary={{ ...base, releaseDate: null }} />);
    const el = screen.getByTestId('release-graph-burnup-thin');
    expect(el).toHaveTextContent('Today');
    expect(el).not.toHaveTextContent('Release');
  });
});
