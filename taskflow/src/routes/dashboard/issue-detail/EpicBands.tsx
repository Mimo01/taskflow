/**
 * Shared band components (quick 261001-rtw). Count and SP render three status bands
 * (done / in progress / to do, weighted 1 / story points), so the hero, assignee rows, chips
 * and tooltips can never disagree. Time bars use TimeBar (status groups, solid logged / faint
 * remaining, amber/red overspend, estimate tick); Time chips and tooltips show Logged vs
 * Remaining (Bands.done = logged, inProgress + todo = remaining; 261103-lcd). The Stories row
 * bars use the same TimeBar, so rows and epic bars add up.
 * No hooks, spans only: the hero renders these inside a <button>.
 */
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
import { SMALL_TEXT } from './EpicStatCard';
import { MARKER_ICON } from './epic-markers';

/** Time view of the bands: logged vs remaining. */
export function timeParts(b: Bands): { logged: number; remaining: number } {
  return { logged: b.done, remaining: b.inProgress + b.todo };
}

const TIME_PARTS = [
  { key: 'logged', label: 'Logged', Icon: MARKER_ICON.logged },
  { key: 'remaining', label: 'Remaining', Icon: MARKER_ICON.remaining },
] as const;

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
    <span
      data-testid={testId}
      className={cn('relative flex w-full gap-px overflow-hidden rounded bg-muted', className)}
    >
      {segments.map((seg) => (
        <span
          key={`${seg.cat}:${seg.part}`}
          data-segment={`${seg.cat}:${seg.part}`}
          className={cn('h-full flex-none', segmentClass(seg))}
          style={{ width: `${pct(seg.seconds)}%`, ...(seg.part === 'remainingOver' ? HATCH : {}) }}
        />
      ))}
      {estimate > 0 && denom > 0 ? (
        <span
          data-testid="time-estimate-tick"
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `calc(${pct(estimate)}% - 1px)` }}
        />
      ) : null}
    </span>
  );
}

function timePct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
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
  if (metric === 'time') {
    const parts = timeParts(bands);
    return (
      <span className="flex flex-none items-center gap-1">
        {TIME_PARTS.map(({ key, label }) => (
          <span
            key={key}
            role="img"
            data-testid="epic-assignee-chip"
            data-part={key}
            aria-label={`${label.toLowerCase()} ${formatChip(parts[key], metric)}`}
            className={cn(
              'w-12 truncate rounded bg-muted px-1 text-center tabular-nums whitespace-nowrap',
              SMALL_TEXT,
              key === 'logged' ? 'text-foreground' : 'text-muted-foreground',
              parts[key] === 0 && 'opacity-40',
            )}
          >
            {formatChip(parts[key], metric)}
          </span>
        ))}
      </span>
    );
  }
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
  if (metric === 'time') {
    const parts = timeParts(bands);
    const total = parts.logged + parts.remaining;
    return (
      <>
        {TIME_PARTS.map(({ key, label, Icon }) => (
          <TooltipRow
            key={key}
            icon={<Icon className="size-3" />}
            label={label}
            value={
              valueAs === 'share'
                ? `${timePct(parts[key], total)}%`
                : formatMetric(parts[key], metric)
            }
            sub={share && valueAs === 'value' ? `${timePct(parts[key], total)}%` : undefined}
          />
        ))}
      </>
    );
  }
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
