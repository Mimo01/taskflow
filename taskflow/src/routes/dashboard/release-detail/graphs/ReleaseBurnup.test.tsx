import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BurnupAxis, BurnupPoint } from '../releaseBurnup';
import {
  BurnupTooltip,
  burnupYScale,
  COMPACT_BODY_H,
  closeLastDay,
  ReleaseBurnup,
  yearAwareTicks,
} from './ReleaseBurnup';

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
    expect(screen.getByTestId('release-graph-burnup-thin')).toBeInTheDocument();
    expect(screen.getByText('No burnup yet')).toBeInTheDocument();
    expect(
      screen.getByText('It appears after the first day of the release window.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Release burnup/ })).toBeNull();
    expect(screen.queryByText(/days left/)).toBeNull();
  });

  it('says when a future release starts and reads "after" while its window is ahead', () => {
    const future = {
      ...axis,
      start: '2026-11-17',
      end: '2026-12-01',
      seriesEnd: '2026-11-03',
      previousName: 'R-11-17',
      releaseDate: '2026-12-01',
      showToday: false,
    };
    render(
      <ReleaseBurnup
        axis={future}
        points={[]}
        state="ready"
        showStoryPoints={false}
        summary={{ ...summary, today: '2026-11-03', releaseDate: '2026-12-01' }}
      />,
    );
    expect(screen.getByText('No burnup yet')).toBeInTheDocument();
    expect(screen.getByText(/^It starts when R-11-17 ships on Nov 17/)).toBeInTheDocument();
    expect(screen.getByText(/^after/)).toBeInTheDocument();
    expect(screen.queryByText(/^since/)).toBeNull();
  });

  it('shows no countdown above the chart (the page header carries it)', () => {
    render(
      <ReleaseBurnup
        axis={axis}
        points={points}
        state="ready"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    expect(screen.queryByText(/days left/)).toBeNull();
    expect(screen.getByRole('img', { name: /Release burnup/ })).toBeInTheDocument();
    expect(screen.queryByText(/issues done/)).toBeNull();
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
    expect(screen.getByTitle('since v1.2 · Oct 1')).toHaveTextContent(/^since\s+v1\.2$/);
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

  it('aside shows only the previous name; the date (with year) is in the title', () => {
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
    expect(aside).toHaveTextContent(/^since\s+v1\.2$/);
    expect(screen.getByText('v1.2')).toHaveClass('truncate');
  });

  it('draws no end-label text in the chart (values live in the aria-label and tooltip)', () => {
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
    const texts = Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent);
    expect(texts.some((t) => /\d+ (scope|done)/.test(t ?? ''))).toBe(false);
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

describe('closeLastDay', () => {
  it('gives the last day (release day) a full day of width, so its closures are not a sliver', () => {
    const d = (k: string, scope: number, done: number) => ({
      day: k,
      t: Date.UTC(2026, 9, Number(k.slice(8))),
      scope,
      done,
      doneSp: 0,
    });
    const pts = [d('2026-10-01', 10, 2), d('2026-10-02', 10, 3), d('2026-10-03', 10, 9)];
    const out = closeLastDay(pts);
    expect(out).toHaveLength(4);
    const [prev, rel, close] = out.slice(-3);
    expect(close.t - rel.t).toBe(86_400_000);
    expect(close.done).toBe(9);
    expect(close.day).toBe('2026-10-03');
    expect(rel.done - prev.done).toBe(6);
    expect(closeLastDay([])).toEqual([]);
  });
});

describe('ReleaseBurnup compact height', () => {
  it('has the same fixed body height with a chart and with the thin timeline', () => {
    for (const pts of [points, points.slice(0, 1)]) {
      const { unmount } = render(
        <ReleaseBurnup
          axis={axis}
          points={pts}
          state="ready"
          showStoryPoints={false}
          summary={summary}
          compact
        />,
      );
      const body = screen.getByTestId('release-burnup-body');
      expect(body.style.height).toBe(`${COMPACT_BODY_H}px`);
      expect(body.className).not.toContain('flex-1');
      unmount();
    }
  });
});
