'use no memo';

/**
 * EpicCfdChart — cumulative flow diagram for the epic progress section (quick 261001-ilq).
 * Stacked Done / In progress / To do areas (status-category colours), a solid Remaining
 * line, and — when the forecast is ok — a dashed forecast line with an optimistic-to-
 * pessimistic range band on a numeric time axis (sparse future points are placed by
 * date, not by index).
 *
 * Recharts conventions shared with the other charts: 'use no memo' + explicit-height
 * wrapper + isAnimationActive={false}. No recharts <Legend>: it renders text in jsdom and
 * would collide with the EpicDetailSheet text assertions, so the legend is custom.
 */
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { type CfdPoint, formatDateKey, type Metric } from '@/lib/epic-progress';
import { STATUS_CATEGORY_COLOR } from '@/lib/statusStyles';
import { cfdRows, EpicChartTooltip, FORECAST_COLOR, REMAINING_COLOR } from './EpicChartTooltip';

const CHART_HEIGHT = 220;
const BAR_CURSOR = { stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' };

export type CfdChartPoint = CfdPoint & { forecast: number | null; band: [number, number] | null };

interface EpicCfdChartProps {
  data: CfdChartPoint[];
  metric: Metric;
  /** Whether the series comes from real status history (vs the current-state approximation). */
  history: 'real' | 'approx';
  /** Caption describing where the data comes from. */
  note: string;
  hasProjection: boolean;
  clippedAfter: string | null;
}

export function tickLabel(v: unknown): string {
  return formatDateKey(new Date(Number(v)).toISOString().slice(0, 10));
}

export function LegendItem({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={dashed ? 'size-2 rounded-[2px] border border-dashed' : 'size-2 rounded-[2px]'}
        style={dashed ? { borderColor: color } : { background: color }}
      />
      <span>{label}</span>
    </span>
  );
}

export function EpicCfdChart({
  data,
  metric,
  history,
  note,
  hasProjection,
  clippedAfter,
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
                fill={FORECAST_COLOR}
                fillOpacity={0.12}
                isAnimationActive={false}
                activeDot={false}
              />
              <Line
                dataKey="remaining"
                type="stepAfter"
                stroke={REMAINING_COLOR}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="forecast"
                type="linear"
                stroke={FORECAST_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                connectNulls
                dot={false}
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
        <LegendItem color={STATUS_CATEGORY_COLOR.done} label="Completed" />
        <LegendItem color={STATUS_CATEGORY_COLOR.indeterminate} label="In progress" />
        <LegendItem color={STATUS_CATEGORY_COLOR.new} label="To do" />
        <LegendItem color={REMAINING_COLOR} label="Remaining" />
        {hasProjection ? <LegendItem dashed color={FORECAST_COLOR} label="Forecast" /> : null}
      </div>
      <p data-testid="epic-cfd-note" className="mt-1 text-xs text-muted-foreground">
        {note}
      </p>
    </div>
  );
}
