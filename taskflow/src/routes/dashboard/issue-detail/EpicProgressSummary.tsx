/**
 * EpicProgressSummary — the hero (big %, segmented status bar, "X of Y done") plus a
 * 3-cell stat strip (Finish / Remaining / Risks) at the top of the epic progress section
 * (quick 261001-ilq). Tooltip triggers contain spans only (valid inside a <button>).
 *
 * Text-collision rule (EpicDetailSheet.test): no visible text node equals exactly
 * "Done" / "In Progress" and none says "Stories" — every sentence here is a single
 * lowercase template-literal node.
 */
import { CalendarX, CircleCheck, CircleDashed, Hourglass, TrendingUp, UserX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  type AveragedForecast,
  addCalendarDays,
  CAT_LABEL,
  type Cat,
  type EpicRisk,
  type EpicSummary,
  ESTIMATE_FORMULA_NOTE,
  formatDateKey,
  formatMetric,
  holidaysBetween,
  METRIC_LABEL,
  type Metric,
  type RiskKey,
  type TimeTotals,
  type WorkCalendar,
} from '@/lib/epic-progress';
import { STATUS_CATEGORY_COLOR, statusCategoryDotClass, tonePillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/services/jira/duration';

/** Look-back for the holiday count in the Finish note (about the 30-working-day max window). */
const HOLIDAY_NOTE_LOOKBACK_DAYS = 42;

const RISK_ICON: Record<RiskKey, typeof CalendarX> = {
  overdue: CalendarX,
  late: CalendarX,
  stalled: Hourglass,
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

const CATS: Cat[] = ['done', 'indeterminate', 'new'];

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

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function dateText(key: string, today: string): string {
  const base = formatDateKey(key);
  return key.slice(0, 4) !== today.slice(0, 4) ? `${base}, ${key.slice(0, 4)}` : base;
}

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
  const timeMode = metric === 'time';
  const bigText = timeMode
    ? time.pctLogged === null
      ? '—'
      : `${time.pctLogged}%`
    : `${summary.pctDone}%`;

  let segments: { key: string; cls: string; width: number }[];
  let line: string;
  let tip: ReactNode;
  if (timeMode) {
    const loggedShare = time.estimated > 0 ? Math.min(time.logged / time.estimated, 1) : 0;
    segments = [
      { key: 'logged', cls: statusCategoryDotClass('done'), width: loggedShare * 100 },
      {
        key: 'remaining',
        cls: statusCategoryDotClass('indeterminate'),
        width: time.estimated > 0 ? (1 - loggedShare) * 100 : 0,
      },
    ];
    line = `${formatDuration(time.logged)} of ${formatDuration(time.estimated)} logged`;
    tip = (
      <TooltipBody note={ESTIMATE_FORMULA_NOTE}>
        <TooltipRow
          color={STATUS_CATEGORY_COLOR.done}
          label="Logged"
          value={formatDuration(time.logged)}
        />
        <TooltipRow
          color={STATUS_CATEGORY_COLOR.indeterminate}
          label="Remaining"
          value={formatDuration(time.remaining)}
        />
        <TooltipRow
          color={STATUS_CATEGORY_COLOR.new}
          label="Estimate"
          value={formatDuration(time.estimated)}
        />
      </TooltipBody>
    );
  } else {
    const totals: Record<Cat, number> = {
      done: summary.doneTotal,
      indeterminate: summary.inProgressTotal,
      new: summary.todoTotal,
    };
    segments = CATS.map((c) => ({
      key: c,
      cls: statusCategoryDotClass(c),
      width: pct(totals[c], summary.total),
    }));
    line = `${formatMetric(summary.doneTotal, metric)} of ${formatMetric(summary.total, metric)} done · ${formatMetric(summary.inProgressTotal, metric)} in progress`;
    tip = (
      <TooltipBody>
        {CATS.map((c) => (
          <TooltipRow
            key={c}
            color={STATUS_CATEGORY_COLOR[c]}
            label={CAT_LABEL[c]}
            value={formatMetric(totals[c], metric)}
            sub={`${pct(totals[c], summary.total)}%`}
          />
        ))}
      </TooltipBody>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        data-testid="epic-hero"
        className="flex min-w-0 cursor-default flex-col gap-1.5 text-left"
      >
        <span className="text-3xl font-semibold leading-none tabular-nums">{bigText}</span>
        <span
          data-testid="epic-hero-bar"
          className="flex h-2 w-full gap-px overflow-hidden rounded bg-muted"
        >
          {segments
            .filter((s) => s.width > 0)
            .map((s) => (
              <span
                key={s.key}
                data-segment={s.key}
                className={cn('h-full', s.cls)}
                style={{ width: `${s.width}%` }}
              />
            ))}
        </span>
        <span
          data-testid="epic-hero-caption"
          className="mt-1 block truncate text-xs text-muted-foreground"
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
  switch (finish.state) {
    case 'done':
      value = 'Complete';
      break;
    case 'too-early':
      value = 'Too early to tell';
      break;
    case 'stalled':
      value = 'Stalled';
      break;
    case 'not-converging':
      value = 'Not converging';
      break;
    default:
      value = finish.likely ? dateText(finish.likely, today) : '—';
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
  const ok = finish.state === 'ok' && finish.likely && finish.optimistic && finish.pessimistic;
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
          {ok ? (
            <>
              <TooltipRow
                label="Likely"
                value={dateText(finish.likely as string, today)}
                sub={`${finish.nLikely} working days`}
              />
              <TooltipRow
                label="Earliest"
                value={dateText(finish.optimistic as string, today)}
                sub={`${finish.nOpt} working days`}
              />
              <TooltipRow
                label="Latest"
                value={dateText(finish.pessimistic as string, today)}
                sub={`${finish.nPess} working days`}
              />
            </>
          ) : null}
          {finish.parts.map((p) => (
            <TooltipRow
              key={p.metric}
              label={METRIC_LABEL[p.metric]}
              value={
                p.included && p.forecast?.likely ? dateText(p.forecast.likely, today) : p.reason
              }
              sub={p.included ? (p.forecast?.confidence ?? undefined) : undefined}
            />
          ))}
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
            <TooltipRow
              icon={<CircleCheck className="size-3" />}
              color="var(--color-muted-foreground)"
              label="No risks found"
              value=""
            />
          ) : (
            risks.map((r) => {
              const Icon = RISK_ICON[r.key];
              return (
                <div key={r.key} className="grid gap-0.5">
                  <TooltipRow
                    icon={<Icon className="size-3" />}
                    color={
                      r.severity === 'warning'
                        ? 'var(--color-amber-500)'
                        : 'var(--color-muted-foreground)'
                    }
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
  const timeMode = metric === 'time';

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
          <TooltipBody
            note={
              timeMode
                ? "Open stories: estimate minus logged, never below 0. Replaces Jira's remaining estimate so it matches the chart."
                : undefined
            }
          >
            <TooltipRow label="Items" value={remainingParts.count} />
            <TooltipRow label="Story points" value={remainingParts.sp} />
            <TooltipRow label="Time" value={remainingParts.time} />
          </TooltipBody>
        }
      />
      <RisksTile risks={risks} />
    </div>
  );
}
