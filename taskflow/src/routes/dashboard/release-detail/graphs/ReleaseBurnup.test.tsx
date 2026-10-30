import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BurnupAxis, BurnupPoint } from '../releaseBurnup';
import { BurnupTooltip, burnupEndLabelDy, burnupYScale, ReleaseBurnup } from './ReleaseBurnup';

const axis: BurnupAxis = {
  start: '2026-10-01',
  end: '2026-10-20',
  seriesEnd: '2026-10-10',
  previousName: 'v1.2',
  releaseDate: '2026-10-20',
  showToday: true,
  showRelease: true,
};
const pt = (day: string, t: number, scope: number, done: number): BurnupPoint => ({
  day,
  t,
  scope,
  done,
  doneSp: done * 2,
});
const summary = {
  done: 2,
  total: 5,
  today: '2026-10-10',
  releaseDate: '2026-10-20',
  released: false,
};
const points = [pt('2026-10-01', 1, 3, 0), pt('2026-10-10', 2, 5, 2)];

describe('ReleaseBurnup', () => {
  it('shows the loading skeleton', () => {
    render(
      <ReleaseBurnup
        axis={null}
        points={[]}
        state="loading"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    expect(screen.getByTestId('release-graph-burnup-skeleton')).toBeInTheDocument();
  });

  it('shows the error text', () => {
    render(
      <ReleaseBurnup
        axis={null}
        points={[]}
        state="error"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    expect(screen.getByText(/Couldn't load issues/)).toBeInTheDocument();
  });

  it('shows No issues when empty', () => {
    render(
      <ReleaseBurnup
        axis={null}
        points={[]}
        state="empty"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    expect(screen.getByText('No issues')).toBeInTheDocument();
  });

  it('shows the countdown timeline instead of a chart for a 1-point series', () => {
    render(
      <ReleaseBurnup
        axis={axis}
        points={points.slice(0, 1)}
        state="ready"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    const thin = screen.getByTestId('release-graph-burnup-thin');
    expect(thin).toHaveTextContent('2');
    expect(thin).toHaveTextContent('10 days left');
    expect(thin).toHaveTextContent('until');
  });

  it('renders the chart with an aria-label, heading and aside; no legend', () => {
    const { container } = render(
      <ReleaseBurnup
        axis={axis}
        points={points}
        state="ready"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    expect(
      screen.getByRole('img', { name: 'Release burnup: 5 scope, 2 done' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByTitle('since v1.2 · Oct 1')).toHaveTextContent('since Oct 1');
    expect(container.querySelector('.recharts-legend-wrapper')).toBeNull();
  });

  it('aside omits the previous name when there is none', () => {
    render(
      <ReleaseBurnup
        axis={{ ...axis, previousName: null }}
        points={points}
        state="ready"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    expect(screen.getByText('since Oct 1')).toBeInTheDocument();
  });
});

describe('BurnupTooltip', () => {
  const payload = [{ payload: points[1] }];
  it('renders date, Scope and Done rows', () => {
    render(<BurnupTooltip active payload={payload} showStoryPoints={false} />);
    expect(screen.getByText('Oct 10')).toBeInTheDocument();
    expect(screen.getAllByText(/^(Scope|Done)$/)).toHaveLength(2);
    expect(screen.queryByText('Story points done')).toBeNull();
  });
  it('adds a story points row when enabled (max 3 rows)', () => {
    const { container } = render(<BurnupTooltip active payload={payload} showStoryPoints />);
    expect(screen.getByText('Story points done')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="tooltip-row"]').length).toBeLessThanOrEqual(4);
  });
  it('renders nothing when inactive', () => {
    const { container } = render(
      <BurnupTooltip active={false} payload={payload} showStoryPoints />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('burnupYScale', () => {
  it('yields at most 4 integer ticks', () => {
    for (const m of [0, 1, 7, 15, 16, 40, 120]) {
      const { ticks, top } = burnupYScale(m);
      expect(ticks.length).toBeLessThanOrEqual(4);
      expect(top).toBeGreaterThanOrEqual(m);
    }
  });
});

describe('burnupEndLabelDy', () => {
  const gap = (scope: number, done: number, top: number) => {
    const { scopeDy, doneDy, merged } = burnupEndLabelDy(scope, done, top);
    return merged ? 99 : Math.abs(scopeDy - doneDy);
  };
  it('merges the labels into one when scope equals done', () => {
    const { merged, scopeDy } = burnupEndLabelDy(22, 22, 30);
    expect(merged).toBe(true);
    expect(scopeDy).toBeLessThan(0);
  });
  it('keeps them apart when they differ by 1', () => {
    expect(gap(22, 21, 30)).toBeGreaterThanOrEqual(12);
  });
  it('moves done above scope when done sits on the axis', () => {
    const { scopeDy, doneDy } = burnupEndLabelDy(28, 0, 30);
    expect(doneDy).toBeLessThan(scopeDy);
    expect(gap(28, 0, 30)).toBeGreaterThanOrEqual(12);
    expect(gap(1, 0, 5)).toBeGreaterThanOrEqual(12);
  });
});
