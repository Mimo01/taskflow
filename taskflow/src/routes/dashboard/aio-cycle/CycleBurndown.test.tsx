import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cycleBurndownSeries } from '@/lib/aio-cycle-charts';
import { DEFAULT_CALENDAR } from '@/lib/epic-progress';
import type { AioTestRun } from '@/services/aio';
import { CycleBurndown } from './CycleBurndown';
import { CycleKpiTiles } from './CycleKpiTiles';

const ZERO = { pass: 0, fail: 0, blocked: 0, inProgress: 0, notRun: 0 };
const D = 86_400_000;
const s = new Date(2026, 9, 1).getTime();

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
      calendar={DEFAULT_CALENDAR}
    />,
  );

describe('CycleBurndown', () => {
  it('renders a skeleton that fills its parent while loading', () => {
    render(<CycleBurndown series={null} loading />);
    const el = screen.getByTestId('cycle-burndown-skeleton');
    expect(el.className).toContain('absolute');
    expect(el.className).toContain('inset-0');
    expect(el.className).toContain('rounded-xl');
    expect(el.style.height).toBe('');
  });

  it('renders the chart wrapper for a series', () => {
    const series = cycleBurndownSeries(
      [run('PASS', s + D), run('NOT_EXECUTED')],
      undefined,
      s + 5 * D,
      DEFAULT_CALENDAR.isWorkingDay,
    );
    render(<CycleBurndown series={series} loading={false} />);
    const el = screen.getByTestId('cycle-burndown');
    expect(el.getAttribute('data-slot')).toBe('card');
    expect(el.className).toContain('absolute');
    expect(el.className).toContain('inset-0');
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

describe('CycleKpiTiles burndown layout', () => {
  it('puts the Burndown heading inside the top row, second after Cycle Statistics', () => {
    tiles([run('PASS', s + D), run('NOT_EXECUTED')]);
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Cycle Statistics',
      'Burndown',
      'Execution Distribution',
      'Defect Summary',
    ]);
  });

  it('no longer renders the bottom border-t strip for the Burndown', () => {
    tiles([run('PASS', s + D), run('NOT_EXECUTED')]);
    const section = screen.getByText('Burndown').closest('section');
    expect(section?.className).not.toContain('pt-4');
  });
});
