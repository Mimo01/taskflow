/**
 * EpicProgressSummary — the hero (big %, segmented status bar, "X of Y done") plus a
 * 3-cell stat strip (Finish / Remaining / Risks) at the top of the epic progress section
 * (quick 261001-ilq). Tooltip triggers contain spans only (valid inside a <button>).
 * Four fixed 72px cards (EpicStatCard) in a container-query grid (261002-0xf); the hero
 * tooltip carries at most one short data-source note; the Risks card is a count plus a
 * tally of icon+token pills (one per risk), each with a hover tooltip and a click popover.
 * Confidence shows only in the Finish tooltip, never on the card.
 *
 * Text-collision rule (EpicDetailSheet.test): no visible text node equals exactly
 * "Done" / "In Progress" and none says "Stories" — every sentence here is a single
 * lowercase template-literal node.
 */
import {
  CalendarX,
  CircleCheck,
  CircleDashed,
  CirclePause,
  Gauge,
  TrendingUp,
  UserX,
} from 'lucide-react';
import { type KeyboardEvent, type ReactNode, type RefObject, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLTIP_SURFACE, TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  type AveragedForecast,
  confidenceReason,
  type EpicRisk,
  type EpicSummary,
  FINISH_STATE_TEXT,
  finishStateSub,
  formatDateRange,
  formatFinishDate,
  formatMetric,
  METRIC_LABEL,
  type Metric,
  type RiskKey,
  summaryBands,
  type TimeTotals,
} from '@/lib/epic-progress';
import { cn } from '@/lib/utils';
import { formatDuration, formatDurationCompact } from '@/services/jira/duration';
import { ConfidenceMeter } from './ConfidenceMeter';
import { BandBar, BandBreakdown } from './EpicBands';
import {
  SMALL_TEXT,
  STAT_CARD_CLASS,
  STAT_CARD_FOCUS,
  STAT_CONTAINER_CLASS,
  STAT_GRID_CLASS,
  StatCardBody,
} from './EpicStatCard';
import { MARKER_ICON, METRIC_ICON } from './epic-markers';

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
  /** One short note for the hero tooltip, only when a data source is approximate / default. */
  sourceNote: string | null;
  /** Opens an issue (same handler as the Stories rows); risk keys call it. */
  onOpenIssue?: (key: string) => void;
  today: string;
}

const REMAINING_NOTE = 'Open items \u00b7 Time = estimate \u2212 logged';

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Compact "done of total" caption for the hero value row. */
function heroCaption(metric: Metric, summary: EpicSummary, done: number): string {
  if (metric === 'count') return `${done} of ${summary.total}`;
  if (metric === 'sp')
    return `${formatMetric(done, 'sp').replace(' SP', '')} of ${formatMetric(summary.total, 'sp')}`;
  return `${formatDurationCompact(done)} of ${formatDurationCompact(summary.total)}`;
}

