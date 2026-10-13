import { useQueries } from '@tanstack/react-query';
import { type ReactNode, useId } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  type CycleScope,
  DUE_SOON_DAYS,
  type OwnerStat,
  PROGRESS_SEGMENT_CLASS,
  progressTooltipRows,
  type ScheduleBucket,
  type StatusKey,
  statusLabel,
} from '@/lib/aio-cycle-list';
import { formatDateKey } from '@/lib/epic-progress';
import { cn } from '@/lib/utils';
import { fetchJiraUserByUsername } from '@/services/jira/users';
import { SMALL_TEXT, STAT_CARD_CLASS, StatCardBody } from './issue-detail/EpicStatCard';

const STATUS_ORDER: StatusKey[] = ['pass', 'fail', 'blocked', 'inProgress', 'notRun'];

/** Fixed body height shared by the three chart cards in every state (data, skeleton, empty). */
const CHART_BODY_CLASS = 'h-[184px] overflow-hidden';
/** Pixel height of the tallest schedule column. */
const SCHEDULE_BAR_MAX_PX = 84;

/** Read-only rows: hover shows the tooltip, nothing is clickable. */
const HOVER_ROW_CLASS = 'rounded-sm hover:bg-accent/40';

// ─── KPI tiles ───────────────────────────────────────────────────────────────

