'use no memo';

/**
 * EpicCfdChart — cumulative flow diagram for the epic progress section (quick 261001-ilq).
 * Stacked Done / In progress / To do areas (status-category colours), a solid neutral Remaining
 * line, and — when the shared averaged forecast is ok — a dashed neutral forecast line with an
 * optimistic-to-pessimistic range band on a numeric time axis. The projection has one point per calendar
 * day (flat on non-working days); its dots are hidden until hover (activeDot only).
 *
 * Recharts conventions shared with the other charts: 'use no memo' + explicit-height
 * wrapper + isAnimationActive={false}. No recharts <Legend>: it renders text in jsdom and
 * would collide with the EpicDetailSheet text assertions, so the legend is custom.
 */
import { Info } from 'lucide-react';
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { MarkerGlyph, type MarkerTone, type TooltipMarker } from '@/components/ui/tooltip-body';
import {
  type AveragedForecast,
  type CfdPoint,
  FINISH_STATE_TEXT,
  formatDateKey,
  type Metric,
} from '@/lib/epic-progress';
import { STATUS_CATEGORY_COLOR } from '@/lib/statusStyles';
import { cfdRows, EpicChartTooltip } from './EpicChartTooltip';
import { SERIES } from './epic-markers';

const CHART_HEIGHT = 220;
const BAR_CURSOR = { stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' };

export type CfdChartPoint = CfdPoint & {
  forecast: number | null;
  band: [number, number] | null;
  /** Working days from today (projection rows only). */
  wd: number | null;
  workingDay: boolean | null;
};

interface EpicCfdChartProps {
  data: CfdChartPoint[];
  metric: Metric;
  /** Whether the series comes from real status history (vs the current-state approximation). */
  history: 'real' | 'approx';
  /** Small neutral info flag text when the data source is approximate or loading. */
  sourceFlag?: string | null;
  hasProjection: boolean;
  clippedAfter: string | null;
  /** The one shared forecast (same result as the Finish tile). */
  finish: AveragedForecast;
  today: string;
}

export function tickLabel(v: unknown): string {
  return formatDateKey(new Date(Number(v)).toISOString().slice(0, 10));
}

export function LegendItem({
  label,
  marker,
  color,
  tone,
}: {
  label: string;
  marker: TooltipMarker;
  /** Status colour (marker 'status' only). */
  color?: string;
  tone?: MarkerTone;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <MarkerGlyph marker={marker} color={color} tone={tone} />
      <span>{label}</span>
    </span>
  );
}

/** Legend entry for the shared forecast: the dashed item, or the state text when none is drawn. */
export function ForecastLegend({
  finish,
  hasProjection,
}: {
  finish: AveragedForecast;
  hasProjection: boolean;
}) {
  if (hasProjection) {
    return (
      <LegendItem marker={SERIES.forecast.marker} tone={SERIES.forecast.tone} label="Forecast" />
    );
  }
  if (finish.state === 'ok') {
    // Shared forecast exists but this view has nothing left to project (e.g. all estimates logged).
    return finish.likely ? (
      <span data-testid="epic-forecast-state">{`Forecast: ${formatDateKey(finish.likely)} · nothing left in this view`}</span>
    ) : null;
  }
  return (
    <span data-testid="epic-forecast-state">{`Forecast: ${FINISH_STATE_TEXT[finish.state]}`}</span>
  );
}

/** Neutral info icon in the legend row when a data source is approximate or loading. */
export function SourceFlag({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <span data-testid="epic-source-flag" role="img" aria-label={text} title={text}>
      <Info aria-hidden="true" className="size-3 text-muted-foreground" />
    </span>
  );
}

export function EpicCfdChart({
  data,
  metric,
  history,
  sourceFlag,
  hasProjection,
  clippedAfter,
  finish,
  today,
}: EpicCfdChartProps) {
  return (
    <div>
      <div data-testid="epic-burnup" data-history={history} style={{ height: CHART_HEIGHT }}>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No timeline data</p>
        ) : (
          <ChartContainer
            config={{}}
            className="aspect-auto h-full w-full"
            aria-label="Epic cumulative flow chart"
          >
            <ComposedChart data={data} responsive margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                type="number"
                dataKey="t"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={tickLabel}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis allowDecimals={metric === 'sp'} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip
                cursor={BAR_CURSOR}
                content={(p) => (
                  <EpicChartTooltip
                    active={p.active}
                    payload={p.payload}
                    metric={metric}
                    clippedAfter={clippedAfter}
                    rows={cfdRows(metric)}
                    finish={finish}
                    today={today}
                  />
                )}
              />
              <Area
                dataKey="done"
                stackId="cfd"
                type="stepAfter"
                stroke={STATUS_CATEGORY_COLOR.done}
                fill={STATUS_CATEGORY_COLOR.done}
                fillOpacity={0.35}
                isAnimationActive={false}
              />
              <Area
                dataKey="inProgress"
                stackId="cfd"
                type="stepAfter"
                stroke={STATUS_CATEGORY_COLOR.indeterminate}
                fill={STATUS_CATEGORY_COLOR.indeterminate}
                fillOpacity={0.35}
                isAnimationActive={false}
              />
              <Area
                dataKey="todo"
                stackId="cfd"
                type="stepAfter"
                stroke={STATUS_CATEGORY_COLOR.new}
                fill={STATUS_CATEGORY_COLOR.new}
                fillOpacity={0.35}
                isAnimationActive={false}
              />
              {/* Range band: a NON-stacked Area whose value is [low, high]. */}
              <Area
                dataKey="band"
                type="linear"
                stroke="none"
                fill={SERIES.band.fill}
                fillOpacity={SERIES.band.fillOpacity}
                isAnimationActive={false}
                activeDot={false}
              />
              <Line
                dataKey="remaining"
                type="stepAfter"
                stroke={SERIES.remaining.stroke}
                strokeWidth={SERIES.remaining.strokeWidth}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="forecast"
                type="linear"
                stroke={SERIES.forecast.stroke}
                strokeWidth={SERIES.forecast.strokeWidth}
                strokeDasharray={SERIES.forecast.strokeDasharray}
                connectNulls
                dot={false}
                activeDot={{
                  r: 3,
                  fill: SERIES.forecast.stroke,
                  stroke: 'var(--color-background)',
                  strokeWidth: 1,
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </div>
      <div
        data-testid="epic-cfd-legend"
        className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
      >
        <LegendItem marker="status" color={STATUS_CATEGORY_COLOR.done} label="Completed" />
        <LegendItem
          marker="status"
          color={STATUS_CATEGORY_COLOR.indeterminate}
          label="In progress"
        />
        <LegendItem marker="status" color={STATUS_CATEGORY_COLOR.new} label="To do" />
        <LegendItem
          marker={SERIES.remaining.marker}
          tone={SERIES.remaining.tone}
          label="Remaining"
        />
        <ForecastLegend finish={finish} hasProjection={hasProjection} />
        <SourceFlag text={sourceFlag} />
      </div>
    </div>
  );
}
