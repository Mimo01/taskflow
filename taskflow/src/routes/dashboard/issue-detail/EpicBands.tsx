/**
 * Shared band components (quick 261001-rtw). Count and SP render three status bands
 * (done / in progress / to do, weighted 1 / story points), so the hero, assignee rows, chips
 * and tooltips can never disagree. Time renders two neutral parts instead — Logged vs
 * Remaining (Bands.done = logged, inProgress + todo = remaining; 261103-lcd) — the same split
 * as each Stories row bar, so rows and epic bars add up.
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
} from '@/lib/epic-progress';
import {
  STATUS_CATEGORY_COLOR,
  statusCategoryBadgeClass,
  statusCategoryDotClass,
} from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { SMALL_TEXT } from './EpicStatCard';
import { MARKER_ICON } from './epic-markers';

/** Neutral fills for Time (not a status, so no status colour): logged solid, remaining faint. */
export const LOGGED_FILL = 'bg-muted-foreground';
export const REMAINING_FILL = 'bg-muted-foreground/25';

/** Time view of the bands: logged vs remaining. */
export function timeParts(b: Bands): { logged: number; remaining: number } {
  return { logged: b.done, remaining: b.inProgress + b.todo };
}

const TIME_PARTS = [
  { key: 'logged', label: 'Logged', fill: LOGGED_FILL, Icon: MARKER_ICON.logged },
  { key: 'remaining', label: 'Remaining', fill: REMAINING_FILL, Icon: MARKER_ICON.remaining },
] as const;

function timePct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

/** Segmented bar. Height comes from className; widths are value / (scale ?? total). */
export function BandBar({
  bands,
  metric,
  scale,
  className,
  testId,
}: {
  bands: Bands;
  /** Time renders Logged vs Remaining instead of the three status bands. */
  metric?: Metric;
  /** Denominator override (e.g. the largest assignee total so rows share one scale). */
  scale?: number;
  className?: string;
  testId?: string;
}) {
  const denom = scale ?? bandTotal(bands);
  if (metric === 'time') {
    const parts = timeParts(bands);
    return (
      <span
        data-testid={testId}
        className={cn('flex w-full gap-px overflow-hidden rounded bg-muted', className)}
      >
        {TIME_PARTS.filter(({ key }) => parts[key] > 0).map(({ key, fill }) => (
          <span
            key={key}
            data-segment={key}
            className={cn('h-full', fill)}
            style={{ width: `${denom > 0 ? (parts[key] / denom) * 100 : 0}%` }}
          />
        ))}
      </span>
    );
  }
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
