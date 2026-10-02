'use no memo';

/**
 * EpicCfdChart — cumulative flow diagram for the epic progress section (quick 261001-ilq).
 * Stacked Done / In progress / To do areas (status-category colours), a solid neutral Remaining
 * line, and — when the shared averaged forecast is ok — a dashed neutral forecast line with an
 * optimistic-to-pessimistic range band on a numeric time axis. The projection has one point per calendar
 * day (flat on non-working days); its dots are hidden until hover (activeDot only).
 *
 * Recharts conventions shared with the other charts: 'use no memo' + explicit-height
 * wrapper + isAnimationActive={false}. No legend (261002-enj): series meaning lives in the
 * hover tooltip; the source flag and zoom presets sit in the toolbar above the chart.
 */
import { useRef } from 'react';
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import {
  type AveragedForecast,
  type CfdPoint,
  dateKeyMs,
  formatDateKey,
  type Metric,
  timeTicks,
} from '@/lib/epic-progress';
import { STATUS_CATEGORY_COLOR } from '@/lib/statusStyles';
import { cfdRows, EpicChartTooltip } from './EpicChartTooltip';
import {
  type ChartZoom,
  chartHeight,
  PLOT_HEIGHT,
  PLOT_MARGIN,
  useChartView,
  useElementWidth,
  useLiveRange,
  visibleRange,
  Y_AXIS_WIDTH,
  zoomUsable,
} from './EpicChartZoom';
import { EpicRangeNavigator } from './EpicRangeNavigator';
import { SERIES } from './epic-markers';

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
  clippedAfter: string | null;
  /** The one shared forecast (same result as the Finish tile). */
  finish: AveragedForecast;
  today: string;
  /** Shared zoom state (null without a valid axis start). */
  zoom: ChartZoom | null;
}

export function tickLabel(v: unknown): string {
  return formatDateKey(new Date(Number(v)).toISOString().slice(0, 10));
}

export function EpicCfdChart({
  data,
  metric,
  history,
  clippedAfter,
  finish,
  today,
  zoom,
}: EpicCfdChartProps) {
  const { range, onLive, onCommit } = useLiveRange(zoom, visibleRange(null, data));
  const plotRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(plotRef);
  const { view, overview } = useChartView(data, zoom, range, finish, today);
  const ticks = range ? timeTicks(range.from, range.to, width) : [];
  return (
    <div>
      <div
        data-testid="epic-burnup"
        data-history={history}
        data-x-from={range?.from}
        data-x-to={range?.to}
        data-domain-to={zoom?.domain.to ?? range?.to}
        data-zoomable={String(zoomUsable(zoom))}
        style={{ height: chartHeight(zoom) }}
      >
        {data.length === 0 || !range ? (
          <p className="text-sm text-muted-foreground italic">No timeline data</p>
        ) : (
          <>
            <div ref={plotRef} style={{ height: PLOT_HEIGHT }}>
              <ChartContainer
                config={{}}
                className="aspect-auto h-full w-full"
                aria-label="Epic cumulative flow chart"
              >
                <ComposedChart data={view} responsive margin={PLOT_MARGIN}>
                  <XAxis
                    type="number"
                    dataKey="t"
                    scale="time"
                    domain={[dateKeyMs(range.from), dateKeyMs(range.to)]}
                    allowDataOverflow
                    ticks={ticks.map((x) => x.t)}
                    tickFormatter={(v) =>
                      ticks.find((x) => x.t === Number(v))?.label ?? tickLabel(v)
                    }
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={metric === 'sp'}
                    tickLine={false}
                    axisLine={false}
                    width={Y_AXIS_WIDTH}
                  />
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
            </div>
            {zoomUsable(zoom) ? (
              <EpicRangeNavigator
                domain={zoom.domain}
                range={range}
                today={today}
                overview={overview}
                onLive={onLive}
                onCommit={onCommit}
                onReset={() => zoom.onPreset('all')}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
