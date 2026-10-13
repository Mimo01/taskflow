import { useQueries } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CheckCircle2,
  FlaskConical,
  Folder,
  ListChecks,
  PlayCircle,
} from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  addDaysKey,
  type CycleFilter,
  type CycleScope,
  type CycleStage,
  DEADLINE_LABEL,
  type DeadlineKey,
  DUE_SOON_DAYS,
  deadlineFilter,
  type OwnerStat,
  progressTooltipRows,
  STAGE_LABEL,
  type StatusKey,
  statusLabel,
} from '@/lib/aio-cycle-list';
import { formatDateKey } from '@/lib/epic-progress';
import { cn } from '@/lib/utils';
import { fetchJiraUserByUsername } from '@/services/jira/users';

const STATUS_ORDER: StatusKey[] = ['pass', 'fail', 'blocked', 'inProgress', 'notRun'];
const STAGE_ORDER: CycleStage[] = ['notStarted', 'inProgress', 'done', 'noTests'];
const DEADLINE_ORDER: DeadlineKey[] = ['overdue', 'week', 'next', 'month', 'later', 'none'];

/** "Nothing happened yet" fill: a theme-aware mid grey that still reads as a bar. */
const PENDING_COLOR = 'color-mix(in oklab, var(--color-muted-foreground) 45%, transparent)';
const EMPTY_COLOR = 'color-mix(in oklab, var(--color-muted-foreground) 18%, transparent)';

/** Colour = status meaning. Same values in bars, the donut and tooltip swatches. */
const STATUS_COLOR: Record<StatusKey, string> = {
  pass: 'var(--color-green-500)',
  fail: 'var(--color-red-500)',
  blocked: 'var(--color-orange-400)',
  inProgress: 'var(--color-blue-500)',
  notRun: PENDING_COLOR,
};
const STAGE_COLOR: Record<CycleStage, string> = {
  notStarted: PENDING_COLOR,
  inProgress: 'var(--color-blue-500)',
  done: 'var(--color-green-500)',
  noTests: EMPTY_COLOR,
};
/** Urgency: red (late) → amber (soon) → blue (planned) → grey (unplanned). */
const DEADLINE_COLOR: Record<DeadlineKey, string> = {
  overdue: 'var(--color-red-500)',
  week: 'var(--color-amber-500)',
  next: 'var(--color-amber-300)',
  month: 'var(--color-blue-400)',
  later: 'var(--color-blue-300)',
  none: PENDING_COLOR,
};

/** Fixed body height shared by the four chart cards in every state (data, skeleton, empty). */
const CHART_BODY_CLASS = 'h-[188px]';

const FOCUS_RING_CLASS =
  'rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
/** One clickable chart row: 28px, hover + pressed tint. */
const ROW_CLASS = 'flex h-7 w-full flex-none items-center gap-2.5 px-1.5 text-xs';

export function sameFilter(a: CycleFilter | null, b: CycleFilter | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'owner':
      return b.kind === 'owner' && a.ownerId === b.ownerId;
    case 'status':
      return b.kind === 'status' && a.status === b.status;
    case 'due':
      return b.kind === 'due' && a.bucket === b.bucket;
    case 'stage':
      return b.kind === 'stage' && a.stage === b.stage;
    default:
      return true;
  }
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function Swatch({ color }: { color: string }) {
  return (
    <span aria-hidden className="size-2.5 flex-none rounded-[3px]" style={{ background: color }} />
  );
}

// ─── KPI tiles ───────────────────────────────────────────────────────────────

type Tone = 'blue' | 'red' | 'amber' | 'green' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  blue: 'bg-blue-500/12 text-blue-600 dark:text-blue-400',
  red: 'bg-red-500/12 text-red-600 dark:text-red-400',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  green: 'bg-green-500/12 text-green-600 dark:text-green-400',
  neutral: 'bg-muted text-muted-foreground',
};

const TILE_CLASS = 'flex h-[76px] w-full min-w-0 items-start gap-3 px-4 py-3 text-left';

