/**
 * EpicProgressSummary — the hero (big %, segmented status bar, "X of Y done") plus a
 * 3-cell stat strip (Finish / Remaining / Risks) at the top of the epic progress section
 * (quick 261001-ilq). Tooltip triggers contain spans only (valid inside a <button>).
 * The hero tooltip carries the one "Data sources" block (261001-sqm); the Risks tile opens an
 * one-line risk buttons, each opening a popover of affected issues.
 *
 * Text-collision rule (EpicDetailSheet.test): no visible text node equals exactly
 * "Done" / "In Progress" and none says "Stories" — every sentence here is a single
 * lowercase template-literal node.
 */
import {
  CalendarDays,
  CalendarX,
  CircleCheck,
  CircleDashed,
  CirclePause,
  Clock,
  Gauge,
  History,
  ListPlus,
  Timer,
  TrendingUp,
  UserX,
} from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLTIP_SURFACE, TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  type AveragedForecast,
  confidenceReason,
  type EpicRisk,
  type EpicSummary,
  FINISH_STATE_TEXT,
  finishDateRows,
  formatDateKey,
  formatFinishDate,
  formatMetric,
  METRIC_LABEL,
  type Metric,
  type RiskKey,
  type SourceLine,
  summaryBands,
  type TimeTotals,
} from '@/lib/epic-progress';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/services/jira/duration';
import { ConfidenceMeter } from './ConfidenceMeter';
import { BandBar, BandBreakdown } from './EpicBands';
import { MARKER_ICON, METRIC_ICON } from './epic-markers';

const RISK_ICON: Record<RiskKey, typeof CalendarX> = {
  overdue: CalendarX,
  late: CalendarX,
  stalled: CirclePause,
  scope: TrendingUp,
  unestimated: CircleDashed,
  unassigned: UserX,
};

const SOURCE_ICON: Record<SourceLine['key'], typeof History> = {
  history: History,
  scope: ListPlus,
  worklogs: Clock,
  estimate: Timer,
  collapse: CircleCheck,
  calendar: CalendarDays,
};

interface EpicProgressSummaryProps {
  metric: Metric;
  summary: EpicSummary;
  time: TimeTotals;
  /** Average of the Count / SP / Time forecasts (independent of the metric toggle). */
  finish: AveragedForecast;
  risks: EpicRisk[];
  /** Provenance lines for the hero tooltip's Data sources block. */
  sources: SourceLine[];
  /** Opens an issue (same handler as the Stories rows); risk keys call it. */
  onOpenIssue?: (key: string) => void;
  today: string;
}

const TILE_CLASS = 'min-w-0 cursor-default text-left';

