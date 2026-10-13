import { useQuery } from '@tanstack/react-query';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { FlaskConical, X } from 'lucide-react';
import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  type CycleFilter,
  type CycleProgress,
  cycleFilterLabel,
  cycleProgress,
  formatCycleDates,
  formatEffort,
  isOverdue,
  matchesCycleFilter,
  PROGRESS_SEGMENT_CLASS,
  progressTooltipRows,
  sortCycles,
  toDateKey,
} from '@/lib/aio-cycle-list';
import {
  aioCycleStatusPillClass,
  STATUS_PILL_LAYOUT_CLASS,
  tonePillClass,
} from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type {
  AioCycleDetailItem,
  AioCycleSummaryItem,
  AioTestRunStatusConfig,
} from '@/services/aio/types';
import { fetchJiraUserByUsername } from '@/services/jira/users';
import { useAioCyclesSelectionStore } from '@/stores/aio-cycles-selection.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';

const VIRTUALIZE_THRESHOLD = 100;

const CELL_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3';

// Shared by the header row and the data rows so columns line up.
const COL = {
  key: 'flex-none w-28 pl-4 pr-2',
  name: 'flex-1 min-w-0 px-2',
  status: 'flex-none w-28 px-2',
  progress: 'flex-none w-36 px-2 flex items-center gap-2',
  dates: 'flex-none w-32 px-2 hidden @[720px]:flex items-center',
  owner: 'flex-none w-60 pl-3 pr-4 hidden @[880px]:flex items-center gap-2',
  effort: 'flex-none w-28 pl-2 pr-4 hidden @[1040px]:flex items-center justify-end',
} as const;

function OwnerCell({
  ownedByID,
  token,
  jiraBaseUrl,
}: {
  ownedByID: string;
  token: string | null;
  jiraBaseUrl: string | undefined;
}) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['jira', jiraBaseUrl, 'user-by-username', ownedByID],
    queryFn: () => fetchJiraUserByUsername(jiraBaseUrl ?? '', token ?? '', ownedByID),
    enabled: !!jiraBaseUrl && !!token && !!ownedByID,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div data-testid="owner-cell" className="flex items-center gap-1.5">
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  const name = user ? user.displayName : ownedByID;
  return (
    <div data-testid="owner-cell" className="flex min-w-0 items-center gap-1.5">
      <CachedAvatar url={user?.avatarUrls?.['48x48'] ?? null} name={name} size={20} />
      <span className="truncate text-xs" title={name}>
        {name}
      </span>
    </div>
  );
}

