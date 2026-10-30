import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BurnupAxis, BurnupPoint } from '../releaseBurnup';
import { BurnupTooltip, burnupYScale, NOT_ENOUGH_HISTORY, ReleaseBurnup } from './ReleaseBurnup';

vi.mock('../../issue-detail/EpicChartZoom', async (orig) => ({
  ...(await orig<typeof import('../../issue-detail/EpicChartZoom')>()),
  useElementWidth: () => 600,
}));

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
const points = [pt('2026-10-01', 1, 3, 0), pt('2026-10-10', 2, 5, 2)];

describe('ReleaseBurnup', () => {
  it('shows the loading skeleton', () => {
    render(<ReleaseBurnup axis={null} points={[]} state="loading" showStoryPoints={false} />);
    expect(screen.getByTestId('release-graph-burnup-skeleton')).toBeInTheDocument();
  });

  it('shows the error text', () => {
    render(<ReleaseBurnup axis={null} points={[]} state="error" showStoryPoints={false} />);
    expect(screen.getByText(/Couldn't load issues/)).toBeInTheDocument();
  });

  it('shows No issues when empty', () => {
    render(<ReleaseBurnup axis={null} points={[]} state="empty" showStoryPoints={false} />);
    expect(screen.getByText('No issues')).toBeInTheDocument();
  });

  it('shows the not-enough-history sentence for a 1-point series', () => {
    render(
      <ReleaseBurnup
        axis={axis}
        points={points.slice(0, 1)}
        state="ready"
        showStoryPoints={false}
      />,
    );
    expect(screen.getByText(NOT_ENOUGH_HISTORY)).toBeInTheDocument();
  });

  it('renders the chart with an aria-label, heading and aside; no legend', () => {
    const { container } = render(
      <ReleaseBurnup axis={axis} points={points} state="ready" showStoryPoints={false} />,
    );
    expect(
      screen.getByRole('img', { name: 'Release burnup: 5 scope, 2 done' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('since v1.2 · Oct 1')).toBeInTheDocument();
    expect(container.querySelector('.recharts-legend-wrapper')).toBeNull();
  });

  it('aside omits the previous name when there is none', () => {
    render(
      <ReleaseBurnup
        axis={{ ...axis, previousName: null }}
        points={points}
        state="ready"
        showStoryPoints={false}
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