function TileIcon({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 flex-none items-center justify-center rounded-lg',
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}

function TileSkeleton({ testId }: { testId: string }) {
  return (
    <Card className="py-0">
      <div data-testid={testId} className={TILE_CLASS}>
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="size-9 rounded-lg" />
      </div>
    </Card>
  );
}

function Tile({
  testId,
  label,
  value,
  valueClass,
  sub,
  tip,
  tone,
  icon,
  pressed,
  onClick,
}: {
  testId: string;
  label: string;
  value: ReactNode;
  valueClass?: string;
  sub: ReactNode;
  tip: ReactNode;
  tone: Tone;
  icon: ReactNode;
  /** undefined = not a filter (no aria-pressed, default cursor). */
  pressed?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card className={cn('py-0 transition-shadow', pressed && 'ring-2 ring-primary/60')}>
      <Tooltip>
        <TooltipTrigger
          delay={0}
          type="button"
          data-testid={testId}
          aria-pressed={pressed}
          onClick={onClick}
          className={cn(
            TILE_CLASS,
            'rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            onClick ? 'cursor-pointer hover:bg-accent/40' : 'cursor-default',
          )}
        >
          <span className="grid min-w-0 flex-1 grid-rows-[1rem_1.75rem_1rem] gap-0.5">
            <span className="truncate text-xs font-medium leading-4 text-muted-foreground">
              {label}
            </span>
            <span
              className={cn(
                'truncate text-2xl font-semibold leading-7 tracking-tight tabular-nums',
                valueClass,
              )}
            >
              {value}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] leading-4 text-muted-foreground">
              {sub}
            </span>
          </span>
          <TileIcon tone={tone}>{icon}</TileIcon>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </Card>
  );
}

// ─── chart cards ─────────────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  testId,
  className,
  bodyClassName = CHART_BODY_CLASS,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  testId: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Card role="region" aria-labelledby={id} data-testid={testId} className={className}>
      <CardHeader>
        <CardTitle id={id} role="heading" aria-level={2} className="text-sm font-semibold">
          {title}
        </CardTitle>
        <CardDescription className="truncate text-xs">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className={bodyClassName}>{children}</CardContent>
    </Card>
  );
}

function EmptyBody({
  icon,
  tone = 'neutral',
  title,
  children,
}: {
  icon: ReactNode;
  tone?: Tone;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <TileIcon tone={tone}>{icon}</TileIcon>
      <div className="text-sm font-medium">{title}</div>
      {children ? <div className="max-w-56 text-xs text-muted-foreground">{children}</div> : null}
    </div>
  );
}

