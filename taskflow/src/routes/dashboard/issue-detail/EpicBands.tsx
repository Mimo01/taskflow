/**
 * Shared band components (quick 261001-rtw). Count and SP render three status bands
 * (done / in progress / to do, weighted 1 / story points), so the hero, assignee rows, chips
 * and tooltips can never disagree. Time bars use TimeBar (status groups, solid logged / faint
 * remaining, amber/red overspend, estimate tick); Time chips and tooltips show Logged vs
 * Remaining (Bands.done = logged, inProgress + todo = remaining; 261103-lcd). The Stories row
 * bars use the same TimeBar, so rows and epic bars add up.
 * No hooks, spans only: the hero renders these inside a <button>.
 */
import type { ReactNode } from 'react';
import { TooltipRow } from '@/components/ui/tooltip-body';
import {
  BANDS,
  type Bands,
  bandPct,
  bandTotal,
  CAT_LABEL,
  formatChip,
  formatMetric,
  type Metric,
  type TimeSegment,
} from '@/lib/epic-progress';
import {
  STATUS_CATEGORY_COLOR,
  statusCategoryBadgeClass,
  statusCategoryDotClass,
} from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { formatDurationCompact } from '@/services/jira/duration';
import { SMALL_TEXT } from './EpicStatCard';
import { MARKER_ICON } from './epic-markers';

/** Faint diagonal stripes on forecast overspend (remaining beyond the estimate). */
const HATCH = {
  backgroundImage:
    'repeating-linear-gradient(135deg, transparent 0 3px, rgb(255 255 255 / 0.55) 3px 5px)',
};

function segmentClass(seg: TimeSegment): string {
  const over = seg.severe ? 'bg-red-500' : 'bg-amber-500';
  switch (seg.part) {
    case 'logged':
      return statusCategoryDotClass(seg.cat);
    case 'loggedOver':
      return over;
    case 'remaining':
      return cn(statusCategoryDotClass(seg.cat), 'opacity-35');
    case 'remainingOver':
      return cn(over, 'opacity-35');
  }
}

/** Σ seconds of a segment list (= logged + remaining). */
export function segmentsTotal(segments: TimeSegment[]): number {
  return segments.reduce((n, s) => n + s.seconds, 0);
}

/**
 * Time bar (261103-lcd option 1): status groups done → in progress → to do; inside each, solid =
 * logged, faint = remaining; beyond the estimate amber (red past 125%), striped when forecast.
 * A tick marks the original estimate. Width denominator = max(total, estimate) unless `scale`.
 */
export function TimeBar({
  segments,
  estimate,
  scale,
  className,
  testId,
}: {
  segments: TimeSegment[];
  estimate: number;
  /** Shared denominator (e.g. the largest person) so rows compare by length. */
  scale?: number;
  className?: string;
  testId?: string;
}) {
  const denom = scale ?? Math.max(segmentsTotal(segments), estimate);
  const pct = (n: number) => (denom > 0 ? Math.min(n / denom, 1) * 100 : 0);
  return (
    // Outer box sizes the bar and hosts the tick; only the inner track clips to the rounding,
    // so a tick at either end is never cut off by the rounded corners.
    <span data-testid={testId} className={cn('relative flex w-full rounded', className)}>
      <span className="flex h-full w-full gap-px overflow-hidden rounded-[inherit] bg-muted">
        {segments.map((seg) => (
          <span
            key={`${seg.cat}:${seg.part}`}
            data-segment={`${seg.cat}:${seg.part}`}
            className={cn('h-full flex-none', segmentClass(seg))}
            style={{
              width: `${pct(seg.seconds)}%`,
              ...(seg.part === 'remainingOver' ? HATCH : {}),
            }}
          />
        ))}
      </span>
      {estimate > 0 && denom > 0 ? (
        <span
          data-testid="time-estimate-tick"
          data-pct={pct(estimate)}
          aria-hidden="true"
          className="absolute -inset-y-0.5 w-0.5 rounded-full bg-foreground"
          style={{ left: `clamp(0px, calc(${pct(estimate)}% - 1px), calc(100% - 2px))` }}
        />
      ) : null}
    </span>
  );
}

