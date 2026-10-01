/**
 * EpicChartTooltip — custom recharts tooltip content for the epic CFD and time charts
 * (quick 261001-ilq, 261001-rtw). Reads the hovered DATUM (payload[0].payload) rather than the
 * per-series items, so row order is fixed and range-array values never reach a
 * formatter. Renders on the shared TOOLTIP_SURFACE like every other tooltip.
 * Colour marks statuses only; every other row uses a neutral marker or icon.
 */
import {
  type MarkerTone,
  TOOLTIP_SURFACE,
  TooltipBody,
  type TooltipMarker,
  TooltipRow,
} from '@/components/ui/tooltip-body';
import {
  type AveragedForecast,
  finishDateRows,
  formatDateKey,
  formatFinishDate,
  formatMetric,
  type Metric,
} from '@/lib/epic-progress';
import { STATUS_CATEGORY_COLOR } from '@/lib/statusStyles';
import { MARKER_ICON, SERIES } from './epic-markers';

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
  marker: TooltipMarker;
  /** Status colour (marker 'status' only). */
  color?: string;
  tone?: MarkerTone;
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
  /** The shared averaged forecast; key dates get the same rows as the Finish tooltip. */
  finish?: AveragedForecast | null;
  today?: string;
}

/** CFD history rows, in fixed order: Completed / In progress / To do / Remaining. */
export function cfdRows(metric: Metric): (d: ChartDatum) => ChartRowSpec[] {
  const v = (n: unknown) => formatMetric(Number(n ?? 0), metric);
  return (d) => [
    {
      key: 'done',
      label: 'Completed',
      value: v(d.done),
      marker: 'status',
      color: STATUS_CATEGORY_COLOR.done,
    },
    {
      key: 'inProgress',
      label: 'In progress',
      value: v(d.inProgress),
      marker: 'status',
      color: STATUS_CATEGORY_COLOR.indeterminate,
    },
    {
      key: 'todo',
      label: 'To do',
      value: v(d.todo),
      marker: 'status',
      color: STATUS_CATEGORY_COLOR.new,
    },
    {
      key: 'remaining',
      label: 'Remaining',
      value: v(d.remaining),
      marker: SERIES.remaining.marker,
      tone: SERIES.remaining.tone,
    },
  ];
}

/** Time-chart history rows (values in hours): Estimate / Logged / Remaining. */
export function timeRows(format: (hours: number) => string): (d: ChartDatum) => ChartRowSpec[] {
  const v = (n: unknown) => format(Number(n ?? 0));
  return (d) => [
    {
      key: 'estimate',
      label: 'Estimate',
      value: v(d.estimate),
      marker: SERIES.estimate.marker,
      tone: SERIES.estimate.tone,
    },
    {
      key: 'logged',
      label: 'Logged',
      value: v(d.logged),
      marker: SERIES.logged.marker,
      tone: SERIES.logged.tone,
    },
    {
      key: 'remaining',
      label: 'Remaining',
      value: v(d.remaining),
      marker: SERIES.remaining.marker,
      tone: SERIES.remaining.tone,
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
  finish,
  today,
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
  const keyDates =
    isFuture && finish && today ? finishDateRows(finish).filter((r) => r.date === datum.date) : [];

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
            tone={r.tone}
            marker={r.marker}
            label={r.label}
            value={r.value}
          />
        ))}
        {hasForecast ? (
          <TooltipRow
            marker={SERIES.forecast.marker}
            tone={SERIES.forecast.tone}
            label="Forecast"
            value={fmt(datum.forecast as number)}
          />
        ) : null}
        {isFuture && band ? (
          <TooltipRow
            marker={SERIES.band.marker}
            tone={SERIES.band.tone}
            label="Range"
            value={`${fmt(band[0])}–${fmt(band[1])}`}
          />
        ) : null}
        {hasForecast && typeof datum.wd === 'number' && datum.wd > 0 ? (
          <TooltipRow
            icon={<MARKER_ICON.fromToday className="size-3" />}
            label="From today"
            value={`${datum.wd} working day${datum.wd === 1 ? '' : 's'}`}
            sub={datum.workingDay === false ? 'non-working day' : undefined}
          />
        ) : null}
        {keyDates.map((r) => (
          <TooltipRow
            key={r.key}
            icon={<MARKER_ICON.date className="size-3" />}
            label={r.label}
            value={formatFinishDate(r.date, today as string)}
            sub={`${r.n} working days`}
          />
        ))}
      </TooltipBody>
    </div>
  );
}