function Hero({
  metric,
  summary,
  time,
  sourceNote,
}: {
  metric: Metric;
  summary: EpicSummary;
  time: TimeTotals;
  sourceNote: string | null;
}) {
  // One model for every tab: done / in progress / to do weighted by the active metric.
  const bands = summaryBands(summary);
  const bigText = summary.total === 0 ? '\u2014' : `${summary.pctDone}%`;
  const tip = (
    <TooltipBody
      note={sourceNote ? <span data-testid="hero-source-note">{sourceNote}</span> : undefined}
    >
      <BandBreakdown bands={bands} metric={metric} share />
      {metric === 'time' ? (
        <TooltipRow
          icon={<MARKER_ICON.logged className="size-3" />}
          label="Logged"
          value={formatDuration(time.logged)}
        />
      ) : null}
    </TooltipBody>
  );

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        data-testid="epic-hero"
        data-stat-card=""
        className={cn(STAT_CARD_CLASS, STAT_CARD_FOCUS)}
      >
        <StatCardBody
          label="Completed"
          value={
            <>
              <span className="text-3xl font-semibold leading-none tabular-nums">{bigText}</span>
              <span
                data-testid="epic-hero-caption"
                className="min-w-0 truncate text-xs text-muted-foreground"
              >
                {heroCaption(metric, summary, bands.done)}
              </span>
            </>
          }
          sub={<BandBar bands={bands} className="h-2 w-3/4 max-w-40" testId="epic-hero-bar" />}
        />
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

const VALUE_CLASS = 'truncate text-lg font-semibold leading-none';

/** A tile card: label / value / sub with its tooltip. */
function Tile({
  label,
  value,
  sub,
  tip,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tip: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        data-testid="epic-stat-tile"
        data-stat-card=""
        className={cn(STAT_CARD_CLASS, STAT_CARD_FOCUS)}
      >
        <StatCardBody
          label={label}
          value={<span className={VALUE_CLASS}>{value}</span>}
          sub={sub}
        />
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function FinishTile({ finish, today }: { finish: AveragedForecast; today: string }) {
  let value: string;
  let sub: ReactNode;
  let tip: ReactNode;
  if (finish.state !== 'ok') {
    value = FINISH_STATE_TEXT[finish.state];
    const reason = finishStateSub(finish);
    sub = reason ? <span className="min-w-0 truncate">{reason}</span> : undefined;
    tip = (
      <TooltipBody>
        {finish.parts.map((p) => {
          const Icon = METRIC_ICON[p.metric];
          return (
            <TooltipRow
              key={p.metric}
              icon={<Icon className="size-3" />}
              label={METRIC_LABEL[p.metric]}
              value={p.included ? 'included' : (p.reason ?? '')}
            />
          );
        })}
      </TooltipBody>
    );
  } else {
    value = finish.likely ? formatFinishDate(finish.likely, today) : '\u2014';
    const range =
      finish.optimistic && finish.pessimistic
        ? formatDateRange(finish.optimistic, finish.pessimistic, today)
        : null;
    if (range) {
      sub = <span className="min-w-0 truncate">{range}</span>;
    }
    const reason = confidenceReason(finish);
    const included = finish.parts.filter((p) => p.included).map((p) => METRIC_LABEL[p.metric]);
    tip = (
      <TooltipBody
        note={reason ? <span data-testid="confidence-reason">{reason}</span> : undefined}
      >
        {finish.likely ? (
          <TooltipRow
            icon={<MARKER_ICON.date className="size-3" />}
            label="Likely"
            value={formatFinishDate(finish.likely, today)}
            sub={
              finish.nLikely !== null
                ? `${finish.nLikely} working day${finish.nLikely === 1 ? '' : 's'}`
                : undefined
            }
          />
        ) : null}
        {range ? (
          <TooltipRow icon={<MARKER_ICON.date className="size-3" />} label="Range" value={range} />
        ) : null}
        {finish.confidence !== null ? (
          <TooltipRow
            icon={<Gauge className="size-3" />}
            label="Confidence"
            value={<ConfidenceMeter level={finish.confidence} />}
          />
        ) : null}
        <TooltipRow
          icon={<MARKER_ICON.date className="size-3" />}
          label="Based on"
          value={included.join(' \u00b7 ')}
        />
      </TooltipBody>
    );
  }

  return <Tile label="Finish" value={value} sub={sub} tip={tip} />;
}

const ROW_LAYOUT = 'flex w-full min-w-0 items-center gap-2 rounded px-1.5 py-1 text-left';

function riskIconClass(risk: EpicRisk): string {
  return cn(
    'size-3 shrink-0',
    risk.severity === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
  );
}

function onListKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const rows = [
    ...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-testid="epic-risk-issue"]'),
  ];
  if (rows.length === 0) return;
  const at = rows.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? rows.length - 1
        : e.key === 'ArrowDown'
          ? Math.min(at + 1, rows.length - 1)
          : Math.max(at - 1, 0);
  rows[next].focus();
  e.preventDefault();
}

/** Popover body for one risk: header, detail and the affected-issue list. */
function RiskPanel({
  risk,
  onOpenIssue,
  firstRow,
  onPick,
  separated,
}: {
  risk: EpicRisk;
  onOpenIssue?: (key: string) => void;
  firstRow?: RefObject<HTMLButtonElement | null>;
  onPick: () => void;
  separated?: boolean;
}) {
  const Icon = RISK_ICON[risk.key];
  return (
    <div className={cn(separated && 'mt-2 border-t border-border/50 pt-2')}>
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Icon aria-hidden="true" className={riskIconClass(risk)} />
        <span className="min-w-0 truncate">{risk.text}</span>
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
                    ROW_LAYOUT,
                    'cursor-pointer hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                  )}
                  onClick={() => {
                    onPick();
                    onOpenIssue(issue.key);
                  }}
                >
                  <span className="flex-none font-mono text-xs text-muted-foreground">
                    {issue.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{issue.summary}</span>
                </button>
              ) : (
                <div data-testid="epic-risk-issue" className={ROW_LAYOUT}>
                  <span className="flex-none font-mono text-xs text-muted-foreground">
                    {issue.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{issue.summary}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * One button that is both the hover tooltip trigger and the click popover trigger.
 * The tooltip is suppressed while the popover is open so the two never fight.
 */
function TipPopover({
  tip,
  triggerProps,
  triggerClass,
  trigger,
  initialFocus,
  children,
}: {
  tip: ReactNode;
  triggerProps: Record<string, string>;
  triggerClass: string;
  trigger: ReactNode;
  initialFocus: RefObject<HTMLElement | null> | boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  // Closing the popover returns focus to the trigger, which would re-open the tooltip at once
  // (tooltip and popover flashing back-to-back). Ignore tooltip opens until the pointer leaves
  // or focus moves away.
  const suppressTip = useRef(false);
  const release = () => {
    suppressTip.current = false;
  };
  return (
    <Tooltip
      open={tipOpen && !open}
      onOpenChange={(next) => {
        if (next && suppressTip.current) return;
        setTipOpen(next);
      }}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setTipOpen(false);
          if (!next) suppressTip.current = true;
        }}
      >
        <TooltipTrigger
          onPointerLeave={release}
          onBlur={release}
          render={<PopoverTrigger type="button" className={triggerClass} {...triggerProps} />}
        >
          {trigger}
        </TooltipTrigger>
        <PopoverContent
          data-testid="epic-risk-popover"
          initialFocus={initialFocus}
          className={cn(TOOLTIP_SURFACE, 'w-72 border-0 p-2.5 shadow-xl')}
        >
          {children(() => setOpen(false))}
        </PopoverContent>
      </Popover>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

const RISK_PILL_BASE = cn(
  'inline-flex h-4 flex-none cursor-pointer items-center gap-1 rounded-full px-1.5 tabular-nums ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  SMALL_TEXT,
);
const RISK_PILL_TONE = {
  warning: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400',
  info: 'bg-muted text-muted-foreground ring-foreground/10',
} as const;

function RiskItem({
  risk,
  onOpenIssue,
}: {
  risk: EpicRisk;
  /** Absent when the host can't open issues; rows then render as plain text, not dead buttons. */
  onOpenIssue?: (key: string) => void;
}) {
  const firstRow = useRef<HTMLButtonElement>(null);
  const Icon = RISK_ICON[risk.key];
  return (
    <TipPopover
      tip={
        <TooltipBody>
          <span className="text-muted-foreground">{risk.detail}</span>
        </TooltipBody>
      }
      triggerProps={{
        'data-testid': 'epic-risk-item',
        'data-severity': risk.severity,
        'aria-label': risk.text,
      }}
      triggerClass={cn(RISK_PILL_BASE, RISK_PILL_TONE[risk.severity])}
      trigger={
        <>
          <Icon aria-hidden="true" className="size-3 shrink-0" />
          {risk.token !== null ? <span>{risk.token}</span> : null}
        </>
      }
      initialFocus={onOpenIssue && risk.issues.length > 0 ? firstRow : true}
    >
      {(close) => (
        <RiskPanel risk={risk} onOpenIssue={onOpenIssue} firstRow={firstRow} onPick={close} />
      )}
    </TipPopover>
  );
}

function RisksTile({
  risks,
  onOpenIssue,
}: {
  risks: EpicRisk[];
  onOpenIssue?: (key: string) => void;
}) {
  const value =
    risks.length === 0 ? (
      <span className="flex items-center gap-1.5 text-lg font-semibold leading-none text-muted-foreground">
        <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
        No risks
      </span>
    ) : (
      <span className={VALUE_CLASS}>{plural(risks.length, 'risk', 'risks')}</span>
    );
  return (
    <div data-testid="epic-stat-tile" data-stat-card="" className={STAT_CARD_CLASS}>
      <StatCardBody
        label="Risks"
        value={value}
        sub={
          risks.length > 0 ? (
            <span className="flex min-w-0 items-center gap-1.5">
              {risks.map((r) => (
                <RiskItem key={`${r.key}-${r.severity}`} risk={r} onOpenIssue={onOpenIssue} />
              ))}
            </span>
          ) : undefined
        }
      />
    </div>
  );
}

export function EpicProgressSummary({
  metric,
  summary,
  time,
  finish,
  risks,
  sourceNote,
  onOpenIssue,
  today,
}: EpicProgressSummaryProps) {
  const remainingParts = {
    count: plural(summary.remainingCount, 'item', 'items'),
    sp: formatMetric(summary.remainingSp, 'sp'),
    time: formatDurationCompact(summary.remainingSeconds),
  };
  const others = (['count', 'sp', 'time'] as const)
    .filter((m) => m !== metric)
    .map((m) => remainingParts[m])
    .join(' \u00b7 ');

  return (
    <div className={STAT_CONTAINER_CLASS}>
      <div className={STAT_GRID_CLASS}>
        <Hero metric={metric} summary={summary} time={time} sourceNote={sourceNote} />
        <FinishTile finish={finish} today={today} />
        <Tile
          label="Remaining"
          value={remainingParts[metric]}
          sub={<span className="min-w-0 truncate">{others}</span>}
          tip={<TooltipBody>{REMAINING_NOTE}</TooltipBody>}
        />
        <RisksTile risks={risks} onOpenIssue={onOpenIssue} />
      </div>
    </div>
  );
}
