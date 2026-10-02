/**
 * Shared status-band components (quick 261001-rtw). Count, SP and Time all render through
 * the same three bands (done / in progress / to do, weighted 1 / story points / estimate
 * seconds), so the hero, assignee rows, chips and tooltips can never disagree.
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
import { CHIP_TEXT } from './EpicStatCard';

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
            CHIP_TEXT,
            metric === 'time' ? 'w-12' : 'w-9',
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
