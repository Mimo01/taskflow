/**
 * EpicChartTooltip — custom recharts tooltip content for the epic CFD and time charts
 * (quick 261001-ilq). Reads the hovered DATUM (payload[0].payload) rather than the
 * per-series items, so row order is fixed and range-array values never reach a
 * formatter. Renders on the shared TOOLTIP_SURFACE like every other tooltip.
 */
import { TOOLTIP_SURFACE, TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { formatDateKey, formatMetric, type Metric } from '@/lib/epic-progress';
import { STATUS_CATEGORY_COLOR } from '@/lib/statusStyles';

export interface ChartDatum {
  date: string;
  t: number;
  remaining?: number | null;
  forecast?: number | null;
  band?: [number, number] | null;
  /** Working days from today (projection rows). */
  wd?: number | null;
  workingDay?: boolean | null;
  [key: string]: unknown;
}

export interface ChartRowSpec {
  key: string;
  label: string;
  value: string;
  /** CSS colour of the swatch. */
  color: string;
  dashed?: boolean;
  /** Line series use 'line'; area/status series keep the swatch. */
  marker?: 'swatch' | 'line';
}

interface EpicChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  metric: Metric;
  /** Rows for a history datum (the chart supplies its own series). */
  rows: (d: ChartDatum) => ChartRowSpec[];
  /** Formats a forecast / range value; defaults to formatMetric(n, metric). */
  formatValue?: (n: number) => string;
  /** Set when the pessimistic bound was clipped to the axis cap. */
  clippedAfter?: string | null;
}

/** Forecast / Remaining are not statuses: neutral colours that never collide with a status colour. */
export const FORECAST_COLOR = 'var(--color-muted-foreground)';
export const REMAINING_COLOR = 'var(--color-foreground)';

/** CFD history rows, in fixed order: Completed / In progress / To do / Remaining. */
export function cfdRows(metric: Metric): (d: ChartDatum) => ChartRowSpec[] {
  const v = (n: unknown) => formatMetric(Number(n ?? 0), metric);
  return (d) => [
    { key: 'done', label: 'Completed', value: v(d.done), color: STATUS_CATEGORY_COLOR.done },
    {
      key: 'inProgress',
      label: 'In progress',
      value: v(d.inProgress),
      color: STATUS_CATEGORY_COLOR.indeterminate,
    },
    { key: 'todo', label: 'To do', value: v(d.todo), color: STATUS_CATEGORY_COLOR.new },
    {
      key: 'remaining',
      label: 'Remaining',
      value: v(d.remaining),
      color: REMAINING_COLOR,
      marker: 'line',
    },
  ];
}

/** Time-chart history rows (values in hours): Estimate / Logged / Remaining. */
export function timeRows(format: (hours: number) => string): (d: ChartDatum) => ChartRowSpec[] {
  const v = (n: unknown) => format(Number(n ?? 0));
  return (d) => [
    { key: 'estimate', label: 'Estimate', value: v(d.estimate), color: STATUS_CATEGORY_COLOR.new },
    {
      key: 'logged',
      label: 'Logged',
      value: v(d.logged),
      color: STATUS_CATEGORY_COLOR.done,
      marker: 'line',
    },
    {
      key: 'remaining',
      label: 'Remaining',
      value: v(d.remaining),
      color: STATUS_CATEGORY_COLOR.indeterminate,
      marker: 'line',
    },
  ];
}

export function EpicChartTooltip({
  active,
  payload,
  metric,
  rows,
  formatValue,
  clippedAfter,
}: EpicChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0].payload as ChartDatum | undefined;
  if (!datum || typeof datum.date !== 'string') return null;

  const fmt = formatValue ?? ((n: number) => formatMetric(n, metric));
  // Future (projection-only) points carry no history series.
  const isFuture = datum.remaining === null || datum.remaining === undefined;
  const title = `${formatDateKey(datum.date)}, ${datum.date.slice(0, 4)}`;

  const specs: ChartRowSpec[] = isFuture ? [] : rows(datum);
  const hasForecast = typeof datum.forecast === 'number';
  const band = datum.band;

  return (
    <div className={TOOLTIP_SURFACE}>
      <TooltipBody
        title={title}
        note={
          isFuture && clippedAfter ? `pessimistic after ${formatDateKey(clippedAfter)}` : undefined
        }
      >
        {specs.map((r) => (
          <TooltipRow
            key={r.key}
            color={r.color}
            dashed={r.dashed}
            marker={r.marker}
            label={r.label}
            value={r.value}
          />
        ))}
        {hasForecast ? (
          <TooltipRow
            dashed
            color={FORECAST_COLOR}
            label="Forecast"
            value={fmt(datum.forecast as number)}
          />
        ) : null}
        {isFuture && band ? (
          <TooltipRow
            dashed
            color={FORECAST_COLOR}
            label="Range"
            value={`${fmt(band[0])}–${fmt(band[1])}`}
          />
        ) : null}
        {hasForecast && typeof datum.wd === 'number' && datum.wd > 0 ? (
          <TooltipRow
            label="From today"
            value={`${datum.wd} working day${datum.wd === 1 ? '' : 's'}`}
            sub={datum.workingDay === false ? 'non-working day' : undefined}
          />
        ) : null}
      </TooltipBody>
    </div>
  );
}
