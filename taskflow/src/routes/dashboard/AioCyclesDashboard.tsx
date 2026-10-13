/**
 * Read-only summary of the cycles in the selected folder, styled like the home Dashboard
 * cards (MyIssuesCard / UpcomingReleasesTimeline): uppercase muted title, faint ambient
 * icon top-right, a big headline number, one segmented bar and a single-line legend.
 */
import { Archive, CalendarClock, CheckCircle2, Folder, type LucideIcon, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type CycleScope,
  type CycleStage,
  DEADLINE_LABEL,
  type DeadlineKey,
  STAGE_LABEL,
  type StatusKey,
  statusLabel,
} from '@/lib/aio-cycle-list';
import { cn } from '@/lib/utils';

/** "To do" grey of the home dashboard's MyIssuesCard. */
const TODO_CLASS = 'bg-slate-400 dark:bg-slate-500';

const STATUS_CLASS: Record<StatusKey, string> = {
  pass: 'bg-green-500',
  fail: 'bg-red-500',
  blocked: 'bg-orange-400',
  inProgress: 'bg-blue-500',
  notRun: TODO_CLASS,
};
const STATUS_ORDER: StatusKey[] = ['pass', 'fail', 'blocked', 'inProgress', 'notRun'];

const STAGE_CLASS: Record<CycleStage, string> = {
  notStarted: TODO_CLASS,
  inProgress: 'bg-blue-500',
  done: 'bg-green-500',
  noTests: 'bg-muted-foreground/25',
};
const STAGE_ORDER: CycleStage[] = ['notStarted', 'inProgress', 'done', 'noTests'];

/** Urgency: red (late) → amber (soon) → blue (planned) → grey (no date). */
const DEADLINE_CLASS: Record<DeadlineKey, string> = {
  overdue: 'bg-red-500',
  week: 'bg-amber-500',
  next: 'bg-amber-300',
  month: 'bg-blue-400',
  later: 'bg-blue-300',
  none: TODO_CLASS,
};
const DEADLINE_ORDER: DeadlineKey[] = ['overdue', 'week', 'next', 'month', 'later', 'none'];

interface Segment {
  key: string;
  label: string;
  count: number;
  className: string;
}

// ─── card shell ──────────────────────────────────────────────────────────────

function SummaryCard({
  title,
  icon: Icon,
  iconClass,
  testId,
  children,
}: {
  title: string;
  icon: LucideIcon;
  /** Ambient icon tint, e.g. 'text-green-500/[0.07] dark:text-green-400/10'. */
  iconClass: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <Card
      size="sm"
      role="region"
      aria-label={title}
      data-testid={testId}
      className="relative overflow-hidden"
    >
      <Icon
        className={cn('pointer-events-none absolute -top-3 -right-2 size-16', iconClass)}
        aria-hidden
      />
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">{children}</CardContent>
    </Card>
  );
}

/** Headline: big number + muted phrase on one baseline (MyIssuesCard "3 of 8 done"). */
function Headline({
  value,
  valueClass,
  children,
}: {
  value: ReactNode;
  valueClass?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span
        className={cn(
          'text-xl font-semibold leading-7 tracking-tight tabular-nums text-foreground',
          valueClass,
        )}
      >
        {value}
      </span>
      <span className="truncate text-xs text-muted-foreground">{children}</span>
    </div>
  );
}

