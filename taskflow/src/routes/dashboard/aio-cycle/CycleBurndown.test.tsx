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
      stepStats={{
        passed: 0,
        failed: 0,
        blocked: 0,
        notRun: 0,
        executed: 0,
        total: 0,
        cases: 0,
        casesWithSteps: 0,
        loading: false,
      }}
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
    expect(el.className).not.toContain('rounded-xl');
    expect(el.style.height).toBe('');
  });

  it('renders a not-started empty state that fills its parent', () => {
    render(<CycleBurndown series={null} loading={false} />);
    const el = screen.getByTestId('cycle-burndown-empty');
    expect(el.className).toContain('absolute');
    expect(el.className).toContain('inset-0');
    expect(screen.getByText('Testing not started')).toBeDefined();
    expect(screen.getByText('Burndown appears after the first execution')).toBeDefined();
    expect(screen.queryByTestId('cycle-burndown')).toBeNull();
  });

  it('renders the no-cases copy when noCases is set', () => {
    render(<CycleBurndown series={null} loading={false} noCases />);
    expect(screen.getByText('No test cases in this cycle')).toBeDefined();
    expect(screen.getByText('Add test cases to track progress')).toBeDefined();
    expect(screen.queryByText('Testing not started')).toBeNull();
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
    // Flat on the page: no Card surface (ring/border/rounded box/padding).
    expect(el.getAttribute('data-slot')).toBeNull();
    expect(el.className).not.toMatch(/ring|border|rounded|\bp-\d/);
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

  it('shows the not-started empty state when nothing was executed', () => {
    tiles([run('NOT_EXECUTED'), run('NOT_EXECUTED')]);
    expect(screen.getByText('Burndown')).toBeDefined();
    expect(screen.getByText('Testing not started')).toBeDefined();
    expect(screen.queryByTestId('cycle-burndown')).toBeNull();
  });

  it('shows the no-cases empty state for an empty cycle', () => {
    tiles([]);
    expect(screen.getByText('No test cases in this cycle')).toBeDefined();
  });
});

describe('CycleKpiTiles burndown layout', () => {
  it('keeps the heading order: Cycle Statistics, Burndown, then the donuts', () => {
    tiles([run('PASS', s + D), run('NOT_EXECUTED')]);
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Cycle Statistics',
      'Burndown',
      'Execution Distribution',
      'Defect Summary',
    ]);
  });

  it('stacks the tiles and the Burndown in one left column', () => {
    tiles([run('PASS', s + D), run('NOT_EXECUTED')]);
    const stats = screen.getByText('Cycle Statistics').closest('section');
    const burndown = screen.getByText('Burndown').closest('section');
    expect(stats?.parentElement).toBe(burndown?.parentElement);
    const donuts = screen.getByText('Execution Distribution').closest('section');
    expect(donuts?.parentElement?.parentElement).toBe(stats?.parentElement?.parentElement);
  });

  it('hides the left column headings visually from 896px, with a minimum plot height', () => {
    tiles([run('PASS', s + D), run('NOT_EXECUTED')]);
    expect(screen.getByText('Burndown').className).toContain('@4xl/epic:sr-only');
    expect(screen.getByText('Cycle Statistics').className).toContain('@4xl/epic:sr-only');
    const body = screen.getByText('Burndown').nextElementSibling;
    expect(body?.className).toContain('@4xl/epic:min-h-[110px]');
  });

  it('no longer uses the 1200px / 1408px special cases', () => {
    tiles([run('PASS', s + D), run('NOT_EXECUTED')]);
    const section = screen.getByText('Burndown').closest('section');
    expect(section?.className).not.toContain('75rem');
    expect(section?.className).not.toContain('order-last');
  });
});