/** Segmented bar. Height comes from className; widths are value / (scale ?? total). */
export function BandBar({
  bands,
  scale,
  className,
  testId,
}: {
  bands: Bands;
  /** Denominator override (e.g. the largest assignee total so rows share one scale). */
  scale?: number;
  className?: string;
  testId?: string;
}) {
  const denom = scale ?? bandTotal(bands);
  return (
    <span
      data-testid={testId}
      className={cn('flex w-full gap-px overflow-hidden rounded bg-muted', className)}
    >
      {BANDS.filter(({ key }) => bands[key] > 0).map(({ key, cat }) => (
        <span
          key={key}
          data-segment={cat}
          className={cn('h-full', statusCategoryDotClass(cat))}
          style={{ width: `${denom > 0 ? (bands[key] / denom) * 100 : 0}%` }}
        />
      ))}
    </span>
  );
}

/** One chip per band; the category word lives in the aria-label. */
export function BandChips({ bands, metric }: { bands: Bands; metric: Metric }) {
  return (
    <span className="flex flex-none items-center gap-1">
      {BANDS.map(({ key, cat }) => (
        <span
          key={key}
          role="img"
          data-testid="epic-assignee-chip"
          data-cat={cat}
          aria-label={`${CAT_LABEL[cat].toLowerCase()} ${formatChip(bands[key], metric)}`}
          className={cn(
            'truncate rounded px-1 text-center tabular-nums whitespace-nowrap',
            SMALL_TEXT,
            'w-9',
            statusCategoryBadgeClass(cat),
            bands[key] === 0 && 'opacity-40',
          )}
        >
          {formatChip(bands[key], metric)}
        </span>
      ))}
    </span>
  );
}

/** Tooltip rows for the three bands (status swatches); `share` adds the percentage. */
export function BandBreakdown({
  bands,
  metric,
  share,
  valueAs = 'value',
}: {
  bands: Bands;
  metric: Metric;
  share?: boolean;
  /** 'share' shows the percentage as the value (no sub), e.g. the assignee tooltip. */
  valueAs?: 'value' | 'share';
}) {
  return (
    <>
      {BANDS.map(({ key, cat }) => (
        <TooltipRow
          key={key}
          marker="status"
          color={STATUS_CATEGORY_COLOR[cat]}
          label={CAT_LABEL[cat]}
          value={valueAs === 'share' ? `${bandPct(bands, key)}%` : formatMetric(bands[key], metric)}
          sub={share && valueAs === 'value' ? `${bandPct(bands, key)}%` : undefined}
        />
      ))}
    </>
  );
}

const OVER_TEXT = {
  amber: 'text-amber-700 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  under: 'text-green-700 dark:text-green-400',
} as const;
const OVER_CHIP = {
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  red: 'bg-red-500/15 text-red-600 dark:text-red-400',
  under: 'bg-green-500/15 text-green-700 dark:text-green-400',
} as const;
const MINUS = '\u2212';

/** "+2h over" / "−1h under" (both when a status has stories on each side). */
function overUnderSub(g: TimeGroup): ReactNode {
  if (g.over <= 0 && g.under <= 0) return undefined;
  return (
    <span className="inline-flex gap-1.5">
      {g.over > 0 ? (
        <span className={OVER_TEXT[g.severe ? 'red' : 'amber']}>
          {`+${formatDurationCompact(g.over)} over`}
        </span>
      ) : null}
      {g.under > 0 ? (
        <span className={OVER_TEXT.under}>{`${MINUS}${formatDurationCompact(g.under)} under`}</span>
      ) : null}
    </span>
  );
}

export interface TimeGroup {
  cat: TimeSegment['cat'];
  logged: number;
  left: number;
  over: number;
  /** Under budget: forecast below the estimate (opposite of over). */
  under: number;
  severe: boolean;
}
/** Under-budget seconds per status (deriveTimeUnder). */
export type TimeUnder = Record<TimeSegment['cat'], number>;
const NO_UNDER: TimeUnder = { done: 0, indeterminate: 0, new: 0 };

/** Per status group (done → in progress → to do): logged, left and overspend seconds. */
export function timeGroups(segments: TimeSegment[], under: TimeUnder = NO_UNDER): TimeGroup[] {
  return BANDS.map(({ cat }) => {
    const g: TimeGroup = { cat, logged: 0, left: 0, over: 0, under: under[cat], severe: false };
    for (const s of segments) {
      if (s.cat !== cat) continue;
      if (s.part === 'logged' || s.part === 'loggedOver') g.logged += s.seconds;
      else g.left += s.seconds;
      if (s.part === 'loggedOver' || s.part === 'remainingOver') {
        g.over += s.seconds;
        if (s.severe) g.severe = true;
      }
    }
    return g;
  });
}

