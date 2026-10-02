'use no memo';

/**
 * EpicTimeBurnup — Time-mode chart built from worklogs (quick 261001-hsz, extended by
 * 261001-ilq, 261001-qvu). Mounted only when the Time metric is selected. Series: Estimate (collapse model area), Logged (cumulative worklog time)
 * and Remaining (estimate - logged), plus the shared averaged forecast (the same one
 * the Finish tile shows, projected from this chart's own remaining) with its
 * optimistic-to-pessimistic band (one point per calendar day, flat on non-working days,
 * dots only on hover). The worklog query and the averaged finish are owned by the section.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type AveragedForecast,
  dateKeyMs,
  deriveTimeBurnup,
  padToDomain,
  projectFinish,
  timeTicks,
  type WorkCalendar,
  withProjection,
} from '@/lib/epic-progress';
import type { EpicWorklogDay, JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import { ForecastLegend, LegendItem, SourceFlag, tickLabel } from './EpicCfdChart';
import { EpicChartTooltip, timeRows } from './EpicChartTooltip';
import {
  type ChartZoom,
  chartHeight,
  PLOT_HEIGHT,
  useChartView,
  useElementWidth,
  useLiveRange,
  visibleRange,
  Y_AXIS_WIDTH,
  ZoomPresets,
  zoomUsable,
} from './EpicChartZoom';
import { EpicRangeNavigator } from './EpicRangeNavigator';
import { SERIES } from './epic-markers';

const HOUR = 3600;
const BAR_CURSOR = { stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' };

interface EpicTimeBurnupProps {
  /** Worklog query owned by the section (lifted so the hero forecast shares it). */
  query: Pick<
    UseQueryResult<Map<string, EpicWorklogDay[]>>,
    'data' | 'isError' | 'isFetching' | 'refetch'
  >;
  stories: JiraIssue[];
  epicCreated: string | undefined;
  today: string;
  /** The one shared averaged forecast (same result as the Finish tile). */
  finish: AveragedForecast;
  calendar: WorkCalendar;
  /** Small neutral info flag text (see EpicCfdChart). */
  sourceFlag?: string | null;
  /** Shared zoom state (null without a valid axis start). */
  zoom: ChartZoom | null;
}

const hoursLabel = (h: number) => formatDuration(Math.round(h * HOUR));

export function EpicTimeBurnup({
  query,
  stories,
  epicCreated,
  today,
  finish,
  calendar,
  sourceFlag,
  zoom,
}: EpicTimeBurnupProps) {
  const { data, isFetching, isError, refetch } = query;
  const loadingHeight = chartHeight(zoom);
  const domainFrom = zoom?.domain.from;
  const domainTo = zoom?.domain.to;

  // Hooks run before the early returns below. The derivation is memoised so a drag (which only
  // changes the live range) never recomputes it.
  const derived = useMemo(() => {
    if (!data) return null;
    const points = deriveTimeBurnup(stories, data, epicCreated, today);
    const base = points.map((p) => ({
      ...p,
      t: dateKeyMs(p.date),
      estimate: p.estimate / HOUR,
      logged: p.logged / HOUR,
      remaining: Math.max(p.estimate - p.logged, 0) / HOUR,
    }));
    // One forecast: the shared averaged finish, projected from this chart's own remaining (hours).
    const todayRemainingHours = base.length > 0 ? base[base.length - 1].remaining : 0;
    const projection = projectFinish(
      finish,
      todayRemainingHours,
      today,
      domainFrom ?? (base.length > 0 ? base[0].date : null),
      calendar,
    );
    const projected = withProjection(base, projection);
    const chartData = domainTo ? padToDomain(projected, domainTo) : projected;
    return { points, projection, chartData };
  }, [data, stories, epicCreated, today, finish, calendar, domainFrom, domainTo]);
  const chartData = derived?.chartData;
  const { range, onLive, onCommit } = useLiveRange(
    zoom,
    chartData ? visibleRange(null, chartData) : null,
  );
  const plotRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(plotRef);
  const { view, overview } = useChartView(chartData, zoom, range, finish, today);

  if (isError) {
    return (
      <div
        data-testid="epic-time-burnup-error"
        style={{ minHeight: loadingHeight }}
        className="flex items-center gap-3 text-sm text-muted-foreground"
      >
        <span>Couldn't load worklogs</span>
        <button
          type="button"
          onClick={() => void refetch()}
          className="cursor-pointer rounded-md px-2 py-0.5 text-xs ring-1 ring-foreground/10 hover:bg-accent"
        >
          Retry
        </button>
      </div>
    );
  }

  // A disabled query stays pending forever: branch on isFetching, not isPending (WR-02).
  if (!data && !isFetching) {
    return (
      <p
        style={{ minHeight: loadingHeight }}
        className="pr-0.5 text-sm text-muted-foreground italic"
      >
        No worklog data
      </p>
    );
  }

  if (!data || !derived) {
    return (
      <Skeleton
        data-testid="epic-time-burnup-loading"
        className="w-full"
        style={{ height: loadingHeight }}
      />
    );
  }

  const { points, projection } = derived;
  const hasProjection = projection.points.length > 0;
  const ticks = range ? timeTicks(range.from, range.to, width) : [];

  return (
    <div>
      <div
        data-testid="epic-time-burnup"
        data-x-from={range?.from}
        data-x-to={range?.to}
        data-domain-to={zoom?.domain.to ?? range?.to}
        data-zoomable={String(zoomUsable(zoom))}
        style={{ height: chartHeight(zoom) }}
      >
        {points.length === 0 || !range ? (
          <p className="text-sm text-muted-foreground italic">No timeline data</p>
        ) : (
          <>
            <div ref={plotRef} style={{ height: PLOT_HEIGHT }}>
              <ChartContainer
                config={{}}
                className="aspect-auto h-full w-full"
                aria-label="Epic time burnup chart"
              >
                <ComposedChart
                  data={view}
                  responsive
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
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
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={Y_AXIS_WIDTH}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <ChartTooltip
                    cursor={BAR_CURSOR}
                    content={(p) => (
                      <EpicChartTooltip
                        active={p.active}
                        payload={p.payload}
                        metric="time"
                        formatValue={hoursLabel}
                        clippedAfter={projection.clippedAfter}
                        rows={timeRows(hoursLabel)}
                        finish={finish}
                        today={today}
                      />
                    )}
                  />
                  <Area
                    dataKey="estimate"
                    type="stepAfter"
                    stroke={SERIES.estimate.stroke}
                    strokeWidth={SERIES.estimate.strokeWidth}
                    fill={SERIES.estimate.fill}
                    fillOpacity={SERIES.estimate.fillOpacity}
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
                    dataKey="logged"
                    type="stepAfter"
                    stroke={SERIES.logged.stroke}
                    strokeWidth={SERIES.logged.strokeWidth}
                    dot={false}
                    isAnimationActive={false}
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
      <div className="mt-1 flex items-start justify-between gap-4">
        <div
          data-testid="epic-time-legend"
          className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
        >
          <LegendItem
            marker={SERIES.estimate.marker}
            color={SERIES.estimate.color}
            label="Estimate"
          />
          <LegendItem marker={SERIES.logged.marker} color={SERIES.logged.color} label="Logged" />
          <LegendItem
            marker={SERIES.remaining.marker}
            color={SERIES.remaining.color}
            label="Remaining"
          />
          <ForecastLegend finish={finish} hasProjection={hasProjection} />
          <SourceFlag text={sourceFlag} />
        </div>
        {zoom ? <ZoomPresets zoom={zoom} /> : null}
      </div>
    </div>
  );
}
