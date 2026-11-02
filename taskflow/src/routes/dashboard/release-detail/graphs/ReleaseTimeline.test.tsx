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

  it('shows version names only under the track: previous left, this release right', () => {
    render(
      <ReleaseTimeline axis={axis} summary={{ ...base, versionName: 'Release 2026-11-03' }} />,
    );
    expect(screen.getByTestId('timeline-previous-name')).toHaveTextContent(/^Previous release$/);
    expect(screen.getByTestId('timeline-version-name')).toHaveTextContent(/^Release 2026-11-03$/);
    // No start date ("Oct 20") and no "Started" fallback.
    expect(screen.getByTestId('release-graph-burnup-thin')).not.toHaveTextContent('Oct 20');
    expect(screen.queryByText(/Started/)).toBeNull();
    // Both names share one style.
    const cls = (id: string) =>
      screen
        .getByTestId(id)
        .className.replace(/\b(left|right)-0\b|\btext-right\b/g, '')
        .trim();
    expect(cls('timeline-version-name').split(/\s+/).sort()).toEqual(
      cls('timeline-previous-name').split(/\s+/).sort(),
    );
  });

  it('omits the Release marker without an axis release date', () => {
    render(<ReleaseTimeline axis={null} summary={{ ...base, releaseDate: null }} />);
    const el = screen.getByTestId('release-graph-burnup-thin');
    expect(el).toHaveTextContent('Today');
    expect(el).not.toHaveTextContent('Release');
  });
});
