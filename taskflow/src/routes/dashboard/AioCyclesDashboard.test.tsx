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
  cycle(2, 'alice', '2026-10-15'), // due this week
  cycle(3, 'bob', null), // no end date
];

function renderDashboard(
  over: Partial<React.ComponentProps<typeof AioCyclesDashboard>> = {},
  scope: CycleScope | null = buildScope(ITEMS),
) {
  const onFilter = vi.fn<(f: CycleFilter | null) => void>();
  const onShowOpen = vi.fn();
  const onShowAll = vi.fn();
  const onOpenFolder = vi.fn<(id: number) => void>();
  const props: React.ComponentProps<typeof AioCyclesDashboard> = {
    scope,
    filter: null,
    onFilter,
    loading: false,
    summariesLoading: false,
    statusFilter: 'open',
    onShowOpen,
    onShowAll,
    subfolders: [],
    onOpenFolder,
    today: TODAY,
    token: 't',
    jiraBaseUrl: 'https://jira.example.com',
    ...over,
  };
  const ui = (p: React.ComponentProps<typeof AioCyclesDashboard>) => (
    <QueryClientProvider client={new QueryClient()}>
      <AioCyclesDashboard {...p} />
    </QueryClientProvider>
  );
  const utils = render(ui(props));
  const rerenderWith = (more: Partial<React.ComponentProps<typeof AioCyclesDashboard>>) =>
    utils.rerender(ui({ ...props, ...more }));
  return { ...utils, rerenderWith, onFilter, onShowOpen, onShowAll, onOpenFolder };
}