/** Segmented bar + one-line legend of the non-zero segments. Hover a segment for its count. */
function SegmentBar({ label, segments }: { label: string; segments: Segment[] }) {
  const total = segments.reduce((a, s) => a + s.count, 0);
  const shown = segments.filter((s) => s.count > 0);
  return (
    <>
      <div
        role="img"
        aria-label={`${label}: ${shown.map((s) => `${s.count} ${s.label}`).join(', ') || 'none'}`}
        className="flex h-2 overflow-hidden rounded-full bg-muted"
      >
        {shown.map((s) => (
          <Tooltip key={s.key}>
            <TooltipTrigger
              delay={0}
              render={<div />}
              className={cn('h-full', s.className)}
              style={{ width: `${(s.count / total) * 100}%` }}
            />
            <TooltipContent>
              {s.label}: {s.count} ({Math.round((s.count / total) * 100)}%)
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex min-h-4 flex-wrap items-center gap-x-3.5 gap-y-1">
        {shown.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          shown.map((s) => (
            <span
              key={s.key}
              data-testid={`legend-${s.key}`}
              className="flex flex-none items-center gap-1.5 whitespace-nowrap"
            >
              <span className={cn('size-2 rounded-[2px]', s.className)} aria-hidden />
              <span className="text-xs text-muted-foreground">
                {s.label}{' '}
                <span className="font-medium tabular-nums text-foreground">{s.count}</span>
              </span>
            </span>
          ))
        )}
      </div>
    </>
  );
}

function CardSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-2.5">
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

// ─── cards ───────────────────────────────────────────────────────────────────

function TestResultsCard({ scope }: { scope: CycleScope | null }) {
  const exec = scope?.exec;
  return (
    <SummaryCard
      title="Test results"
      icon={CheckCircle2}
      iconClass="text-green-500/[0.07] dark:text-green-400/10"
      testId="card-exec"
    >
      {!exec ? (
        <CardSkeleton />
      ) : (
        <>
          <Headline value={exec.passPct === null ? '—' : `${exec.passPct}%`}>
            {exec.total === 0
              ? 'no test runs'
              : `passed · ${exec.executed} of ${exec.total} runs executed`}
          </Headline>
          <SegmentBar
            label="Test runs"
            segments={STATUS_ORDER.map((k) => ({
              key: k,
              label: statusLabel(k),
              count: exec.counts[k],
              className: STATUS_CLASS[k],
            }))}
          />
        </>
      )}
    </SummaryCard>
  );
}

function CycleProgressCard({ scope }: { scope: CycleScope | null }) {
  return (
    <SummaryCard
      title="Cycle progress"
      icon={Timer}
      iconClass="text-blue-500/[0.07] dark:text-blue-400/10"
      testId="card-stages"
    >
      {!scope ? (
        <CardSkeleton />
      ) : (
        <>
          <Headline value={scope.stages.done}>
            of {scope.exec.withSummary} {scope.exec.withSummary === 1 ? 'cycle' : 'cycles'}{' '}
            completed
          </Headline>
          <SegmentBar
            label="Cycles"
            segments={STAGE_ORDER.map((k) => ({
              key: k,
              label: STAGE_LABEL[k],
              count: scope.stages[k],
              className: STAGE_CLASS[k],
            }))}
          />
        </>
      )}
    </SummaryCard>
  );
}

function DueDatesCard({ scope }: { scope: CycleScope | null }) {
  const overdue = scope?.overdue.count ?? 0;
  return (
    <SummaryCard
      title="Due dates"
      icon={CalendarClock}
      iconClass="text-amber-500/[0.07] dark:text-amber-400/10"
      testId="card-due"
    >
      {!scope ? (
        <CardSkeleton />
      ) : (
        <>
          <Headline
            value={overdue}
            valueClass={overdue > 0 ? 'text-red-600 dark:text-red-400' : undefined}
          >
            {scope.openCount === 0
              ? 'no open cycles'
              : overdue > 0
                ? `overdue · oldest ${scope.overdue.oldestDaysLate} days late`
                : 'overdue · all open cycles on schedule'}
          </Headline>
          <SegmentBar
            label="Open cycles by due date"
            segments={DEADLINE_ORDER.map((k) => ({
              key: k,
              label: DEADLINE_LABEL[k],
              count: scope.deadlines[k],
              className: DEADLINE_CLASS[k],
            }))}
          />
        </>
      )}
    </SummaryCard>
  );
}

// ─── subfolders ──────────────────────────────────────────────────────────────

export interface SubfolderStat {
  id: number;
  name: string;
  /** Cycles in the folder and everything below it. */
  count: number;
}

function SubfoldersStrip({ folders }: { folders: SubfolderStat[] }) {
  return (
    <div data-testid="subfolders" className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Subfolders
      </span>
      {folders.map((f) => (
        <span
          key={f.id}
          data-testid={`subfolder-${f.id}`}
          className="flex min-w-0 items-center gap-1.5 text-xs"
        >
          <Folder className="size-3.5 flex-none text-muted-foreground" aria-hidden />
          <span className="max-w-48 truncate pr-0.5">{f.name}</span>
          <span className="tabular-nums text-muted-foreground">{f.count}</span>
        </span>
      ))}
    </div>
  );
}

// ─── dashboard ───────────────────────────────────────────────────────────────

function Notice({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div
      data-testid="dashboard-notice"
      className="flex items-center gap-2.5 text-sm text-muted-foreground"
    >
      <Icon className="size-4 flex-none" aria-hidden />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function AioCyclesDashboard({
  scope,
  loading,
  summariesLoading,
  statusFilter,
  subfolders,
}: {
  scope: CycleScope | null;
  /** Cycles still pending: every card is a skeleton. */
  loading: boolean;
  /** Summaries still loading: Test results and Cycle progress are skeletons. */
  summariesLoading: boolean;
  statusFilter: 'open' | 'all';
  /** Direct children of the selected folder (roots for All cycles); empty for a leaf. */
  subfolders: SubfolderStat[];
}) {
  const ready = !loading && scope !== null;
  const strip = subfolders.length > 0 ? <SubfoldersStrip folders={subfolders} /> : null;

  // A folder with no cycles anywhere below it: say so instead of three empty cards.
  if (ready && scope.total === 0) {
    return (
      <div className="space-y-3">
        <Notice icon={Folder}>
          No test cycles in this folder{subfolders.length > 0 ? ' or its subfolders' : ''}.
        </Notice>
        {strip}
      </div>
    );
  }

  const allClosed = ready && statusFilter === 'open' && scope.openCount === 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-4 @3xl:grid-cols-3">
        <TestResultsCard scope={ready && !summariesLoading ? scope : null} />
        <CycleProgressCard scope={ready && !summariesLoading ? scope : null} />
        <DueDatesCard scope={ready ? scope : null} />
      </div>
      {allClosed && (
        <Notice icon={Archive}>
          All {scope.total} {scope.total === 1 ? 'cycle' : 'cycles'} here are closed. Switch to All
          to include their results.
        </Notice>
      )}
      {strip}
    </div>
  );
}
