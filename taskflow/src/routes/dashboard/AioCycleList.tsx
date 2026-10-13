import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  cycleProgress,
  formatCycleDates,
  formatEffort,
  isOverdue,
  PROGRESS_SEGMENT_CLASS,
  progressTooltipRows,
  sortCycles,
  toDateKey,
} from '@/lib/aio-cycle-list';
import { toLocalDateString } from '@/lib/local-date';
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

const CELL_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3';

// Shared by the header row and the data rows so columns line up.
const COL = {
  key: 'flex-none w-28 pl-4 pr-2',
  name: 'flex-1 min-w-0 px-2',
  status: 'flex-none w-28 px-2',
  progress: 'flex-none w-36 px-2 flex items-center gap-2',
  dates: 'flex-none w-32 px-2 hidden @[720px]:flex items-center',
  owner: 'flex-none w-36 px-2 hidden @[880px]:flex items-center gap-1.5',
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
  folderLabel,
  folderTitle,
  items,
  isLoading,
  error,
  onRetry,
  summaryByID,
  summariesLoading,
  statusConfig,
  token,
  jiraBaseUrl,
}: {
  projectKey: string | undefined;
  folderLabel: string;
  folderTitle: string;
  items: AioCycleDetailItem[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  summaryByID: Record<number, AioCycleSummaryItem>;
  summariesLoading: boolean;
  statusConfig: AioTestRunStatusConfig[];
  token: string | null;
  jiraBaseUrl: string | undefined;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const statusFilter = useAioCyclesSelectionStore((s) => s.statusFilter);
  const setStatusFilter = useAioCyclesSelectionStore((s) => s.setStatusFilter);
  const today = toLocalDateString(new Date());

  const closedCount = items.filter((c) => c.detail.isClosed).length;
  const openCount = items.length - closedCount;

  const visible = useMemo(
    () => sortCycles(statusFilter === 'open' ? items.filter((c) => !c.detail.isClosed) : items),
    [items, statusFilter],
  );

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

  let body: ReactNode;
  if (isLoading) {
    body = <SkeletonRows />;
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
        <div className="sticky top-0 z-20 flex w-full items-center border-b border-border bg-background text-xs font-medium text-muted-foreground">
          <div className={cn(COL.key, CELL_PADDING)}>Key</div>
          <div className={cn(COL.name, CELL_PADDING)}>Name</div>
          <div className={cn(COL.status, CELL_PADDING)}>Status</div>
          <div className={cn(COL.progress, CELL_PADDING)}>Progress</div>
          {hasDates && <div className={cn(COL.dates, CELL_PADDING)}>Dates</div>}
          <div className={cn(COL.owner, CELL_PADDING)}>Owner</div>
          {hasEffort && <div className={cn(COL.effort, CELL_PADDING)}>Effort</div>}
        </div>
        {visible.map((cycle) => {
          const d = cycle.detail;
          const summary = summaryByID[cycle.ID]?.summary;
          const overdue = isOverdue(d, today);
          const dates = formatCycleDates(d.startDate, d.endDate, today);
          const actual = formatEffort(summary?.actualEffort);
          const estimated = formatEffort(summary?.estimatedEffort);
          return (
            <div
              key={cycle.ID}
              data-testid={`cycle-row-${cycle.ID}`}
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
                  'relative z-10 cursor-text select-text whitespace-nowrap font-mono text-xs text-muted-foreground',
                )}
              >
                {d.key}
              </div>
              <div
                className={cn(
                  COL.name,
                  CELL_PADDING,
                  'pointer-events-none relative truncate text-sm',
                )}
                title={d.title}
              >
                {d.title}
              </div>
              <div className={cn(COL.status, CELL_PADDING, 'pointer-events-none relative')}>
                <div className="flex">
                  {d.isClosed ? (
                    <span className={aioCycleStatusPillClass('Closed')}>Closed</span>
                  ) : overdue ? (
                    <span className={`${STATUS_PILL_LAYOUT_CLASS} ${tonePillClass('red')}`}>
                      Overdue
                    </span>
                  ) : (
                    <span className={aioCycleStatusPillClass('Active')}>Open</span>
                  )}
                </div>
              </div>
              <ProgressCell
                summary={summary}
                isLoading={summariesLoading}
                statusConfig={statusConfig}
              />
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
        })}
      </div>
    );
  }

  return (
    <div className="@container flex min-w-0 flex-1 flex-col overflow-auto">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="truncate text-sm font-medium" title={folderTitle}>
          {folderLabel}
        </span>
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {openCount} open · {closedCount} closed
        </span>
        <fieldset className="m-0 ml-auto inline-flex rounded-lg border-0 bg-muted p-0.5">
          <legend className="sr-only">Cycle status</legend>
          {(
            [
              { value: 'open', label: 'Open' },
              { value: 'all', label: 'All' },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                statusFilter === value
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </div>
      {body}
    </div>
  );
}