/** Totals of a Time bar: logged, left, overspend (Σ per story beyond its estimate) and severity. */
export function timeSummary(segments: TimeSegment[], under: TimeUnder = NO_UNDER) {
  const groups = timeGroups(segments, under);
  return {
    logged: groups.reduce((n, g) => n + g.logged, 0),
    left: groups.reduce((n, g) => n + g.left, 0),
    over: groups.reduce((n, g) => n + g.over, 0),
    under: groups.reduce((n, g) => n + g.under, 0),
    severe: groups.some((g) => g.over > 0 && g.severe),
  };
}

function groupValue(g: TimeGroup): string {
  const parts = [];
  if (g.logged > 0) parts.push(`${formatDurationCompact(g.logged)} logged`);
  if (g.left > 0) parts.push(`${formatDurationCompact(g.left)} left`);
  return parts.length > 0 ? parts.join(' \u00b7 ') : '\u2014';
}

/**
 * Time tooltip (261103-lcd): one row per status (logged · left, with its overspend) and an
 * Estimate row with the forecast. Four rows.
 */
export function TimeBreakdown({
  segments,
  under,
  estimate,
}: {
  segments: TimeSegment[];
  under?: TimeUnder;
  estimate: number;
}) {
  const groups = timeGroups(segments, under);
  const forecast = segmentsTotal(segments);
  const delta = forecast - estimate;
  return (
    <>
      {groups.map((g) => (
        <TooltipRow
          key={g.cat}
          marker="status"
          color={STATUS_CATEGORY_COLOR[g.cat]}
          label={CAT_LABEL[g.cat]}
          value={groupValue(g)}
          sub={overUnderSub(g)}
        />
      ))}
      <TooltipRow
        icon={<MARKER_ICON.estimate className="size-3" />}
        label="Estimate"
        value={estimate > 0 ? formatDurationCompact(estimate) : 'none'}
        sub={
          estimate > 0
            ? `forecast ${formatDurationCompact(forecast)}${
                delta !== 0
                  ? ` (${delta > 0 ? '+' : '\u2212'}${formatDurationCompact(Math.abs(delta))})`
                  : ''
              }`
            : undefined
        }
      />
    </>
  );
}

/** Time chips after a person bar: logged · left · estimate · net over (+ amber/red) or under (− green). */
export function TimeChips({
  segments,
  under,
  estimate,
}: {
  segments: TimeSegment[];
  under?: TimeUnder;
  estimate: number;
}) {
  const t = timeSummary(segments, under);
  // Net of per-story overspend and under-budget: + amber / red, − green, 0 dimmed.
  const net = t.over - t.under;
  const tone = net > 0 ? OVER_CHIP[t.severe ? 'red' : 'amber'] : net < 0 ? OVER_CHIP.under : null;
  const chips = [
    { key: 'logged', label: 'logged', value: t.logged, tone: 'text-foreground' },
    { key: 'left', label: 'left', value: t.left, tone: 'text-muted-foreground' },
    { key: 'estimate', label: 'estimate', value: estimate, tone: 'text-muted-foreground' },
  ] as const;
  return (
    <span className="flex flex-none items-center gap-1">
      {chips.map((c) => (
        <span
          key={c.key}
          role="img"
          data-testid="epic-assignee-chip"
          data-part={c.key}
          aria-label={`${c.label} ${formatChip(c.value, 'time')}`}
          className={cn(
            'w-15 truncate rounded bg-muted px-1 text-center tabular-nums whitespace-nowrap',
            SMALL_TEXT,
            c.tone,
            c.value === 0 && 'opacity-40',
          )}
        >
          {formatChip(c.value, 'time')}
        </span>
      ))}
      <span
        role="img"
        data-testid="epic-assignee-chip"
        data-part="delta"
        aria-label={
          net > 0
            ? `over ${formatChip(net, 'time')}`
            : net < 0
              ? `under ${formatChip(-net, 'time')}`
              : `on estimate ${formatChip(0, 'time')}`
        }
        className={cn(
          'w-15 truncate rounded px-1 text-center tabular-nums whitespace-nowrap',
          SMALL_TEXT,
          tone ?? 'bg-muted text-muted-foreground opacity-40',
        )}
      >
        {net > 0
          ? `+${formatChip(net, 'time')}`
          : net < 0
            ? `${MINUS}${formatChip(-net, 'time')}`
            : formatChip(0, 'time')}
      </span>
    </span>
  );
}