describe('AioCyclesDashboard', () => {
  it('renders the four tiles with values from the scope', () => {
    renderDashboard();
    expect(screen.getByTestId('tile-open').textContent).toContain('3');
    expect(screen.getByTestId('tile-open').textContent).toContain('of 3 in this folder');
    expect(screen.getByTestId('tile-overdue').textContent).toContain('1');
    expect(screen.getByTestId('tile-overdue').textContent).toContain('oldest 12 days late');
    expect(screen.getByTestId('tile-due').textContent).toContain('Due this week');
    expect(screen.getByTestId('tile-due').textContent).toContain('next on Oct 15');
    // pass 3 of 6 total runs
    expect(screen.getByTestId('tile-pass').textContent).toContain('50%');
    expect(screen.getByTestId('tile-pass').textContent).toContain('4 of 6 runs executed');
  });

  it('Overdue tile reads "all on schedule" when nothing is late', () => {
    renderDashboard({}, buildScope([cycle(3, 'bob', null)]));
    expect(screen.getByTestId('tile-overdue').textContent).toContain('all on schedule');
  });

  it('Overdue tile filters, shows pressed, and toggles off', () => {
    const { onFilter, rerenderWith } = renderDashboard();
    fireEvent.click(screen.getByTestId('tile-overdue'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'overdue' });
    expect(screen.getByTestId('tile-overdue').getAttribute('aria-pressed')).toBe('false');

    onFilter.mockClear();
    rerenderWith({ filter: { kind: 'overdue' } });
    expect(screen.getByTestId('tile-overdue').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('tile-overdue'));
    expect(onFilter).toHaveBeenCalledWith(null);
  });

  it('Open cycles tile calls onShowOpen', () => {
    const { onShowOpen } = renderDashboard();
    fireEvent.click(screen.getByTestId('tile-open'));
    expect(onShowOpen).toHaveBeenCalled();
  });

  it('Test results renders a row per non-zero status and filters', () => {
    const { onFilter } = renderDashboard();
    expect(screen.getByTestId('exec-row-pass')).toBeTruthy();
    expect(screen.getByTestId('exec-row-fail')).toBeTruthy();
    expect(screen.getByTestId('exec-row-notRun')).toBeTruthy();
    expect(screen.queryByTestId('exec-row-blocked')).toBeNull();
    expect(screen.getByTestId('card-exec').textContent).toContain('67%executed');
    fireEvent.click(screen.getByTestId('exec-row-pass'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'status', status: 'pass' });
  });

  it('Test results shows "No test runs" when there are no runs', () => {
    renderDashboard({}, buildScope(ITEMS, false));
    expect(screen.getByText('No test runs')).toBeTruthy();
  });

  it('Test results shows "Not started yet" when nothing has been executed', () => {
    const scope = aggregateCycleScope(
      [cycle(2, 'alice', null)],
      Object.fromEntries([summary(2, { '51': 2 }, 2)]),
      STATUSES,
      TODAY,
      'open',
    );
    renderDashboard({}, scope);
    expect(screen.getByText('Not started yet')).toBeTruthy();
    expect(screen.getByTestId('card-exec').textContent).toContain('2 test runs are waiting');
    expect(screen.queryByTestId('exec-row-notRun')).toBeNull();
  });

  it('Cycle progress counts stages and filters by stage', () => {
    const { onFilter } = renderDashboard();
    // cycle 1: 4 runs all executed -> done; cycle 2: 2 not run -> not started
    expect(screen.getByTestId('stage-row-done').textContent).toContain('1');
    expect(screen.getByTestId('stage-row-notStarted').textContent).toContain('1');
    expect(screen.queryByTestId('stage-row-noTests')).toBeNull();
    fireEvent.click(screen.getByTestId('stage-row-notStarted'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'stage', stage: 'notStarted' });
  });

  it('Due dates always shows six labelled buckets and filters non-empty ones', () => {
    const { onFilter } = renderDashboard();
    expect(screen.getAllByTestId(/^due-row-/)).toHaveLength(6);
    expect(screen.getByTestId('due-row-week').textContent).toContain('This week');
    fireEvent.click(screen.getByTestId('due-row-overdue'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'overdue' });
    fireEvent.click(screen.getByTestId('due-row-week'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'dueSoon' });
    fireEvent.click(screen.getByTestId('due-row-none'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'noDates' });
    onFilter.mockClear();
    fireEvent.click(screen.getByTestId('due-row-later')); // empty
    expect(onFilter).not.toHaveBeenCalled();
  });

  it('Owners falls back to the owner id and filters by owner', () => {
    const { onFilter } = renderDashboard();
    const row = screen.getByTestId('owner-row-alice');
    expect(row.textContent).toContain('alice');
    fireEvent.click(row);
    expect(onFilter).toHaveBeenCalledWith({ kind: 'owner', ownerId: 'alice', label: 'alice' });
  });

  it('Owners shows at most 6 rows plus a "+N more owners" line', () => {
    const many = Array.from({ length: 9 }, (_, i) => cycle(100 + i, `user${i}`, null));
    renderDashboard({}, buildScope(many));
    expect(screen.getAllByTestId(/^owner-row-/)).toHaveLength(6);
    expect(screen.getByText('+3 more owners')).toBeTruthy();
  });

  it('Subfolders card lists children and opens one on click', () => {
    const { onOpenFolder } = renderDashboard({
      subfolders: [
        { id: 7, name: 'Sprint 1', count: 4, hasChildren: false },
        { id: 8, name: 'Sprint 2', count: 0, hasChildren: true },
      ],
    });
    expect(screen.getByTestId('card-subfolders').textContent).toContain('2 folders · 4 cycles');
    fireEvent.click(screen.getByTestId('subfolder-7'));
    expect(onOpenFolder).toHaveBeenCalledWith(7);
  });

  it('a folder with no cycles shows a notice and only the subfolders', () => {
    renderDashboard(
      { subfolders: [{ id: 7, name: 'Sprint 1', count: 4, hasChildren: false }] },
      buildScope([]),
    );
    expect(screen.getByTestId('dashboard-notice').textContent).toContain(
      'No test cycles in this folder',
    );
    expect(screen.getByTestId('subfolder-7')).toBeTruthy();
    expect(screen.queryByTestId('tile-open')).toBeNull();
  });

  it('all-closed scope under Open shows a notice that switches to All', () => {
    const { onShowAll } = renderDashboard({}, buildScope([cycle(9, 'bob', null, true)]));
    expect(screen.getByTestId('dashboard-notice').textContent).toContain(
      'All 1 cycle here are closed',
    );
    fireEvent.click(screen.getByTestId('dashboard-show-all'));
    expect(onShowAll).toHaveBeenCalled();
  });

  it('summariesLoading skeletons only the Pass rate tile, Test results and Cycle progress', () => {
    renderDashboard({ summariesLoading: true });
    expect(screen.getByTestId('tile-skeleton-pass')).toBeTruthy();
    expect(screen.getByTestId('card-skeleton-exec')).toBeTruthy();
    expect(screen.getByTestId('card-skeleton-stages')).toBeTruthy();
    expect(screen.getByTestId('tile-open').textContent).toContain('3');
    expect(screen.queryByTestId('card-skeleton-owners')).toBeNull();
    expect(screen.queryByTestId('card-skeleton-due')).toBeNull();
  });

  it('loading skeletons every tile and card inside the same shells', () => {
    renderDashboard({ loading: true });
    expect(screen.getAllByTestId(/^tile-skeleton-/)).toHaveLength(4);
    expect(screen.getAllByRole('region')).toHaveLength(4);
    for (const id of ['exec', 'stages', 'due', 'owners']) {
      expect(screen.getByTestId(`card-skeleton-${id}`)).toBeTruthy();
    }
  });
});