function ProgressCell({
  summary,
  isLoading,
  statusConfig,
}: {
  summary: AioCycleSummaryItem['summary'] | undefined;
  isLoading: boolean;
  statusConfig: AioTestRunStatusConfig[];
}) {
  if (isLoading && !summary) {
    return (
      <div className={cn(COL.progress, CELL_PADDING)}>
        <div data-testid="progress-bar" className="w-20">
          <Skeleton className="h-1.5 w-20 rounded-full" />
        </div>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className={cn(COL.progress, CELL_PADDING)}>
        <div data-testid="progress-bar" className="w-20 text-xs text-muted-foreground">
          —
        </div>
      </div>
    );
  }

  const { counts, total, passPct } = cycleProgress(summary, statusConfig);
  const segments = (['pass', 'fail', 'blocked', 'inProgress', 'notRun'] as const).filter(
    (k) => counts[k] > 0 && total > 0,
  );
  const rows = progressTooltipRows(counts);

  return (
    <div className={cn(COL.progress, CELL_PADDING)}>
      <Tooltip>
        <TooltipTrigger
          delay={0}
          render={<div />}
          data-testid="progress-bar"
          role="img"
          aria-label={passPct === null ? 'No tests' : `${passPct}% passed of ${total} tests`}
          className="relative z-10 w-20 py-1 -my-1"
        >
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
            {segments.map((k) => (
              <div
                key={k}
                className={cn('h-full', PROGRESS_SEGMENT_CLASS[k])}
                style={{ width: `${(counts[k] / total) * 100}%` }}
              />
            ))}
          </div>
        </TooltipTrigger>
        {rows.length > 0 && (
          <TooltipContent>
            <TooltipBody title={`${total} tests`}>
              {rows.map((r) => (
                <TooltipRow
                  key={r.label}
                  color={r.color}
                  label={r.label}
                  value={r.value}
                  sub={`${Math.round((r.value / total) * 100)}%`}
                />
              ))}
            </TooltipBody>
          </TooltipContent>
        )}
      </Tooltip>
      <span className="pointer-events-none relative w-9 text-right text-xs tabular-nums text-muted-foreground">
        {passPct === null ? '—' : `${passPct}%`}
      </span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex w-full items-center border-b border-border">
          <div className={cn(COL.key, CELL_PADDING)}>
            <Skeleton className="h-4 w-16" />
          </div>
          <div className={cn(COL.name, CELL_PADDING)}>
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className={cn(COL.status, CELL_PADDING)}>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className={cn(COL.progress, CELL_PADDING)}>
            <Skeleton className="h-1.5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AioCycleList({
  projectKey,
  items,
  isLoading,
  isPending,
  error,
  onRetry,
  summaryByID,
  summariesLoading,
  statusConfig,
  token,
  jiraBaseUrl,
  scrollElement,
  filter,
  onClearFilter,
  today,
  progressByID,
}: {
  projectKey: string | undefined;
  items: AioCycleDetailItem[];
  /** Delayed skeleton flag — true only after the 200ms grace period. */
  isLoading: boolean;
  /** No data yet; renders nothing during the grace period instead of the empty state. */
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  summaryByID: Record<number, AioCycleSummaryItem>;
  summariesLoading: boolean;
  statusConfig: AioTestRunStatusConfig[];
  token: string | null;
  jiraBaseUrl: string | undefined;
  /**
   * The page pane that scrolls. When given (null until the pane mounts), the list flows in
   * the page and the virtualizer scrolls that element; when omitted (undefined) the list
   * owns its own scroll container.
   */
  scrollElement?: HTMLElement | null;
  /** Active cross-filter from the dashboard (null = none). */
  filter: CycleFilter | null;
  onClearFilter: () => void;
  /** Shared with the dashboard so both agree on what is overdue. */
  today: string;
  progressByID: Map<number, CycleProgress>;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const statusFilter = useAioCyclesSelectionStore((s) => s.statusFilter);
  const setStatusFilter = useAioCyclesSelectionStore((s) => s.setStatusFilter);

  // Open|All first, then the dashboard cross-filter.
  const scoped = useMemo(
    () => (statusFilter === 'open' ? items.filter((c) => !c.detail.isClosed) : items),
    [items, statusFilter],
  );
  const visible = useMemo(
    () =>
      sortCycles(
        filter
          ? scoped.filter((c) => matchesCycleFilter(c, progressByID.get(c.ID), filter, today))
          : scoped,
      ),
    [scoped, filter, progressByID, today],
  );
  const filterLabel = filter ? cycleFilterLabel(filter) : null;

  const hasDates = visible.some(
    (c) => toDateKey(c.detail.startDate) !== null || toDateKey(c.detail.endDate) !== null,
  );
  const hasEffort = visible.some((c) => {
    const s = summaryByID[c.ID]?.summary;
    return formatEffort(s?.estimatedEffort) !== null || formatEffort(s?.actualEffort) !== null;
  });

  const openCycle = (key: string) => {
    useBreadcrumbStore.getState().push({ label: 'AIO Cycles', path: location.pathname });
    navigate(`/aio-cycle/${projectKey}/${key}`);
  };

  // ~1,300 cycles under "All cycles": render only the rows in view. Small folders keep
  // plain rendering (and stay testable in jsdom, which has no layout).
  const virtualize = visible.length > VIRTUALIZE_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [rowsOffset, setRowsOffset] = useState(0);
  const getScrollEl = useCallback(
    () => (scrollElement !== undefined ? scrollElement : scrollRef.current),
    [scrollElement],
  );
  // Rows' distance from the top of the scroll content. Rect-based so a positioned wrapper
  // between the rows and the scroll element can't change offsetTop's reference frame.
  const measureOffset = useCallback(() => {
    const scrollEl = getScrollEl();
    const rows = rowsRef.current;
    if (!scrollEl || !rows) return;
    const offset = Math.round(
      rows.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop,
    );
    setRowsOffset((prev) => (prev === offset ? prev : offset));
  }, [getScrollEl]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the list mode or the content above it changes
  useLayoutEffect(() => {
    measureOffset();
    const scrollEl = getScrollEl();
    if (!scrollEl || typeof ResizeObserver === 'undefined') return;
    // The dashboard above the list changes height (breakpoint flips, loading -> loaded).
    const ro = new ResizeObserver(measureOffset);
    ro.observe(scrollEl.firstElementChild ?? scrollEl);
    return () => ro.disconnect();
  }, [measureOffset, getScrollEl, virtualize, isLoading, isPending, visible.length]);
  const rowVirtualizer = useVirtualizer({
    count: virtualize ? visible.length : 0,
    getScrollElement: getScrollEl,
    estimateSize: () => 41,
    overscan: 12,
    scrollMargin: rowsOffset,
    getItemKey: (index) => visible[index]?.ID ?? index,
  });

  const renderRow = (cycle: AioCycleDetailItem, virtual?: VirtualItem) => {
    const d = cycle.detail;
    const summary = summaryByID[cycle.ID]?.summary;
    const overdue = isOverdue(d, today);
    const dates = formatCycleDates(d.startDate, d.endDate, today);
    const actual = formatEffort(summary?.actualEffort);
    const estimated = formatEffort(summary?.estimatedEffort);
    return (
      <div
        key={cycle.ID}
        ref={virtual ? rowVirtualizer.measureElement : undefined}
        data-index={virtual?.index}
        data-testid={`cycle-row-${cycle.ID}`}
        style={
          virtual
            ? {
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translateY(${virtual.start - rowVirtualizer.options.scrollMargin}px)`,
              }
            : undefined
        }
        className={cn(
          'group/row relative flex w-full items-center border-b border-border transition-colors hover:bg-muted/30',
          d.isClosed && 'text-muted-foreground',
        )}
      >
        <button
          type="button"
          aria-label={`Open ${d.key} ${d.title}`}
          className="absolute inset-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => openCycle(d.key)}
        />
        <div
          className={cn(
            COL.key,
            CELL_PADDING,
            'pointer-events-none relative whitespace-nowrap font-mono text-xs text-muted-foreground',
          )}
        >
          {d.key}
        </div>
        <div
          className={cn(COL.name, CELL_PADDING, 'pointer-events-none relative truncate text-sm')}
          title={d.title}
        >
          {d.title}
        </div>
        <div className={cn(COL.status, CELL_PADDING, 'pointer-events-none relative')}>
          <div className="flex">
            {d.isClosed ? (
              <span className={aioCycleStatusPillClass('Closed')}>Closed</span>
            ) : overdue ? (
              <span className={`${STATUS_PILL_LAYOUT_CLASS} ${tonePillClass('red')}`}>Overdue</span>
            ) : (
              <span className={aioCycleStatusPillClass('Active')}>Open</span>
            )}
          </div>
        </div>
        <ProgressCell summary={summary} isLoading={summariesLoading} statusConfig={statusConfig} />
        {hasDates && (
          <div
            className={cn(
              COL.dates,
              CELL_PADDING,
              'pointer-events-none relative whitespace-nowrap text-xs tabular-nums text-muted-foreground',
              overdue && 'text-red-600 dark:text-red-400',
            )}
          >
            {dates ?? '—'}
          </div>
        )}
        <div className={cn(COL.owner, CELL_PADDING, 'pointer-events-none relative')}>
          <OwnerCell ownedByID={d.ownedByID} token={token} jiraBaseUrl={jiraBaseUrl} />
        </div>
        {hasEffort && (
          <div
            className={cn(
              COL.effort,
              CELL_PADDING,
              'pointer-events-none relative whitespace-nowrap text-xs tabular-nums text-muted-foreground',
            )}
          >
            {actual ?? '—'} / {estimated ?? '—'}
          </div>
        )}
      </div>
    );
  };

  let body: ReactNode;
  if (isLoading) {
    body = <SkeletonRows />;
  } else if (isPending && !error) {
    body = null;
  } else if (error) {
    body = (
      <div className="p-4">
        <ErrorState error={error} onRetry={onRetry} viewName="cycles" />
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={FlaskConical}
        title="No cycles in this folder"
        subtitle="This folder has no test cycles yet."
      />
    );
  } else if (visible.length === 0 && filter && scoped.length > 0) {
    // The cross-filter (not Open|All) emptied the list.
    body = (
      <EmptyState
        icon={FlaskConical}
        title={`No cycles match ${filterLabel}`}
        action={
          <Button variant="outline" size="sm" onClick={onClearFilter}>
            Clear
          </Button>
        }
      />
    );
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon={FlaskConical}
        title={`All ${items.length} cycles in this folder are closed`}
        action={
          <Button variant="outline" size="sm" onClick={() => setStatusFilter('all')}>
            Show them
          </Button>
        }
      />
    );
  } else {
    body = (
      <div>
        <div
          ref={rowsRef}
          style={
            virtualize
              ? { height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }
              : undefined
          }
        >
          {virtualize
            ? rowVirtualizer.getVirtualItems().map((v) => renderRow(visible[v.index], v))
            : visible.map((cycle) => renderRow(cycle))}
        </div>
      </div>
    );
  }

  const loaded = !isLoading && !isPending && !error;
  const showColumns = loaded && visible.length > 0;

  // One sticky block: list header (label, count, filter chip) + column header, so the
  // virtualized rows line up under it and neither scrolls away.
  const header = (
    <div className="sticky top-0 z-20 bg-background">
      <div
        className={cn(
          'flex min-h-9 items-center gap-2 px-4 py-1.5',
          // Lighter than the section border: this is a sub-divider.
          !showColumns && 'border-b border-border/50',
        )}
      >
        <span className="text-sm font-medium">Cycles</span>
        {loaded && (
          <span
            data-testid="cycle-visible-count"
            className="text-xs tabular-nums text-muted-foreground"
          >
            {visible.length}
          </span>
        )}
        {filterLabel && (
          <span
            data-testid="cycle-filter-chip"
            className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-2.5 pr-1 text-xs"
          >
            <span className="truncate pr-0.5">{filterLabel}</span>
            <button
              type="button"
              aria-label="Clear filter"
              onClick={onClearFilter}
              className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3" />
            </button>
          </span>
        )}
      </div>
      {showColumns && (
        <div className="flex w-full items-center border-b border-border text-xs font-medium text-muted-foreground">
          <div className={cn(COL.key, CELL_PADDING)}>Key</div>
          <div className={cn(COL.name, CELL_PADDING)}>Name</div>
          <div className={cn(COL.status, CELL_PADDING)}>Status</div>
          <div className={cn(COL.progress, CELL_PADDING)}>Progress</div>
          {hasDates && <div className={cn(COL.dates, CELL_PADDING)}>Dates</div>}
          <div className={cn(COL.owner, CELL_PADDING)}>Owner</div>
          {hasEffort && <div className={cn(COL.effort, CELL_PADDING)}>Effort</div>}
        </div>
      )}
    </div>
  );

  if (scrollElement !== undefined) {
    return (
      <div className="@container min-w-0">
        {header}
        {body}
      </div>
    );
  }
  return (
    <div className="@container flex min-w-0 flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        {header}
        {body}
      </div>
    </div>
  );
}