function TileShell({ children }: { children: ReactNode }) {
  return (
    <Card size="sm">
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TileSkeleton({ testId }: { testId: string }) {
  return (
    <TileShell>
      <div data-testid={testId} className={cn(STAT_CARD_CLASS, 'items-center')}>
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-7 w-14 self-center" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </TileShell>
  );
}

function Tile({
  testId,
  label,
  value,
  sub,
  tip,
}: {
  testId: string;
  label: string;
  value: ReactNode;
  sub: ReactNode;
  tip: ReactNode;
}) {
  return (
    <TileShell>
      <Tooltip>
        <TooltipTrigger delay={0} render={<div />} data-testid={testId} className={STAT_CARD_CLASS}>
          <StatCardBody label={label} value={value} sub={sub} />
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TileShell>
  );
}

const VALUE_CLASS = 'truncate text-lg font-semibold leading-none tabular-nums';

function MiniStatusBar({ scope }: { scope: CycleScope }) {
  const { counts, total } = scope.exec;
  return (
    <span className="flex h-1.5 w-16 flex-none overflow-hidden rounded-full bg-muted" aria-hidden>
      {STATUS_ORDER.filter((k) => counts[k] > 0 && total > 0).map((k) => (
        <span
          key={k}
          className={cn('h-full', PROGRESS_SEGMENT_CLASS[k])}
          style={{ width: `${(counts[k] / total) * 100}%` }}
        />
      ))}
    </span>
  );
}

// ─── chart cards ─────────────────────────────────────────────────────────────

function ChartCard({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Card size="sm" role="region" aria-labelledby={id} data-testid={testId}>
      <CardHeader>
        <CardTitle id={id} role="heading" aria-level={2}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={CHART_BODY_CLASS}>{children}</CardContent>
    </Card>
  );
}

function EmptyBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function ExecutionMixBody({ scope }: { scope: CycleScope }) {
  const { exec } = scope;
  if (exec.total === 0) return <EmptyBody>No test runs</EmptyBody>;
  const rows = STATUS_ORDER.filter((k) => exec.counts[k] > 0);
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex h-3 w-full flex-none overflow-hidden rounded-full bg-muted">
        {rows.map((k) => (
          <div
            key={k}
            className={cn('h-full', PROGRESS_SEGMENT_CLASS[k])}
            style={{ width: `${(exec.counts[k] / exec.total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-col">
        {rows.map((k) => {
          const pct = Math.round((exec.counts[k] / exec.total) * 100);
          return (
            <Tooltip key={k}>
              <TooltipTrigger
                delay={0}
                render={<div />}
                data-testid={`exec-row-${k}`}
                className={cn('flex h-6 w-full items-center gap-2 px-1 text-xs', HOVER_ROW_CLASS)}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2 flex-none rounded-[2px] ring-1 ring-inset ring-foreground/10',
                    PROGRESS_SEGMENT_CLASS[k],
                  )}
                />
                <span className="min-w-0 flex-1 truncate pr-0.5 text-left">{statusLabel(k)}</span>
                <span className="tabular-nums">{exec.counts[k]}</span>
                <span className="w-9 text-right tabular-nums text-muted-foreground">{pct}%</span>
              </TooltipTrigger>
              <TooltipContent>
                <TooltipBody title={statusLabel(k)}>
                  <TooltipRow label="Test runs" value={exec.counts[k]} />
                  <TooltipRow label="Of all runs" value={`${pct}%`} />
                  <TooltipRow label="Cycles" value={exec.cyclesWithStatus[k]} />
                </TooltipBody>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function OwnersBody({
  scope,
  names,
}: {
  scope: CycleScope;
  names: Map<string, { name: string; avatar: string | null }>;
}) {
  if (scope.owners.length === 0) return <EmptyBody>No owners</EmptyBody>;
  const max = Math.max(...scope.owners.map((o) => o.count), 1);
  const resolve = (o: OwnerStat) => names.get(o.ownerId) ?? { name: o.ownerId, avatar: null };
  return (
    <div className="flex h-full flex-col">
      {scope.owners.map((o) => {
        const { name, avatar } = resolve(o);
        const passPct = o.runTotal > 0 ? `${Math.round((o.pass / o.runTotal) * 100)}%` : '—';
        return (
          <Tooltip key={o.ownerId}>
            <TooltipTrigger
              delay={0}
              render={<div />}
              data-testid={`owner-row-${o.ownerId}`}
              className={cn(
                'flex h-6 w-full flex-none items-center gap-2 px-1 text-xs',
                HOVER_ROW_CLASS,
              )}
            >
              <span className="flex w-32 min-w-0 flex-none items-center gap-1.5">
                <CachedAvatar url={avatar} name={name} size={20} />
                <span className="truncate pr-0.5 text-left">{name}</span>
              </span>
              <span className="flex h-2 min-w-0 flex-1" aria-hidden>
                <span
                  className="flex h-full overflow-hidden rounded-full bg-muted/50"
                  style={{ width: `${(o.count / max) * 100}%` }}
                >
                  <span
                    className="h-full bg-foreground/20"
                    style={{ width: `${((o.count - o.overdue) / o.count) * 100}%` }}
                  />
                  <span
                    className="h-full bg-red-500"
                    style={{ width: `${(o.overdue / o.count) * 100}%` }}
                  />
                </span>
              </span>
              <span className="w-6 flex-none text-right tabular-nums">{o.count}</span>
            </TooltipTrigger>
            <TooltipContent>
              <TooltipBody title={name}>
                <TooltipRow label="Open" value={o.open} />
                <TooltipRow label="Closed" value={o.closed} />
                <TooltipRow label="Overdue" value={o.overdue} />
                <TooltipRow label="Pass rate" value={passPct} />
              </TooltipBody>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {scope.othersCount > 0 && (
        <span className="px-1 pt-1 text-[11px] leading-4 text-muted-foreground">
          +{scope.othersCount} others
        </span>
      )}
    </div>
  );
}

function bucketLabel(b: ScheduleBucket): string {
  if (b.kind === 'overdue') return 'Late';
  if (b.kind === 'later') return '8w+';
  return b.weekStart ? String(Number(b.weekStart.slice(8))) : '';
}

function ScheduleBody({ scope }: { scope: CycleScope }) {
  const max = Math.max(...scope.weeks.map((w) => w.count), 1);
  return (
    <div className="flex h-full flex-col">
      {scope.hasEndDates ? (
        <div className="flex h-[148px] flex-none items-end gap-1">
          {scope.weeks.map((b, i) => {
            const height =
              b.count > 0 ? Math.max(2, Math.round((b.count / max) * SCHEDULE_BAR_MAX_PX)) : 0;
            const prev = scope.weeks[i - 1];
            const monthLabel =
              b.kind === 'week' &&
              b.weekStart &&
              (i === 1 || prev?.weekStart?.slice(5, 7) !== b.weekStart.slice(5, 7))
                ? formatDateKey(b.weekStart).split(' ')[0]
                : null;
            const title =
              b.kind === 'overdue'
                ? 'Overdue'
                : b.kind === 'later'
                  ? 'Later'
                  : `${formatDateKey(b.weekStart ?? '')} – ${formatDateKey(b.weekEnd ?? '')}`;
            return (
              <Tooltip key={`${b.kind}-${b.weekStart ?? ''}`}>
                <TooltipTrigger
                  delay={0}
                  render={<div />}
                  data-testid={`schedule-col-${b.kind === 'week' ? b.weekStart : b.kind}`}
                  aria-label={`${title}: ${b.count} cycles`}
                  className={cn(
                    'flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-0.5',
                    HOVER_ROW_CLASS,
                  )}
                >
                  <span className={cn(SMALL_TEXT, 'h-4 leading-4 tabular-nums')}>
                    {b.count > 0 ? b.count : ''}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'w-full rounded-sm',
                      b.kind === 'overdue'
                        ? 'bg-red-500'
                        : b.kind === 'later'
                          ? 'bg-foreground/15'
                          : i === 1
                            ? 'bg-foreground/45'
                            : 'bg-foreground/25',
                    )}
                    style={{ height }}
                  />
                  <span
                    className={cn(
                      'flex h-7 flex-col items-center text-[10px] leading-3.5 tabular-nums text-muted-foreground',
                    )}
                  >
                    <span>{bucketLabel(b)}</span>
                    <span>{monthLabel ?? ''}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <TooltipBody
                    title={title}
                    note={b.keys.length > 0 ? b.keys.join(', ') : undefined}
                  >
                    <TooltipRow label="Cycles" value={b.count} />
                  </TooltipBody>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ) : (
        <div className="h-[148px] flex-none">
          <EmptyBody>No end dates set</EmptyBody>
        </div>
      )}
      <div className="flex h-6 flex-none items-center">
        {scope.noEndDate > 0 && (
          <span
            data-testid="schedule-no-dates"
            className="px-1 text-[11px] leading-4 text-muted-foreground"
          >
            {scope.noEndDate} without end date
          </span>
        )}
      </div>
    </div>
  );
}

// ─── dashboard ───────────────────────────────────────────────────────────────

export function AioCyclesDashboard({
  scope,
  loading,
  summariesLoading,
  token,
  jiraBaseUrl,
}: {
  scope: CycleScope | null;
  /** Cycles still pending: every tile and card is a skeleton. */
  loading: boolean;
  /** Summaries still loading: only the Pass rate tile and Execution mix are skeletons. */
  summariesLoading: boolean;
  token: string | null;
  jiraBaseUrl: string | undefined;
}) {
  // Same key, queryFn and staleTime as the list's OwnerCell, so the cache is shared.
  const ownerQueries = useQueries({
    queries: (scope?.owners ?? []).map((o) => ({
      queryKey: ['jira', jiraBaseUrl, 'user-by-username', o.ownerId],
      queryFn: () => fetchJiraUserByUsername(jiraBaseUrl ?? '', token ?? '', o.ownerId),
      enabled: !!jiraBaseUrl && !!token && !!o.ownerId,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const names = new Map<string, { name: string; avatar: string | null }>();
  (scope?.owners ?? []).forEach((o, i) => {
    const user = ownerQueries[i]?.data;
    if (user)
      names.set(o.ownerId, { name: user.displayName, avatar: user.avatarUrls?.['48x48'] ?? null });
  });

  const showSkeleton = loading || !scope;
  const execSkeleton = showSkeleton || summariesLoading;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
        {showSkeleton || !scope ? (
          <>
            <TileSkeleton testId="tile-skeleton-open" />
            <TileSkeleton testId="tile-skeleton-overdue" />
            <TileSkeleton testId="tile-skeleton-due" />
            <TileSkeleton testId="tile-skeleton-pass" />
          </>
        ) : (
          <>
            <Tile
              testId="tile-open"
              label="Open cycles"
              value={<span className={VALUE_CLASS}>{scope.openCount}</span>}
              sub={<span className="truncate">of {scope.total} in scope</span>}
              tip={
                <TooltipBody title="Open cycles">
                  <TooltipRow label="Open" value={scope.openCount} />
                  <TooltipRow label="Overdue" value={scope.overdue.count} />
                  <TooltipRow label={`Due in ${DUE_SOON_DAYS} days`} value={scope.dueSoon.count} />
                  <TooltipRow label="No end date" value={scope.noEndDate} />
                </TooltipBody>
              }
            />
            <Tile
              testId="tile-overdue"
              label="Overdue"
              value={
                <span
                  className={cn(
                    VALUE_CLASS,
                    scope.overdue.count > 0 && 'text-red-600 dark:text-red-400',
                  )}
                >
                  {scope.overdue.count}
                </span>
              }
              sub={
                scope.overdue.oldestDaysLate === null ? (
                  <span>—</span>
                ) : (
                  <span className="truncate">oldest {scope.overdue.oldestDaysLate}d late</span>
                )
              }
              tip={
                <TooltipBody
                  title="Overdue"
                  note={scope.overdue.count > 3 ? `+${scope.overdue.count - 3} more` : undefined}
                >
                  {scope.overdue.top.length === 0 ? (
                    <TooltipRow label="Nothing overdue" value="—" />
                  ) : (
                    scope.overdue.top.map((t) => (
                      <TooltipRow key={t.key} label={t.key} value={`${t.daysLate}d late`} />
                    ))
                  )}
                </TooltipBody>
              }
            />
            <Tile
              testId="tile-due"
              label={`Due in ${DUE_SOON_DAYS} days`}
              value={<span className={VALUE_CLASS}>{scope.dueSoon.count}</span>}
              sub={
                scope.dueSoon.nextDate ? (
                  <span className="truncate">next: {formatDateKey(scope.dueSoon.nextDate)}</span>
                ) : (
                  <span>—</span>
                )
              }
              tip={
                <TooltipBody
                  title={`Due in ${DUE_SOON_DAYS} days`}
                  note={scope.dueSoon.count > 4 ? `+${scope.dueSoon.count - 4} more` : undefined}
                >
                  {scope.dueSoon.top.length === 0 ? (
                    <TooltipRow label="Nothing due" value="—" />
                  ) : (
                    scope.dueSoon.top.map((t) => (
                      <TooltipRow key={t.key} label={t.key} value={formatDateKey(t.date)} />
                    ))
                  )}
                </TooltipBody>
              }
            />
            {summariesLoading ? (
              <TileSkeleton testId="tile-skeleton-pass" />
            ) : (
              <Tile
                testId="tile-pass"
                label="Pass rate"
                value={
                  <span className={VALUE_CLASS}>
                    {scope.exec.passPct === null ? '—' : `${scope.exec.passPct}%`}
                  </span>
                }
                sub={
                  <>
                    <MiniStatusBar scope={scope} />
                    <span className="truncate tabular-nums">
                      {scope.exec.executed}/{scope.exec.total} run
                    </span>
                  </>
                }
                tip={
                  <TooltipBody title={`${scope.exec.total} test runs`}>
                    {progressTooltipRows(scope.exec.counts).map((r) => (
                      <TooltipRow key={r.label} color={r.color} label={r.label} value={r.value} />
                    ))}
                  </TooltipBody>
                }
              />
            )}
          </>
        )}
      </div>

      <div className="grid gap-4 @4xl:grid-cols-3">
        <ChartCard title="Execution mix" testId="card-exec">
          {execSkeleton || !scope ? (
            <Skeleton data-testid="card-skeleton-exec" className="h-full w-full" />
          ) : (
            <ExecutionMixBody scope={scope} />
          )}
        </ChartCard>
        <ChartCard title="By owner" testId="card-owners">
          {showSkeleton || !scope ? (
            <Skeleton data-testid="card-skeleton-owners" className="h-full w-full" />
          ) : (
            <OwnersBody scope={scope} names={names} />
          )}
        </ChartCard>
        <ChartCard title="Schedule" testId="card-schedule">
          {showSkeleton || !scope ? (
            <Skeleton data-testid="card-skeleton-schedule" className="h-full w-full" />
          ) : (
            <ScheduleBody scope={scope} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
