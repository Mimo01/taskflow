import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cycleBurndownSeries } from '@/lib/aio-cycle-charts';
import type { AioTestRun } from '@/services/aio';
import { CycleBurndown } from './CycleBurndown';
import { CycleKpiTiles } from './CycleKpiTiles';

const ZERO = { pass: 0, fail: 0, blocked: 0, inProgress: 0, notRun: 0 };
const D = 86_400_000;
const s = 2_000 * D;

const run = (status: string, ms?: number) =>
  ({
    status,
    executedDate: ms === undefined ? undefined : new Date(ms).toISOString(),
  }) as unknown as AioTestRun;

const tiles = (runs: AioTestRun[] | undefined) =>
  render(
    <CycleKpiTiles
      counts={ZERO}
      total={runs?.length ?? 0}
      runs={runs}
      countsLoading={false}
      defectsLoading={false}
      defects={[]}
      cycle={{ startDate: s, endDate: s + 10 * D }}
    />,
  );

describe('CycleBurndown', () => {
  it('renders a 140px skeleton while loading', () => {
    render(<CycleBurndown series={null} loading />);
    const el = screen.getByTestId('cycle-burndown-skeleton');
    expect(el.style.height).toBe('140px');
  });

  it('renders the chart wrapper for a series', () => {
    const series = cycleBurndownSeries(
      [run('PASS', s + D), run('NOT_EXECUTED')],
      undefined,
      s + 5 * D,
      () => true,
    );
    render(<CycleBurndown series={series} loading={false} />);
    expect(screen.getByTestId('cycle-burndown')).toBeDefined();
  });
});

describe('CycleKpiTiles burndown section', () => {
  it('shows the Burndown heading while runs load', () => {
    tiles(undefined);
    expect(screen.getByText('Burndown')).toBeDefined();
  });

  it('shows the heading when something was executed', () => {
    tiles([run('PASS', s + D), run('NOT_EXECUTED')]);
    expect(screen.getByText('Burndown')).toBeDefined();
  });

  it('hides the section when nothing was executed', () => {
    tiles([run('NOT_EXECUTED'), run('NOT_EXECUTED')]);
    expect(screen.queryByText('Burndown')).toBeNull();
  });
});
