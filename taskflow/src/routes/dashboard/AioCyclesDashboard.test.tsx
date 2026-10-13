import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type CycleFilter, type CycleScope, aggregateCycleScope } from '@/lib/aio-cycle-list';
import type {
  AioCycleDetailItem,
  AioCycleSummaryItem,
  AioTestRunStatusConfig,
} from '@/services/aio/types';
import { AioCyclesDashboard } from './AioCyclesDashboard';

vi.mock('@/services/jira/users', () => ({
  fetchJiraUserByUsername: vi.fn().mockResolvedValue(null),
}));

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
  cycle(2, 'alice', '2026-10-15'), // due soon
  cycle(3, 'bob', null), // no end date
];

function renderDashboard(
  over: Partial<React.ComponentProps<typeof AioCyclesDashboard>> = {},
  scope: CycleScope | null = buildScope(ITEMS),
) {
  const onFilter = vi.fn<(f: CycleFilter | null) => void>();
  const onShowOpen = vi.fn();
  const utils = render(
    <QueryClientProvider client={new QueryClient()}>
      <AioCyclesDashboard
        scope={scope}
        filter={null}
        onFilter={onFilter}
        loading={false}
        summariesLoading={false}
        statusFilter="open"
        onShowOpen={onShowOpen}
        token="t"
        jiraBaseUrl="https://jira.example.com"
        {...over}
      />
    </QueryClientProvider>,
  );
  return { ...utils, onFilter, onShowOpen };
}

describe('AioCyclesDashboard', () => {
  it('renders the four tiles with values from the scope', () => {
    renderDashboard();
    expect(screen.getByTestId('tile-open').textContent).toContain('3');
    expect(screen.getByTestId('tile-open').textContent).toContain('of 3 in scope');
    expect(screen.getByTestId('tile-overdue').textContent).toContain('1');
    expect(screen.getByTestId('tile-overdue').textContent).toContain('oldest 12d late');
    expect(screen.getByTestId('tile-due').textContent).toContain('1');
    // pass 3 of 6 total runs
    expect(screen.getByTestId('tile-pass').textContent).toContain('50%');
    expect(screen.getByTestId('tile-pass').textContent).toContain('4/6 run');
  });

  it('Overdue tile filters, shows pressed, and toggles off', () => {
    const { onFilter, rerender } = renderDashboard();
    fireEvent.click(screen.getByTestId('tile-overdue'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'overdue' });
    expect(screen.getByTestId('tile-overdue').getAttribute('aria-pressed')).toBe('false');

    onFilter.mockClear();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AioCyclesDashboard
          scope={buildScope(ITEMS)}
          filter={{ kind: 'overdue' }}
          onFilter={onFilter}
          loading={false}
          summariesLoading={false}
          statusFilter="open"
          onShowOpen={() => {}}
          token="t"
          jiraBaseUrl="https://jira.example.com"
        />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('tile-overdue').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('tile-overdue'));
    expect(onFilter).toHaveBeenCalledWith(null);
  });

  it('Open cycles tile calls onShowOpen', () => {
    const { onShowOpen } = renderDashboard();
    fireEvent.click(screen.getByTestId('tile-open'));
    expect(onShowOpen).toHaveBeenCalled();
  });

  it('Execution mix renders a button per non-zero status and filters', () => {
    const { onFilter } = renderDashboard();
    expect(screen.getByTestId('exec-row-pass')).toBeTruthy();
    expect(screen.getByTestId('exec-row-fail')).toBeTruthy();
    expect(screen.getByTestId('exec-row-notRun')).toBeTruthy();
    expect(screen.queryByTestId('exec-row-blocked')).toBeNull();
    fireEvent.click(screen.getByTestId('exec-row-pass'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'status', status: 'pass' });
  });

  it('shows "No test runs" when there are no runs', () => {
    renderDashboard({}, buildScope(ITEMS, false));
    expect(screen.getByText('No test runs')).toBeTruthy();
  });

  it('By owner falls back to the owner id and filters by owner', () => {
    const { onFilter } = renderDashboard();
    const row = screen.getByTestId('owner-row-alice');
    expect(row.textContent).toContain('alice');
    fireEvent.click(row);
    expect(onFilter).toHaveBeenCalledWith({ kind: 'owner', ownerId: 'alice', label: 'alice' });
  });

  it('By owner shows at most 6 rows plus a "+N others" line', () => {
    const many = Array.from({ length: 9 }, (_, i) => cycle(100 + i, `user${i}`, null));
    renderDashboard({}, buildScope(many));
    expect(screen.getAllByTestId(/^owner-row-/)).toHaveLength(6);
    expect(screen.getByText('+3 others')).toBeTruthy();
  });

  it('Schedule renders 10 columns and filters by week and overdue', () => {
    const { onFilter } = renderDashboard();
    expect(screen.getAllByTestId(/^schedule-col-/)).toHaveLength(10);
    fireEvent.click(screen.getByTestId('schedule-col-2026-10-12'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'endWeek', weekStart: '2026-10-12' });
    fireEvent.click(screen.getByTestId('schedule-col-overdue'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'overdue' });
    fireEvent.click(screen.getByTestId('schedule-no-dates'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'noDates' });
    expect(screen.getByText('1 without end date')).toBeTruthy();
  });

  it('Schedule shows "No end dates set" when no open cycle has an end date', () => {
    renderDashboard({}, buildScope([cycle(1, 'alice', null)]));
    expect(screen.getByText('No end dates set')).toBeTruthy();
    expect(screen.queryAllByTestId(/^schedule-col-/)).toHaveLength(0);
  });

  it('summariesLoading skeletons only the Pass rate tile and Execution mix', () => {
    renderDashboard({ summariesLoading: true });
    expect(screen.getByTestId('tile-skeleton-pass')).toBeTruthy();
    expect(screen.getByTestId('card-skeleton-exec')).toBeTruthy();
    expect(screen.getByTestId('tile-open').textContent).toContain('3');
    expect(screen.queryByTestId('card-skeleton-owners')).toBeNull();
    expect(screen.queryByTestId('card-skeleton-schedule')).toBeNull();
  });

  it('loading skeletons every tile and card inside the same shells', () => {
    renderDashboard({ loading: true });
    expect(screen.getAllByTestId(/^tile-skeleton-/)).toHaveLength(4);
    expect(screen.getAllByRole('region')).toHaveLength(3);
    expect(screen.getByTestId('card-skeleton-exec')).toBeTruthy();
    expect(screen.getByTestId('card-skeleton-owners')).toBeTruthy();
    expect(screen.getByTestId('card-skeleton-schedule')).toBeTruthy();
  });
});