function Tile({
  label,
  value,
  sub,
  tip,
  children,
}: {
  label: string;
  value?: string;
  sub?: ReactNode;
  tip: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger type="button" data-testid="epic-stat-tile" className={TILE_CLASS}>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
        {value !== undefined ? (
          <span className="block truncate text-lg font-semibold leading-tight">{value}</span>
        ) : null}
        {children}
        {typeof sub === 'string' ? (
          <span className="block truncate text-xs text-muted-foreground">{sub}</span>
        ) : sub ? (
          <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
            {sub}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

const REMAINING_NOTE =
  "Time: open items' estimate minus logged, never below 0. Replaces Jira's remaining estimate so it matches the Time chart.";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The single provenance block, same slot order in every tab (lib dataSourceLines). */
function DataSources({ sources }: { sources: SourceLine[] }) {
  return (
    <div className="grid gap-1">
      <div className="font-medium text-foreground">Data sources</div>
      {sources.map((s) => {
        const Icon = SOURCE_ICON[s.key];
        return (
          <div
            key={s.key}
            data-slot="tooltip-source"
            data-approximate={s.approximate}
            className="flex items-start gap-2"
          >
            <Icon aria-hidden="true" className="mt-px size-3 shrink-0 text-muted-foreground" />
            <span className="max-w-64">{s.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function Hero({
  metric,
  summary,
  time,
  sources,
}: {
  metric: Metric;
  summary: EpicSummary;
  time: TimeTotals;
  sources: SourceLine[];
}) {
  // One model for every tab: done / in progress / to do weighted by the active metric.
  const bands = summaryBands(summary);
  const bigText = summary.total === 0 ? '—' : `${summary.pctDone}%`;
  const line = `${formatMetric(bands.done, metric)} of ${formatMetric(summary.total, metric)} done · ${formatMetric(bands.inProgress, metric)} in progress`;
  const tip = (
    <TooltipBody note={<DataSources sources={sources} />}>
      <BandBreakdown bands={bands} metric={metric} share />
      {metric === 'time' ? (
        <>
          <TooltipRow
            icon={<MARKER_ICON.logged className="size-3" />}
            label="Logged"
            value={formatDuration(time.logged)}
          />
          <TooltipRow
            icon={<MARKER_ICON.estimate className="size-3" />}
            label="Estimate"
            value={formatDuration(time.estimated)}
          />
        </>
      ) : null}
    </TooltipBody>
  );

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        data-testid="epic-hero"
        className="flex min-w-0 cursor-default flex-col gap-1.5 text-left"
      >
        <span className="text-3xl font-semibold leading-none tabular-nums">{bigText}</span>
        <BandBar bands={bands} className="h-2" testId="epic-hero-bar" />
        <span
          data-testid="epic-hero-caption"
          className="mt-1.5 block truncate text-xs text-muted-foreground"
        >
          {line}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function FinishTile({ finish, today }: { finish: AveragedForecast; today: string }) {
  let value: string;
  let sub: ReactNode;
  if (finish.state !== 'ok') {
    value = FINISH_STATE_TEXT[finish.state];
  } else {
    value = finish.likely ? formatFinishDate(finish.likely, today) : '—';
    if (finish.optimistic && finish.pessimistic) {
      sub = (
        <>
          <span className="min-w-0 truncate">{`${formatDateKey(finish.optimistic)}–${formatDateKey(finish.pessimistic)}`}</span>
          <ConfidenceMeter level={finish.confidence ?? 'low'} className="flex-none" />
        </>
      );
    }
  }

  const reason = confidenceReason(finish);
  return (
    <Tile
      label="Finish"
      value={value}
      sub={sub}
      tip={
        <TooltipBody title="Projected finish" note={finish.explanation || undefined}>
          {finishDateRows(finish).map((r) => (
            <TooltipRow
              key={r.key}
              icon={<MARKER_ICON.date className="size-3" />}
              label={r.label}
              value={formatFinishDate(r.date, today)}
              sub={`${r.n} working day${r.n === 1 ? '' : 's'}`}
            />
          ))}
          {finish.state === 'ok' && finish.confidence !== null ? (
            <TooltipRow
              icon={<Gauge className="size-3" />}
              label="Confidence"
              value={<ConfidenceMeter level={finish.confidence} />}
            />
          ) : null}
          {reason ? (
            <div
              data-testid="confidence-reason"
              className="max-w-64 truncate pl-5 text-muted-foreground"
            >
              {reason}
            </div>
          ) : null}
          {finish.parts.map((p) => {
            const Icon = METRIC_ICON[p.metric];
            return (
              <TooltipRow
                key={p.metric}
                icon={<Icon className="size-3" />}
                label={METRIC_LABEL[p.metric]}
                value={
                  p.included && p.forecast?.likely
                    ? formatFinishDate(p.forecast.likely, today)
                    : p.reason
                }
              />
            );
          })}
        </TooltipBody>
      }
    />
  );
}

function RiskItem({
  risk,
  onOpenIssue,
}: {
  risk: EpicRisk;
  /** Absent when the host can't open issues; rows then render as plain text, not dead buttons. */
  onOpenIssue?: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const firstRow = useRef<HTMLButtonElement>(null);
  const Icon = RISK_ICON[risk.key];
  const iconClass = cn(
    'size-3 shrink-0',
    risk.severity === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
  );
  const rowLayout = 'flex w-full min-w-0 items-center gap-2 rounded px-1.5 py-1 text-left';

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = [
      ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
        'button[data-testid="epic-risk-issue"]',
      ),
    ];
    if (rows.length === 0) return;
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? Math.min(at + 1, rows.length - 1) : Math.max(at - 1, 0);
    rows[next].focus();
    e.preventDefault();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        data-testid="epic-risk-item"
        data-severity={risk.severity}
        className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Icon aria-hidden="true" className={iconClass} />
        <span className="min-w-0 truncate">{risk.text}</span>
      </PopoverTrigger>
      <PopoverContent
        data-testid="epic-risk-popover"
        initialFocus={onOpenIssue && risk.issues.length > 0 ? firstRow : true}
        className={cn(TOOLTIP_SURFACE, 'w-80 border-0 p-2.5 shadow-xl')}
      >
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Icon aria-hidden="true" className={iconClass} />
          <span className="min-w-0 truncate">
            {risk.count !== null ? `${risk.label} · ${risk.count}` : risk.label}
          </span>
        </div>
        <div className="text-muted-foreground">{risk.detail}</div>
        {risk.issues.length > 0 ? (
          <ul
            data-testid="epic-risk-issues"
            className="mt-1.5 grid max-h-48 overflow-y-auto"
            onKeyDown={onListKeyDown}
          >
            {risk.issues.map((issue, i) => (
              <li key={issue.key} className="min-w-0">
                {onOpenIssue ? (
                  <button
                    ref={i === 0 ? firstRow : undefined}
                    type="button"
                    data-testid="epic-risk-issue"
                    className={cn(
                      rowLayout,
                      'cursor-pointer hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                    )}
                    onClick={() => {
                      setOpen(false);
                      onOpenIssue(issue.key);
                    }}
                  >
                    <span className="flex-none font-mono text-[11px] text-muted-foreground">
                      {issue.key}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{issue.summary}</span>
                  </button>
                ) : (
                  <div data-testid="epic-risk-issue" className={rowLayout}>
                    <span className="flex-none font-mono text-[11px] text-muted-foreground">
                      {issue.key}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{issue.summary}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function RisksTile({
  risks,
  onOpenIssue,
}: {
  risks: EpicRisk[];
  onOpenIssue?: (key: string) => void;
}) {
  return (
    <div data-testid="epic-stat-tile" className={TILE_CLASS}>
      <span className="block truncate text-xs text-muted-foreground">Risks</span>
      {risks.length === 0 ? (
        <span className="flex items-center gap-1.5 text-lg font-semibold leading-tight text-muted-foreground">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          No risks
        </span>
      ) : (
        <ul className="mt-0.5 grid gap-0.5">
          {risks.map((r) => (
            <li key={r.key} className="min-w-0">
              <RiskItem risk={r} onOpenIssue={onOpenIssue} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EpicProgressSummary({
  metric,
  summary,
  time,
  finish,
  risks,
  sources,
  onOpenIssue,
  today,
}: EpicProgressSummaryProps) {
  const remainingPrimary =
    metric === 'count'
      ? plural(summary.remainingCount, 'item', 'items')
      : metric === 'sp'
        ? formatMetric(summary.remainingSp, 'sp')
        : formatDuration(summary.remainingSeconds);
  const remainingParts = {
    count: plural(summary.remainingCount, 'item', 'items'),
    sp: formatMetric(summary.remainingSp, 'sp'),
    time: formatDuration(summary.remainingSeconds),
  };
  const others = (['count', 'sp', 'time'] as const)
    .filter((m) => m !== metric)
    .map((m) => remainingParts[m])
    .join(' · ');

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
      <div className="min-w-0 sm:col-span-3 lg:col-span-1">
        <Hero metric={metric} summary={summary} time={time} sources={sources} />
      </div>
      <FinishTile finish={finish} today={today} />
      <Tile
        label="Remaining"
        value={remainingPrimary}
        sub={others}
        tip={
          <TooltipBody note={REMAINING_NOTE}>
            <TooltipRow
              icon={<METRIC_ICON.count className="size-3" />}
              label="Items"
              value={remainingParts.count}
            />
            <TooltipRow
              icon={<METRIC_ICON.sp className="size-3" />}
              label="Story points"
              value={remainingParts.sp}
            />
            <TooltipRow
              icon={<METRIC_ICON.time className="size-3" />}
              label="Time"
              value={remainingParts.time}
            />
          </TooltipBody>
        }
      />
      <RisksTile risks={risks} onOpenIssue={onOpenIssue} />
    </div>
  );
}