/** Ring chart: one arc per non-zero segment, `centre` overlaid. */
function Donut({
  segments,
  total,
  centre,
}: {
  segments: { key: string; value: number; color: string }[];
  total: number;
  centre: ReactNode;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative size-[120px] flex-none">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="11" stroke={EMPTY_COLOR} />
        {segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                strokeWidth="11"
                stroke={s.color}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{centre}</div>
    </div>
  );
}

/** A clickable legend-style row: swatch, label, count, share. */
function ShareRow({
  testId,
  color,
  label,
  count,
  share,
  active,
  onClick,
  tip,
}: {
  testId: string;
  color: string;
  label: string;
  count: number;
  share: number;
  active: boolean;
  onClick: () => void;
  tip: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        type="button"
        data-testid={testId}
        aria-pressed={active}
        onClick={onClick}
        className={cn(ROW_CLASS, FOCUS_RING_CLASS, 'hover:bg-accent/50', active && 'bg-accent')}
      >
        <Swatch color={color} />
        <span className="min-w-0 flex-1 truncate pr-0.5 text-left">{label}</span>
        <span className="font-medium tabular-nums">{count}</span>
        <span className="w-9 text-right tabular-nums text-muted-foreground">{share}%</span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function TestResultsBody({
  scope,
  filter,
  toggle,
}: {
  scope: CycleScope;
  filter: CycleFilter | null;
  toggle: (f: CycleFilter) => void;
}) {
  const { exec } = scope;
  if (exec.total === 0) {
    return (
      <EmptyBody icon={<FlaskConical className="size-4" />} title="No test runs">
        The cycles in scope have no test cases yet.
      </EmptyBody>
    );
  }
  if (exec.executed === 0) {
    return (
      <EmptyBody icon={<PlayCircle className="size-4" />} tone="blue" title="Not started yet">
        {exec.total} test {exec.total === 1 ? 'run is' : 'runs are'} waiting to be executed.
      </EmptyBody>
    );
  }
  const rows = STATUS_ORDER.filter((k) => exec.counts[k] > 0);
  const executedPct = pct(exec.executed, exec.total);
  return (
    <div className="flex h-full items-center gap-5">
      <Donut
        total={exec.total}
        segments={STATUS_ORDER.map((k) => ({
          key: k,
          value: exec.counts[k],
          color: STATUS_COLOR[k],
        }))}
        centre={
          <>
            <span className="text-xl font-semibold leading-6 tabular-nums">{executedPct}%</span>
            <span className="text-[11px] leading-4 text-muted-foreground">executed</span>
          </>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {rows.map((k) => {
          const share = pct(exec.counts[k], exec.total);
          return (
            <ShareRow
              key={k}
              testId={`exec-row-${k}`}
              color={STATUS_COLOR[k]}
              label={statusLabel(k)}
              count={exec.counts[k]}
              share={share}
              active={sameFilter(filter, { kind: 'status', status: k })}
              onClick={() => toggle({ kind: 'status', status: k })}
              tip={
                <TooltipBody title={statusLabel(k)} note="Click to list these cycles">
                  <TooltipRow label="Test runs" value={exec.counts[k]} />
                  <TooltipRow label="Of all runs" value={`${share}%`} />
                  <TooltipRow label="Cycles with this result" value={exec.cyclesWithStatus[k]} />
                </TooltipBody>
              }
            />
          );
        })}
      </div>
    </div>
  );
}

const STAGE_HINT: Record<CycleStage, string> = {
  notStarted: 'No test run executed yet',
  inProgress: 'Some test runs executed',
  done: 'Every test run executed',
  noTests: 'Cycle has no test cases',
};

function CycleProgressBody({
  scope,
  filter,
  toggle,
}: {
  scope: CycleScope;
  filter: CycleFilter | null;
  toggle: (f: CycleFilter) => void;
}) {
  const total = STAGE_ORDER.reduce((a, k) => a + scope.stages[k], 0);
  if (total === 0) {
    return <EmptyBody icon={<ListChecks className="size-4" />} title="No cycles in scope" />;
  }
  const rows = STAGE_ORDER.filter((k) => k !== 'noTests' || scope.stages[k] > 0);
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex h-2.5 w-full flex-none gap-0.5 overflow-hidden rounded-full">
        {STAGE_ORDER.filter((k) => scope.stages[k] > 0).map((k) => (
          <div
            key={k}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(scope.stages[k] / total) * 100}%`, background: STAGE_COLOR[k] }}
          />
        ))}
      </div>
      <div className="flex flex-col">
        {rows.map((k) => {
          const share = pct(scope.stages[k], total);
          return (
            <ShareRow
              key={k}
              testId={`stage-row-${k}`}
              color={STAGE_COLOR[k]}
              label={STAGE_LABEL[k]}
              count={scope.stages[k]}
              share={share}
              active={sameFilter(filter, { kind: 'stage', stage: k })}
              onClick={() => toggle({ kind: 'stage', stage: k })}
              tip={
                <TooltipBody title={STAGE_LABEL[k]} note={STAGE_HINT[k]}>
                  <TooltipRow label="Cycles" value={scope.stages[k]} />
                  <TooltipRow label="Of cycles in scope" value={`${share}%`} />
                </TooltipBody>
              }
            />
          );
        })}
      </div>
    </div>
  );
}

/** Date range shown under each due-date bucket label. */
function deadlineHint(key: DeadlineKey, today: string): string {
  switch (key) {
    case 'overdue':
      return `before ${formatDateKey(today)}`;
    case 'week':
      return `by ${formatDateKey(addDaysKey(today, DUE_SOON_DAYS - 1))}`;
    case 'next':
      return `${formatDateKey(addDaysKey(today, 7))} – ${formatDateKey(addDaysKey(today, 13))}`;
    case 'month':
      return `${formatDateKey(addDaysKey(today, 14))} – ${formatDateKey(addDaysKey(today, 27))}`;
    case 'later':
      return `after ${formatDateKey(addDaysKey(today, 27))}`;
    case 'none':
      return 'no end date set';
  }
}

function DueDatesBody({
  scope,
  filter,
  toggle,
  today,
}: {
  scope: CycleScope;
  filter: CycleFilter | null;
  toggle: (f: CycleFilter) => void;
  today: string;
}) {
  if (scope.openCount === 0) {
    return <EmptyBody icon={<CalendarClock className="size-4" />} title="No open cycles" />;
  }
  const byKey = new Map(scope.deadlines.map((b) => [b.key, b]));
  const max = Math.max(...scope.deadlines.map((b) => b.count), 1);
  return (
    <div className="flex h-full flex-col justify-between">
      {DEADLINE_ORDER.map((key) => {
        const b = byKey.get(key);
        const count = b?.count ?? 0;
        const f = deadlineFilter(key);
        const active = sameFilter(filter, f);
        const label = DEADLINE_LABEL[key];
        return (
          <Tooltip key={key}>
            <TooltipTrigger
              delay={0}
              type="button"
              data-testid={`due-row-${key}`}
              aria-pressed={active}
              aria-label={`${label}: ${count} cycles`}
              // Empty buckets stay hoverable but can't filter the list down to nothing.
              onClick={count > 0 ? () => toggle(f) : undefined}
              className={cn(
                ROW_CLASS,
                FOCUS_RING_CLASS,
                count > 0 ? 'hover:bg-accent/50' : 'cursor-default',
                active && 'bg-accent',
              )}
            >
              <span className="flex w-28 min-w-0 flex-none flex-col text-left leading-tight">
                <span
                  className={cn(
                    'truncate',
                    key === 'overdue' && count > 0 && 'font-medium text-red-600 dark:text-red-400',
                    count === 0 && 'text-muted-foreground',
                  )}
                >
                  {label}
                </span>
              </span>
              <span className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full" aria-hidden>
                <span
                  className="h-full rounded-full"
                  style={{
                    width: count > 0 ? `max(6px, ${(count / max) * 100}%)` : 0,
                    background: DEADLINE_COLOR[key],
                  }}
                />
              </span>
              <span
                className={cn(
                  'w-7 flex-none text-right font-medium tabular-nums',
                  count === 0 && 'font-normal text-muted-foreground',
                )}
              >
                {count}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <TooltipBody
                title={`${label} · ${deadlineHint(key, today)}`}
                note={b && b.keys.length > 0 ? b.keys.join(', ') : undefined}
              >
                <TooltipRow color={DEADLINE_COLOR[key]} label="Open cycles" value={count} />
              </TooltipBody>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

const OWNER_OPEN_COLOR = 'var(--color-blue-500)';
const OWNER_CLOSED_COLOR = PENDING_COLOR;

function OwnersBody({
  scope,
  filter,
  toggle,
  names,
}: {
  scope: CycleScope;
  filter: CycleFilter | null;
  toggle: (f: CycleFilter) => void;
  names: Map<string, { name: string; avatar: string | null }>;
}) {
  if (scope.owners.length === 0) {
    return <EmptyBody icon={<ListChecks className="size-4" />} title="No owners" />;
  }
  const max = Math.max(...scope.owners.map((o) => o.count), 1);
  const resolve = (o: OwnerStat) => names.get(o.ownerId) ?? { name: o.ownerId, avatar: null };
  return (
    <div className="flex h-full flex-col">
      {scope.owners.map((o) => {
        const { name, avatar } = resolve(o);
        const active = sameFilter(filter, { kind: 'owner', ownerId: o.ownerId, label: name });
        const passPct = o.runTotal > 0 ? `${pct(o.pass, o.runTotal)}%` : '—';
        const openOnTime = o.open - o.overdue;
        return (
          <Tooltip key={o.ownerId}>
            <TooltipTrigger
              delay={0}
              type="button"
              data-testid={`owner-row-${o.ownerId}`}
              aria-pressed={active}
              onClick={() => toggle({ kind: 'owner', ownerId: o.ownerId, label: name })}
              className={cn(
                ROW_CLASS,
                FOCUS_RING_CLASS,
                'hover:bg-accent/50',
                active && 'bg-accent',
              )}
            >
              <span className="flex w-36 min-w-0 flex-none items-center gap-2">
                <CachedAvatar url={avatar} name={name} size={20} />
                <span className="truncate pr-0.5 text-left">{name}</span>
              </span>
              <span className="flex h-2 min-w-0 flex-1" aria-hidden>
                <span
                  className="flex h-full gap-px overflow-hidden rounded-full"
                  style={{ width: `${(o.count / max) * 100}%` }}
                >
                  {o.overdue > 0 && (
                    <span
                      className="h-full"
                      style={{ flexGrow: o.overdue, background: 'var(--color-red-500)' }}
                    />
                  )}
                  {openOnTime > 0 && (
                    <span
                      className="h-full"
                      style={{ flexGrow: openOnTime, background: OWNER_OPEN_COLOR }}
                    />
                  )}
                  {o.closed > 0 && (
                    <span
                      className="h-full"
                      style={{ flexGrow: o.closed, background: OWNER_CLOSED_COLOR }}
                    />
                  )}
                </span>
              </span>
              <span className="w-7 flex-none text-right font-medium tabular-nums">{o.count}</span>
            </TooltipTrigger>
            <TooltipContent>
              <TooltipBody title={name}>
                <TooltipRow color={OWNER_OPEN_COLOR} label="Open" value={o.open} />
                <TooltipRow color="var(--color-red-500)" label="Overdue" value={o.overdue} />
                <TooltipRow color={OWNER_CLOSED_COLOR} label="Closed" value={o.closed} />
                <TooltipRow label="Pass rate" value={passPct} />
              </TooltipBody>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {scope.othersCount > 0 && (
        <span className="mt-auto px-1.5 text-[11px] leading-4 text-muted-foreground">
          +{scope.othersCount} more {scope.othersCount === 1 ? 'owner' : 'owners'}
        </span>
      )}
    </div>
  );
}

/** Inline key for the owner bars: three colours aren't self-explanatory. */
function OwnerKey() {
  return (
    <span className="inline-flex items-center gap-3">
      {[
        { label: 'open', color: OWNER_OPEN_COLOR },
        { label: 'overdue', color: 'var(--color-red-500)' },
        { label: 'closed', color: OWNER_CLOSED_COLOR },
      ].map((k) => (
        <span key={k.label} className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full" style={{ background: k.color }} />
          {k.label}
        </span>
      ))}
    </span>
  );
}

// ─── subfolders ──────────────────────────────────────────────────────────────

export interface SubfolderStat {
  id: number;
  name: string;
  /** Cycles in the folder and everything below it. */
  count: number;
  /** Has its own subfolders. */
  hasChildren: boolean;
}

function SubfoldersCard({
  folders,
  onOpen,
}: {
  folders: SubfolderStat[];
  onOpen: (id: number) => void;
}) {
  const total = folders.reduce((a, f) => a + f.count, 0);
  const max = Math.max(...folders.map((f) => f.count), 1);
  return (
    <ChartCard
      title="Subfolders"
      subtitle={`${folders.length} ${folders.length === 1 ? 'folder' : 'folders'} · ${total} cycles · click to open`}
      testId="card-subfolders"
      bodyClassName=""
    >
      <div className="grid gap-x-6 gap-y-0.5 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            data-testid={`subfolder-${f.id}`}
            onClick={() => onOpen(f.id)}
            className={cn(ROW_CLASS, FOCUS_RING_CLASS, 'hover:bg-accent/50')}
          >
            <Folder
              aria-hidden
              className={cn(
                'size-3.5 flex-none',
                f.hasChildren ? 'fill-current text-muted-foreground' : 'text-muted-foreground',
              )}
            />
            <span className="min-w-0 flex-1 truncate pr-0.5 text-left">{f.name}</span>
            <span className="flex h-1.5 w-16 flex-none overflow-hidden rounded-full" aria-hidden>
              <span
                className="h-full rounded-full"
                style={{
                  width: f.count > 0 ? `max(4px, ${(f.count / max) * 100}%)` : 0,
                  background: PENDING_COLOR,
                }}
              />
            </span>
            <span
              className={cn(
                'w-8 flex-none text-right tabular-nums',
                f.count === 0 ? 'text-muted-foreground' : 'font-medium',
              )}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>
    </ChartCard>
  );
}

// ─── dashboard ───────────────────────────────────────────────────────────────

function Notice({
  icon,
  children,
  action,
}: {
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      data-testid="dashboard-notice"
      className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-foreground/5"
    >
      <TileIcon tone="neutral">{icon}</TileIcon>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function AioCyclesDashboard({
  scope,
  filter,
  onFilter,
  loading,
  summariesLoading,
  statusFilter,
  onShowOpen,
  onShowAll,
  subfolders,
  onOpenFolder,
  today,
  token,
  jiraBaseUrl,
}: {
  scope: CycleScope | null;
  filter: CycleFilter | null;
  onFilter: (next: CycleFilter | null) => void;
  /** Cycles still pending: every tile and card is a skeleton. */
  loading: boolean;
  /** Summaries still loading: the Pass rate tile, Test results and Cycle progress are skeletons. */
  summariesLoading: boolean;
  statusFilter: 'open' | 'all';
  onShowOpen: () => void;
  onShowAll: () => void;
  /** Direct children of the selected folder (roots for All cycles); empty for a leaf. */
  subfolders: SubfolderStat[];
  onOpenFolder: (id: number) => void;
  today: string;
  token: string | null;
  jiraBaseUrl: string | undefined;
}) {
  const toggle = (next: CycleFilter) => onFilter(sameFilter(filter, next) ? null : next);

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
  const subfoldersCard =
    subfolders.length > 0 ? <SubfoldersCard folders={subfolders} onOpen={onOpenFolder} /> : null;

  // A folder with no cycles anywhere below it: the subfolders are the whole story.
  if (!showSkeleton && scope && scope.total === 0) {
    return (
      <div className="space-y-4">
        <Notice icon={<Folder className="size-4" />}>
          <span className="font-medium">No test cycles in this folder</span>
          {subfolders.length > 0 && (
            <span className="text-muted-foreground"> — open a subfolder below.</span>
          )}
        </Notice>
        {subfoldersCard}
      </div>
    );
  }

  const allClosed =
    !showSkeleton && scope && statusFilter === 'open' && scope.openCount === 0 && scope.total > 0;

  return (
    <div className="space-y-4">
      {allClosed && (
        <Notice
          icon={<Archive className="size-4" />}
          action={
            <button
              type="button"
              data-testid="dashboard-show-all"
              onClick={onShowAll}
              className="flex-none rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:bg-foreground/90"
            >
              Show all {scope.total}
            </button>
          }
        >
          <span className="font-medium">
            All {scope.total} {scope.total === 1 ? 'cycle' : 'cycles'} here are closed.
          </span>
          <span className="text-muted-foreground"> Switch to All to see their results.</span>
        </Notice>
      )}

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
              value={scope.openCount}
              sub={<span className="truncate">of {scope.total} in this folder</span>}
              tone="blue"
              icon={<ListChecks className="size-4" />}
              pressed={statusFilter === 'open' && filter === null}
              onClick={onShowOpen}
              tip={
                <TooltipBody title="Open cycles" note="Click to show open cycles">
                  <TooltipRow label="Open" value={scope.openCount} />
                  <TooltipRow label="Closed" value={scope.closedCount} />
                  <TooltipRow label="No end date" value={scope.noEndDate} />
                </TooltipBody>
              }
            />
            <Tile
              testId="tile-overdue"
              label="Overdue"
              value={scope.overdue.count}
              valueClass={scope.overdue.count > 0 ? 'text-red-600 dark:text-red-400' : undefined}
              tone={scope.overdue.count > 0 ? 'red' : 'green'}
              icon={
                scope.overdue.count > 0 ? (
                  <AlertTriangle className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )
              }
              sub={
                scope.overdue.oldestDaysLate === null ? (
                  <span className="truncate">all on schedule</span>
                ) : (
                  <span className="truncate">oldest {scope.overdue.oldestDaysLate} days late</span>
                )
              }
              pressed={sameFilter(filter, { kind: 'overdue' })}
              onClick={() => toggle({ kind: 'overdue' })}
              tip={
                <TooltipBody
                  title="Open cycles past their end date"
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
              label="Due this week"
              value={scope.dueSoon.count}
              tone={scope.dueSoon.count > 0 ? 'amber' : 'neutral'}
              icon={<CalendarClock className="size-4" />}
              sub={
                scope.dueSoon.nextDate ? (
                  <span className="truncate">next on {formatDateKey(scope.dueSoon.nextDate)}</span>
                ) : (
                  <span className="truncate">nothing due in {DUE_SOON_DAYS} days</span>
                )
              }
              pressed={sameFilter(filter, { kind: 'dueSoon' })}
              onClick={() => toggle({ kind: 'dueSoon' })}
              tip={
                <TooltipBody
                  title={`Ending in the next ${DUE_SOON_DAYS} days`}
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
                value={scope.exec.passPct === null ? '—' : `${scope.exec.passPct}%`}
                tone={scope.exec.executed > 0 ? 'green' : 'neutral'}
                icon={<CheckCircle2 className="size-4" />}
                sub={
                  <span className="truncate tabular-nums">
                    {scope.exec.total === 0
                      ? 'no test runs'
                      : `${scope.exec.executed} of ${scope.exec.total} runs executed`}
                  </span>
                }
                tip={
                  <TooltipBody title={`${scope.exec.total} test runs`} note="Passed ÷ all runs">
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

      <div className="grid gap-4 @3xl:grid-cols-2">
        <ChartCard
          title="Test results"
          subtitle={
            scope && !execSkeleton
              ? `${scope.exec.total} test runs across ${scope.exec.withSummary} cycles`
              : 'Results of every test run'
          }
          testId="card-exec"
        >
          {execSkeleton || !scope ? (
            <Skeleton data-testid="card-skeleton-exec" className="h-full w-full" />
          ) : (
            <TestResultsBody scope={scope} filter={filter} toggle={toggle} />
          )}
        </ChartCard>
        <ChartCard
          title="Cycle progress"
          subtitle="How far each cycle's test execution has got"
          testId="card-stages"
        >
          {execSkeleton || !scope ? (
            <Skeleton data-testid="card-skeleton-stages" className="h-full w-full" />
          ) : (
            <CycleProgressBody scope={scope} filter={filter} toggle={toggle} />
          )}
        </ChartCard>
        <ChartCard
          title="Due dates"
          subtitle="When the open cycles are due to end"
          testId="card-due"
        >
          {showSkeleton || !scope ? (
            <Skeleton data-testid="card-skeleton-due" className="h-full w-full" />
          ) : (
            <DueDatesBody scope={scope} filter={filter} toggle={toggle} today={today} />
          )}
        </ChartCard>
        <ChartCard title="Owners" subtitle={<OwnerKey />} testId="card-owners">
          {showSkeleton || !scope ? (
            <Skeleton data-testid="card-skeleton-owners" className="h-full w-full" />
          ) : (
            <OwnersBody scope={scope} filter={filter} toggle={toggle} names={names} />
          )}
        </ChartCard>
      </div>

      {subfoldersCard}
    </div>
  );
}
