import { Bug, ChevronDown, ChevronUp, FlaskConical, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { PROGRESS_SEGMENT_CLASS, type StatusKey, toDateKey } from '@/lib/aio-cycle-list';
import { normalizeStatus, normalizeStatusLabel } from '@/lib/aioUtils';
import { formatDateKey } from '@/lib/epic-progress';
import { aioRunStatusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { AioTestRun } from '@/services/aio';
import { UserChip } from './UserChip';

type SortKey = 'key' | 'status' | 'defects' | 'runs' | 'assignee' | 'executed';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'ALL' | StatusKey;

const CELL_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3';

// Shared by the header row and the data rows so columns line up. Runs, assignee and date
// drop (in that order) as the container narrows, so a row is always exactly one line.
const COL = {
  key: 'flex-none w-28 pl-4 pr-2',
  title: 'flex-1 min-w-0 px-2',
  status: 'flex-none w-28 px-2',
  defects: 'flex-none w-14 px-2 flex items-center',
  runs: 'flex-none w-12 px-2 hidden @[880px]:flex items-center',
  assignee: 'flex-none w-44 px-2 hidden @[720px]:flex items-center',
  executed: 'flex-none w-24 pl-2 pr-4 hidden @[560px]:flex items-center justify-end',
} as const;

const CHIPS: { value: Exclude<StatusFilter, 'ALL'>; label: string }[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'notRun', label: 'Not run' },
  { value: 'inProgress', label: 'In progress' },
];

// Attention-first when ascending: failing work surfaces at the top.
const STATUS_RANK: Record<StatusKey, number> = {
  fail: 0,
  blocked: 1,
  inProgress: 2,
  notRun: 3,
  pass: 4,
};

function timeOf(run: AioTestRun): number | null {
  const raw = run.executedDate ?? run.testCase?.updatedDate;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

function sortValue(run: AioTestRun, key: SortKey): string | number | null {
  switch (key) {
    case 'key':
      return run.testCaseKey || null;
    case 'status':
      return STATUS_RANK[normalizeStatus(run.status)];
    case 'defects':
      return run.jiraDefectIDs?.length ?? 0;
    case 'runs':
      return run.runCount ?? null;
    case 'assignee':
      return run.assignedToID || null;
    case 'executed':
      return timeOf(run);
  }
}

function formatRunDate(run: AioTestRun): string | null {
  const raw = run.executedDate ?? run.testCase?.updatedDate;
  const key = toDateKey(raw);
  return key ? formatDateKey(key) : null;
}

function SortHeader({
  sortKey,
  label,
  className,
  activeKey,
  activeDir,
  onSort,
}: {
  sortKey: SortKey;
  label: string;
  className: string;
  activeKey: SortKey | null;
  activeDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <div className={className}>
      <button
        type="button"
        data-testid={`executions-sort-${sortKey}`}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {active &&
          (activeDir === 'asc' ? (
            <ChevronUp className="size-3" data-testid={`executions-sort-indicator-${sortKey}`} />
          ) : (
            <ChevronDown className="size-3" data-testid={`executions-sort-indicator-${sortKey}`} />
          ))}
      </button>
    </div>
  );
}

function RunRow({
  run,
  onOpenRun,
  jiraBaseUrl,
  token,
}: {
  run: AioTestRun;
  onOpenRun: (run: AioTestRun) => void;
  jiraBaseUrl: string | null | undefined;
  token: string | null | undefined;
}) {
  const norm = normalizeStatus(run.status);
  const clickable = !!run.id;
  const defects = run.jiraDefectIDs?.length ?? 0;
  const date = formatRunDate(run);
  const title = run.testCase?.title ?? run.testCaseKey;

  return (
    <div
      data-testid={`run-row-${run.id}`}
      className={cn(
        'group/row relative flex w-full items-center border-b border-border transition-colors',
        clickable ? 'hover:bg-muted/30' : 'opacity-70',
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-1', PROGRESS_SEGMENT_CLASS[norm])}
      />
      {clickable && (
        <button
          type="button"
          aria-label={`Open run for ${run.testCaseKey || title}`}
          className="absolute inset-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onOpenRun(run)}
        />
      )}
      <div
        className={cn(
          COL.key,
          CELL_PADDING,
          'pointer-events-none relative whitespace-nowrap font-mono text-xs text-muted-foreground',
        )}
      >
        {run.testCaseKey}
      </div>
      <div className={cn(COL.title, CELL_PADDING, 'pointer-events-none relative truncate text-sm')}>
        <span title={title}>{title}</span>
      </div>
      <div className={cn(COL.status, CELL_PADDING, 'pointer-events-none relative')}>
        <div className="flex">
          <span className={aioRunStatusPillClass(run.status)}>
            {normalizeStatusLabel(run.status)}
          </span>
        </div>
      </div>
      <div
        className={cn(
          COL.defects,
          CELL_PADDING,
          'pointer-events-none relative gap-1 text-xs tabular-nums',
        )}
      >
        {defects > 0 && (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <Bug className="size-3.5" aria-hidden />
            {defects}
          </span>
        )}
      </div>
      <div
        className={cn(
          COL.runs,
          CELL_PADDING,
          'pointer-events-none relative text-xs tabular-nums text-muted-foreground',
        )}
      >
        {(run.runCount ?? 0) > 1 ? `×${run.runCount}` : null}
      </div>
      <div
        className={cn(
          COL.assignee,
          CELL_PADDING,
          'pointer-events-none relative text-xs text-muted-foreground',
        )}
      >
        {run.assignedToID ? (
          <UserChip userId={run.assignedToID} jiraBaseUrl={jiraBaseUrl} token={token} size={18} />
        ) : null}
      </div>
      <div
        className={cn(
          COL.executed,
          CELL_PADDING,
          'pointer-events-none relative whitespace-nowrap text-xs text-muted-foreground',
        )}
      >
        {date}
      </div>
    </div>
  );
}

/**
 * Executions tab: search + single-select status chips with counts, sortable header and
 * one-line flex rows with a status rail. Rows without a run id are muted and not clickable.
 */
export function ExecutionsList({
  runs,
  isLoading,
  isError,
  error,
  onRetry,
  onOpenRun,
  jiraBaseUrl,
  token,
}: {
  runs: AioTestRun[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onOpenRun: (run: AioTestRun) => void;
  jiraBaseUrl: string | null | undefined;
  token: string | null | undefined;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = { pass: 0, fail: 0, blocked: 0, notRun: 0, inProgress: 0 };
    for (const r of runs ?? []) c[normalizeStatus(r.status)] += 1;
    return c;
  }, [runs]);

  const chips = useMemo(
    () => [
      { value: 'ALL' as StatusFilter, label: 'All', count: runs?.length ?? 0 },
      ...CHIPS.filter((c) => c.value !== 'inProgress' || counts.inProgress > 0).map((c) => ({
        value: c.value as StatusFilter,
        label: c.label,
        count: counts[c.value],
      })),
    ],
    [runs, counts],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (runs ?? []).filter((r) => {
      if (statusFilter !== 'ALL' && normalizeStatus(r.status) !== statusFilter) return false;
      if (!q) return true;
      return (
        r.testCaseKey.toLowerCase().includes(q) ||
        (r.testCase?.title ?? '').toLowerCase().includes(q)
      );
    });
    if (sortKey === null) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // missing values stay at the bottom in both directions
      if (bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [runs, query, statusFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  };

  const moveChip = (from: number, delta: number) => {
    const next = (from + delta + chips.length) % chips.length;
    setStatusFilter(chips[next].value);
    chipRefs.current[next]?.focus();
  };

  if (isError && !runs) {
    return (
      <div className="p-4">
        <ErrorState error={error} onRetry={onRetry} viewName="executions" />
      </div>
    );
  }

  const sortProps = { activeKey: sortKey, activeDir: sortDir, onSort: handleSort };
  const headerCell = cn(CELL_PADDING, 'text-xs font-medium text-muted-foreground');

  return (
    <div className="@container flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 density-compact:py-1.5 density-comfortable:py-3">
        <div className="relative w-64 max-w-full">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search test cases…"
            aria-label="Search test cases"
            className="w-full rounded-md border bg-background py-1 pl-8 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {chips.map((chip, i) => {
            const checked = statusFilter === chip.value;
            return (
              // biome-ignore lint/a11y/useSemanticElements: styled chip button in a radiogroup; native radio inputs cannot take this layout
              <button
                key={chip.value}
                ref={(el) => {
                  chipRefs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                onClick={() => setStatusFilter(chip.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    moveChip(i, 1);
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    moveChip(i, -1);
                  }
                }}
                className={cn(
                  'inline-flex h-6 select-none items-center rounded-full border px-2.5 text-xs font-medium transition-colors',
                  checked
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {chip.label} <span className="ml-1 tabular-nums opacity-70">{chip.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && !runs ? (
        <div data-testid="runs-table-skeleton" className="flex flex-col">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-2.5">
              <Skeleton className="h-3.5 w-20 flex-none" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-5 w-24 flex-none" />
            </div>
          ))}
        </div>
      ) : runs !== undefined && runs.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No test runs found"
          subtitle="No test runs have been recorded for this cycle yet."
        />
      ) : visible.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          No runs match the selected filters. Try another status or adjust the search.
        </p>
      ) : (
        <div>
          <div className="sticky top-(--aio-sticky-top) z-10 flex w-full items-center border-b bg-[color-mix(in_oklab,var(--color-muted)_10%,var(--color-background))]">
            <SortHeader
              sortKey="key"
              label="Key"
              className={cn(COL.key, headerCell)}
              {...sortProps}
            />
            <div className={cn(COL.title, headerCell)}>Title</div>
            <SortHeader
              sortKey="status"
              label="Status"
              className={cn(COL.status, headerCell)}
              {...sortProps}
            />
            <SortHeader
              sortKey="defects"
              label="Defects"
              className={cn(COL.defects, headerCell)}
              {...sortProps}
            />
            <SortHeader
              sortKey="runs"
              label="Runs"
              className={cn(COL.runs, headerCell)}
              {...sortProps}
            />
            <SortHeader
              sortKey="assignee"
              label="Assignee"
              className={cn(COL.assignee, headerCell)}
              {...sortProps}
            />
            <SortHeader
              sortKey="executed"
              label="Executed"
              className={cn(COL.executed, headerCell)}
              {...sortProps}
            />
          </div>
          {visible.map((run, i) => (
            <RunRow
              key={run.id || `${run.testCaseKey}-${i}`}
              run={run}
              onOpenRun={onOpenRun}
              jiraBaseUrl={jiraBaseUrl}
              token={token}
            />
          ))}
        </div>
      )}
    </div>
  );
}
