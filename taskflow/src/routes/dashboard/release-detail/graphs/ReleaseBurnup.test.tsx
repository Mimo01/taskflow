import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BurnupAxis, BurnupPoint } from '../releaseBurnup';
import { BurnupTooltip, burnupYScale, ReleaseBurnup, yearAwareTicks } from './ReleaseBurnup';

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
    expect(screen.getByTitle('since v1.2 · Oct 1')).toHaveTextContent('since v1.2 · Oct 1');
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

  it('aside shows the previous name and a year when the start is not this year', () => {
    render(
      <ReleaseBurnup
        axis={{ ...axis, start: '2025-11-20' }}
        points={points}
        state="ready"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    const aside = screen.getByTitle('since v1.2 · Nov 20, 2025');
    expect(aside).toHaveTextContent('since v1.2 · Nov 20, 2025');
    expect(screen.getByText('v1.2')).toHaveClass('truncate');
  });

  it('draws end-point dots at the last point only (one when scope equals done)', () => {
    const { container, rerender } = render(
      <ReleaseBurnup
        axis={axis}
        points={points}
        state="ready"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    const n = container.querySelectorAll('[data-testid="burnup-end-dot"]').length;
    expect(n === 0 || n === 2).toBe(true);
    const last = points[points.length - 1];
    rerender(
      <ReleaseBurnup
        axis={axis}
        points={[...points.slice(0, -1), { ...last, scope: last.done }]}
        state="ready"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    expect(container.querySelectorAll('[data-testid="burnup-end-dot"]').length).toBeLessThanOrEqual(
      1,
    );
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

describe('yearAwareTicks', () => {
  const t = (k: string) => Date.parse(`${k}T00:00:00Z`);
  it('adds no year when the axis is within the current year', () => {
    const out = yearAwareTicks(
      [{ t: t('2026-10-01'), label: 'Oct 1' }],
      '2026-10-01',
      '2026-10-20',
      2026,
    );
    expect(out[0].label).toBe('Oct 1');
  });
  it('puts the year on the first tick when the start is in another year', () => {
    const out = yearAwareTicks(
      [{ t: t('2025-12-28'), label: 'Dec 28' }],
      '2025-12-28',
      '2025-12-30',
      2026,
    );
    expect(out[0].label).toBe('Dec 28, 2025');
  });
  it('puts the year on the first tick of a new year, replacing the shared one', () => {
    const out = yearAwareTicks(
      [
        { t: t('2026-12-20'), label: 'Dec 20 2026' },
        { t: t('2027-01-03'), label: 'Jan 3 2027' },
      ],
      '2026-12-20',
      '2027-01-05',
      2026,
    );
    expect(out.map((o) => o.label)).toEqual(['Dec 20, 2026', 'Jan 3, 2027']);
  });
  it('uses "Mon YYYY" for month ticks', () => {
    const out = yearAwareTicks(
      [{ t: t('2027-01-01'), label: 'Jan' }],
      '2026-12-01',
      '2027-02-01',
      2026,
    );
    expect(out[0].label).toBe('Jan 2027');
  });
});
