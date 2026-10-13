import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aggregateCycleScope, type CycleScope } from '@/lib/aio-cycle-list';
import type {
  AioCycleDetailItem,
  AioCycleSummaryItem,
  AioTestRunStatusConfig,
} from '@/services/aio/types';
import { AioCyclesDashboard } from './AioCyclesDashboard';

const TODAY = '2026-10-13';

const STATUSES: AioTestRunStatusConfig[] = [
  { ID: 51, name: 'Not Run', statusType: 'NOT_RUN', color: '#000' },
  { ID: 53, name: 'Passed', statusType: 'PASSED', color: '#000' },
  { ID: 54, name: 'Failed', statusType: 'FAILED', color: '#000' },
];

const cycle = (
  ID: number,
  owner: string,
  end: string | null,
  isClosed = false,
): AioCycleDetailItem => ({
  ID,
  jiraProjectID: 1,
  detail: {
    key: `P-CY-${ID}`,
    title: `Cycle ${ID}`,
    ownedByID: owner,
    folder: null,
    isClosed,
    startDate: null,
    endDate: end,
  },
  summary: null,
});

const summary = (ID: number, dist: Record<string, number>, totalTests: number) =>
  [
    ID,
    { ID, summary: { totalTests, testRunDistribution: dist } } as unknown as AioCycleSummaryItem,
  ] as const;

function buildScope(items: AioCycleDetailItem[], withSummaries = true): CycleScope {
  const summaries = withSummaries
    ? Object.fromEntries([summary(1, { '53': 3, '54': 1 }, 4), summary(2, { '51': 2 }, 2)])
    : {};
  return aggregateCycleScope(items, summaries, STATUSES, TODAY, 'open');
}

const ITEMS = [
  cycle(1, 'alice', '2026-10-01'), // overdue
  cycle(2, 'alice', '2026-10-15'), // due this week
  cycle(3, 'bob', null), // no end date
];

function renderDashboard(
  over: Partial<React.ComponentProps<typeof AioCyclesDashboard>> = {},
  scope: CycleScope | null = buildScope(ITEMS),
) {
  return render(
    <AioCyclesDashboard
      scope={scope}
      loading={false}
      summariesLoading={false}
      statusFilter="open"
      subfolders={[]}
      {...over}
    />,
  );
}

describe('AioCyclesDashboard', () => {
  it('Test results: pass rate headline, executed count and a status legend', () => {
    renderDashboard();
    const card = screen.getByTestId('card-exec');
    // pass 3 of 6 total runs; 4 executed
    expect(card.textContent).toContain('50%');
    expect(card.textContent).toContain('passed · 4 of 6 runs executed');
    expect(screen.getByTestId('legend-pass').textContent).toBe('Passed 3');
    expect(screen.getByTestId('legend-notRun').textContent).toBe('Not run 2');
    expect(screen.queryByTestId('legend-blocked')).toBeNull();
  });

  it('Test results reads "no test runs" without summaries', () => {
    renderDashboard({}, buildScope(ITEMS, false));
    expect(screen.getByTestId('card-exec').textContent).toContain('no test runs');
  });

  it('Cycle progress: completed headline and a stage legend', () => {
    renderDashboard();
    const card = screen.getByTestId('card-stages');
    // cycle 1: all 4 runs executed -> done; cycle 2: 2 not run -> not started
    expect(card.textContent).toContain('1of 2 cycles completed');
    expect(screen.getByTestId('legend-done').textContent).toBe('Completed 1');
    expect(screen.getByTestId('legend-notStarted').textContent).toBe('Not started 1');
  });

  it('Due dates: overdue headline and urgency legend', () => {
    renderDashboard();
    const card = screen.getByTestId('card-due');
    expect(card.textContent).toContain('overdue · oldest 12 days late');
    expect(screen.getByTestId('legend-overdue').textContent).toBe('Overdue 1');
    expect(screen.getByTestId('legend-week').textContent).toBe('This week 1');
    expect(screen.getByTestId('legend-none').textContent).toBe('No due date 1');
  });

  it('Due dates says all on schedule when nothing is late', () => {
    renderDashboard({}, buildScope([cycle(3, 'bob', null)]));
    expect(screen.getByTestId('card-due').textContent).toContain('all open cycles on schedule');
  });

  it('is read-only: no buttons anywhere', () => {
    renderDashboard({ subfolders: [{ id: 7, name: 'Sprint 1', count: 4 }] });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('lists subfolders with their cycle counts', () => {
    renderDashboard({
      subfolders: [
        { id: 7, name: 'Sprint 1', count: 4 },
        { id: 8, name: 'Sprint 2', count: 0 },
      ],
    });
    expect(screen.getByTestId('subfolder-7').textContent).toBe('Sprint 14');
    expect(screen.getByTestId('subfolder-8').textContent).toBe('Sprint 20');
  });

  it('a folder with no cycles shows a notice and the subfolders, no cards', () => {
    renderDashboard({ subfolders: [{ id: 7, name: 'Sprint 1', count: 4 }] }, buildScope([]));
    expect(screen.getByTestId('dashboard-notice').textContent).toContain(
      'No test cycles in this folder or its subfolders',
    );
    expect(screen.getByTestId('subfolder-7')).toBeTruthy();
    expect(screen.queryByTestId('card-exec')).toBeNull();
  });

  it('notes when every cycle in scope is closed under Open', () => {
    renderDashboard({}, buildScope([cycle(9, 'bob', null, true)]));
    expect(screen.getByTestId('dashboard-notice').textContent).toContain(
      'All 1 cycle here are closed',
    );
  });

  it('summariesLoading skeletons Test results and Cycle progress only', () => {
    renderDashboard({ summariesLoading: true });
    expect(screen.getByTestId('card-exec').querySelector('[aria-busy]')).toBeTruthy();
    expect(screen.getByTestId('card-stages').querySelector('[aria-busy]')).toBeTruthy();
    expect(screen.getByTestId('card-due').querySelector('[aria-busy]')).toBeNull();
  });

  it('loading skeletons all three cards inside the same shells', () => {
    renderDashboard({ loading: true });
    expect(screen.getAllByRole('region')).toHaveLength(3);
    for (const id of ['exec', 'stages', 'due']) {
      expect(screen.getByTestId(`card-${id}`).querySelector('[aria-busy]')).toBeTruthy();
    }
  });
});
