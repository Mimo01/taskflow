/**
 * EpicProgressSummary — the hero (big %, segmented status bar, "X of Y done") plus a
 * 3-cell stat strip (Finish / Remaining / Risks) at the top of the epic progress section
 * (quick 261001-ilq). Tooltip triggers contain spans only (valid inside a <button>).
 *
 * Text-collision rule (EpicDetailSheet.test): no visible text node equals exactly
 * "Done" / "In Progress" and none says "Stories" — every sentence here is a single
 * lowercase template-literal node.
 */
import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  CAT_LABEL,
  type Cat,
  type EpicForecast,
  type EpicSummary,
  ESTIMATE_FORMULA_NOTE,
  formatDateKey,
  formatMetric,
  type Metric,
  type TimeTotals,
} from '@/lib/epic-progress';
import { STATUS_CATEGORY_COLOR, statusCategoryDotClass, tonePillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/services/jira/duration';

export type ForecastStatus = 'ready' | 'loading' | 'error';

interface EpicProgressSummaryProps {
  metric: Metric;
  summary: EpicSummary;
  time: TimeTotals;
  /** Null while the time-mode forecast has no worklog data yet. */
  forecast: EpicForecast | null;
  forecastStatus: ForecastStatus;
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
        <span className="block truncate text-xs text-muted-foreground">{line}</span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function FinishTile({
  forecast,
  forecastStatus,
  today,
}: {
  forecast: EpicForecast | null;
  forecastStatus: ForecastStatus;
  today: string;
}) {
  if (!forecast) {
    return (
      <Tile
        label="Finish"
        value="—"
        sub={forecastStatus === 'error' ? 'Worklogs unavailable' : 'Loading worklogs'}
        tip={
          <TooltipBody note="The finish date is projected from the logged-time rate.">
            <TooltipRow
              label="Status"
              value={forecastStatus === 'error' ? 'unavailable' : 'loading'}
            />
          </TooltipBody>
        }
      />
    );
  }

  let value: string;
  let sub: string | undefined;
  switch (forecast.state) {
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
      value = forecast.likely ? dateText(forecast.likely, today) : '—';
      if (forecast.nLikely === 0) sub = 'Remaining work is unestimated';
      else if (forecast.optimistic && forecast.pessimistic) {
        sub = `${formatDateKey(forecast.optimistic)}–${formatDateKey(forecast.pessimistic)} · ${forecast.confidence ?? 'low'} confidence`;
      }
  }

  const ok = forecast.state === 'ok' && forecast.nLikely !== 0;
  return (
    <Tile
      label="Finish"
      value={value}
      sub={sub}
      tip={
        <TooltipBody title="Projected finish" note={forecast.explanation || undefined}>
          {ok && forecast.likely && forecast.optimistic && forecast.pessimistic ? (
            <>
              <TooltipRow
                label="Likely"
                value={dateText(forecast.likely, today)}
                sub={`${forecast.nLikely} working days`}
              />
              <TooltipRow
                label="Earliest"
                value={dateText(forecast.optimistic, today)}
                sub={`${forecast.nOpt} working days`}
              />
              <TooltipRow
                label="Latest"
                value={dateText(forecast.pessimistic, today)}
                sub={`${forecast.nPess} working days`}
              />
            </>
          ) : null}
        </TooltipBody>
      }
    />
  );
}

export function EpicProgressSummary({
  metric,
  summary,
  time,
  forecast,
  forecastStatus,
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

  const unestimated = timeMode ? summary.unestimatedTime : summary.unestimatedSp;
  const risks: { key: string; text: string }[] = [];
  if (unestimated > 0) risks.push({ key: 'unestimated', text: `${unestimated} unestimated` });
  if (summary.unassignedOpen > 0) {
    risks.push({ key: 'unassigned', text: `${summary.unassignedOpen} unassigned` });
  }
  if (forecast?.state === 'stalled') risks.push({ key: 'stalled', text: 'stalled' });
  if (forecast?.state === 'not-converging') {
    risks.push({ key: 'scope', text: 'scope growing' });
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
      <div className="min-w-0 sm:col-span-3 lg:col-span-1">
        <Hero metric={metric} summary={summary} time={time} />
      </div>
      <FinishTile forecast={forecast} forecastStatus={forecastStatus} today={today} />
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
      <Tile
        label="Risks"
        tip={
          <TooltipBody>
            <TooltipRow label="Unestimated" value={unestimated} />
            <TooltipRow label="Unassigned open" value={summary.unassignedOpen} />
            {forecast && (forecast.state === 'stalled' || forecast.state === 'not-converging') ? (
              <TooltipRow label="Forecast" value={forecast.state} />
            ) : null}
          </TooltipBody>
        }
      >
        {risks.length === 0 ? (
          <span className="block truncate text-lg font-semibold leading-tight text-muted-foreground">
            None
          </span>
        ) : (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {risks.map((r) => (
              <span
                key={r.key}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
                  tonePillClass('amber'),
                )}
              >
                <AlertTriangle aria-hidden="true" className="size-3 shrink-0" />
                {r.text}
              </span>
            ))}
          </span>
        )}
      </Tile>
    </div>
  );
}
