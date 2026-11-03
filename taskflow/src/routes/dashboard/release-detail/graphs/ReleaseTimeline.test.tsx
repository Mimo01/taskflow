import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { JiraFixVersion } from '@/services/jira';
import type { BurnupAxis } from '../releaseBurnup';
import { deriveReleaseTrain, type ReleaseTrain } from '../releaseTrain';
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
    render(<ReleaseTimeline axis={null} summary={{ ...base, releaseDate: null, train: null }} />);
    const el = screen.getByTestId('release-graph-burnup-thin');
    expect(el).toHaveTextContent('Today');
    expect(el).not.toHaveTextContent('Release');
    expect(screen.queryByTestId('train-summary')).toBeNull();
  });
});

const fv = (id: string, name: string, releaseDate: string, released = false): JiraFixVersion => ({
  id,
  name,
  releaseDate,
  released,
});

function trainSummary(train: ReleaseTrain | null): TimelineSummary {
  return { ...base, today: '2026-11-03', releaseDate: train?.end ?? null, train };
}

describe('ReleaseTimeline release train', () => {
  const THIS = fv('10', 'R-12-01', '2026-12-01');
  const PREV = fv('9', 'R-11-17', '2026-11-17');

  it('locked example: TODAY -> window opens at R-11-17 -> RELEASE, with the summary line', () => {
    const train = deriveReleaseTrain({
      version: THIS,
      fixVersions: [PREV, THIS],
      today: '2026-11-03',
    });
    render(<ReleaseTimeline axis={null} summary={trainSummary(train)} />);
    const el = screen.getByTestId('release-graph-burnup-thin');
    for (const text of ['Today', 'R-11-17', 'R-12-01', 'window opens', 'Release'])
      expect(el).toHaveTextContent(text);
    expect(screen.getByTestId('train-summary')).toHaveTextContent(
      /^1 release ahead · window 14 d · in 28 d$/,
    );
    expect(el).not.toHaveTextContent('issues done');
    expect(el).not.toHaveTextContent('days left');
    expect(screen.getByTestId('train-tick').style.left).toBe('50%');
    expect(screen.getByTestId('train-window').style.left).toBe('50%');
    expect(screen.getByTestId('train-window').className).toMatch(/\bright-0\b/);
    expect(screen.getByTestId('train-today').style.left).toBe('0%');
  });

  it('window already open: TODAY is not clamped to the window start, no releases ahead', () => {
    const train = deriveReleaseTrain({
      version: fv('10', 'R-11-10', '2026-11-10'),
      fixVersions: [fv('9', 'R-10-28', '2026-10-28'), fv('10', 'R-11-10', '2026-11-10')],
      today: '2026-11-03',
    });
    render(<ReleaseTimeline axis={null} summary={trainSummary(train)} />);
    const el = screen.getByTestId('release-graph-burnup-thin');
    expect(Number.parseFloat(screen.getByTestId('train-today').style.left)).toBeGreaterThan(0);
    expect(el).not.toHaveTextContent(/ahead/);
    expect(screen.getByTestId('train-summary')).toHaveTextContent(/^window 13 d · in 7 d$/);
    expect(el).toHaveTextContent('window opens');
  });

  it('keeps every tick (with its name in the title) even when names are dropped', () => {
    const train = deriveReleaseTrain({
      version: THIS,
      fixVersions: [fv('7', 'R-11-04', '2026-11-04'), fv('8', 'R-11-05', '2026-11-05'), PREV, THIS],
      today: '2026-11-03',
    });
    if (!train) throw new Error('fixture');
    render(<ReleaseTimeline axis={null} summary={trainSummary(train)} />);
    const ticks = screen.getAllByTestId('train-tick');
    expect(ticks).toHaveLength(train.ticks.length);
    expect(ticks.map((t) => t.getAttribute('title'))).toEqual(['R-11-04', 'R-11-05', 'R-11-17']);
    // R-11-04 sits right next to TODAY: its name is dropped, the tick stays.
    expect(screen.getByTestId('release-graph-burnup-thin')).not.toHaveTextContent('R-11-04');
  });
});
