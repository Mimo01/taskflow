/**
 * EpicProgressSummary — the hero (big %, segmented status bar, "X of Y done") plus a
 * 3-cell stat strip (Finish / Remaining / Risks) at the top of the epic progress section
 * (quick 261001-ilq). Tooltip triggers contain spans only (valid inside a <button>).
 *
 * Text-collision rule (EpicDetailSheet.test): no visible text node equals exactly
 * "Done" / "In Progress" and none says "Stories" — every sentence here is a single
 * lowercase template-literal node.
 */
import { CalendarX, CircleCheck, CircleDashed, CirclePause, TrendingUp, UserX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  type AveragedForecast,
  addCalendarDays,
  type EpicRisk,
  type EpicSummary,
  ESTIMATE_FORMULA_NOTE,
  FINISH_STATE_TEXT,
  finishDateRows,
  formatDateKey,
  formatFinishDate,
  formatMetric,
  holidaysBetween,
  METRIC_LABEL,
  type Metric,
  type RiskKey,
  summaryBands,
  type TimeTotals,
  type WorkCalendar,
} from '@/lib/epic-progress';
import { tonePillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/services/jira/duration';
import { BandBar, BandBreakdown } from './EpicBands';
import { MARKER_ICON, METRIC_ICON } from './epic-markers';

/** Look-back for the holiday count in the Finish note (about the 30-working-day max window). */
const HOLIDAY_NOTE_LOOKBACK_DAYS = 42;

const RISK_ICON: Record<RiskKey, typeof CalendarX> = {
  overdue: CalendarX,
  late: CalendarX,
  stalled: CirclePause,
  scope: TrendingUp,
  unestimated: CircleDashed,
  unassigned: UserX,
};

interface EpicProgressSummaryProps {
  metric: Metric;
  summary: EpicSummary;
  time: TimeTotals;
  /** Average of the Count / SP / Time forecasts (independent of the metric toggle). */
  finish: AveragedForecast;
  risks: EpicRisk[];
  calendar: WorkCalendar;
  today: string;
}

function Tile({
  label,
  value,
  sub,
  tip,
  children,
}: {
  label: string;
  value?: string;
  sub?: string;
  tip: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        data-testid="epic-stat-tile"
        className="min-w-0 cursor-default text-left"
      >
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
        {value !== undefined ? (
          <span className="block truncate text-lg font-semibold leading-tight">{value}</span>
        ) : null}
        {children}
        {sub ? <span className="block truncate text-xs text-muted-foreground">{sub}</span> : null}
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

function Hero({
  metric,
  summary,
  time,
}: {
  metric: Metric;
  summary: EpicSummary;
  time: TimeTotals;
}) {
  // One model for every tab: done / in progress / to do weighted by the active metric.
  const bands = summaryBands(summary);
  const bigText = summary.total === 0 ? '—' : `${summary.pctDone}%`;
  const line = `${formatMetric(bands.done, metric)} of ${formatMetric(summary.total, metric)} done · ${formatMetric(bands.inProgress, metric)} in progress`;
  const tip = (
    <TooltipBody note={metric === 'time' ? ESTIMATE_FORMULA_NOTE : undefined}>
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

function FinishTile({
  finish,
  calendar,
  today,
}: {
  finish: AveragedForecast;
  calendar: WorkCalendar;
  today: string;
}) {
  let value: string;
  let sub: string | undefined;
  if (finish.state !== 'ok') {
    value = FINISH_STATE_TEXT[finish.state];
  } else {
    value = finish.likely ? formatFinishDate(finish.likely, today) : '—';
    if (finish.optimistic && finish.pessimistic) {
      sub = `${formatDateKey(finish.optimistic)}–${formatDateKey(finish.pessimistic)} · ${finish.confidence ?? 'low'} confidence`;
    }
  }

  const holidayCount =
    calendar.source === 'tempo'
      ? holidaysBetween(
          calendar,
          addCalendarDays(today, -HOLIDAY_NOTE_LOOKBACK_DAYS),
          finish.pessimistic ?? today,
        )
      : 0;
  const calendarLine =
    calendar.source === 'tempo'
      ? `Excludes weekends and ${holidayCount} ${holidayCount === 1 ? 'holiday' : 'holidays'} (Tempo)`
      : 'Excludes weekends (holidays unavailable)';
  return (
    <Tile
      label="Finish"
      value={value}
      sub={sub}
      tip={
        <TooltipBody
          title="Projected finish"
          note={
            <>
              {finish.explanation ? <div>{finish.explanation}</div> : null}
              <div>{calendarLine}</div>
            </>
          }
        >
          {finishDateRows(finish).map((r) => (
            <TooltipRow
              key={r.key}
              icon={<MARKER_ICON.date className="size-3" />}
              label={r.label}
              value={formatFinishDate(r.date, today)}
              sub={`${r.n} working day${r.n === 1 ? '' : 's'}`}
            />
          ))}
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
                sub={p.included ? (p.forecast?.confidence ?? undefined) : undefined}
              />
            );
          })}
        </TooltipBody>
      }
    />
  );
}

function RisksTile({ risks }: { risks: EpicRisk[] }) {
  return (
    <Tile
      label="Risks"
      tip={
        <TooltipBody title="Risks">
          {risks.length === 0 ? (
            <TooltipRow icon={<CircleCheck className="size-3" />} label="No risks found" value="" />
          ) : (
            risks.map((r) => {
              const Icon = RISK_ICON[r.key];
              return (
                <div key={r.key} className="grid gap-0.5">
                  <TooltipRow
                    icon={<Icon className="size-3" />}
                    label={r.label}
                    value={r.count ?? ''}
                  />
                  <div className="pl-5 text-muted-foreground">
                    {r.detail}
                    {r.issueKeys.length > 0
                      ? ` · ${r.issueKeys.join(', ')}${r.moreKeys ? ` +${r.moreKeys}` : ''}`
                      : ''}
                  </div>
                </div>
              );
            })
          )}
        </TooltipBody>
      }
    >
      {risks.length === 0 ? (
        <span className="flex items-center gap-1.5 text-lg font-semibold leading-tight text-muted-foreground">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          No risks
        </span>
      ) : (
        <span className="mt-0.5 flex flex-wrap gap-1">
          {risks.map((r) => {
            const Icon = RISK_ICON[r.key];
            return (
              <span
                key={r.key}
                data-testid="epic-risk-chip"
                data-severity={r.severity}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
                  tonePillClass(r.severity === 'warning' ? 'amber' : 'muted'),
                )}
              >
                <Icon aria-hidden="true" className="size-3 shrink-0" />
                {r.text}
              </span>
            );
          })}
        </span>
      )}
    </Tile>
  );
}

export function EpicProgressSummary({
  metric,
  summary,
  time,
  finish,
  risks,
  calendar,
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
        <Hero metric={metric} summary={summary} time={time} />
      </div>
      <FinishTile finish={finish} calendar={calendar} today={today} />
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
      <RisksTile risks={risks} />
    </div>
  );
}
