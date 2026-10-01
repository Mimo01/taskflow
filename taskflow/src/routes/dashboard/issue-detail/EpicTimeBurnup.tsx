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
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type AveragedForecast,
  deriveTimeBurnup,
  ESTIMATE_FORMULA_NOTE,
  projectFinish,
  type WorkCalendar,
  withProjection,
} from '@/lib/epic-progress';
import type { EpicWorklogDay, JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import { ForecastLegend, LegendItem, tickLabel } from './EpicCfdChart';
import { EpicChartTooltip, timeRows } from './EpicChartTooltip';
import { SERIES } from './epic-markers';

const HOUR = 3600;
const CHART_HEIGHT = 220;
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
}

const hoursLabel = (h: number) => formatDuration(Math.round(h * HOUR));

export function EpicTimeBurnup({
  query,
  stories,
  epicCreated,
  today,
  finish,
  calendar,
}: EpicTimeBurnupProps) {
  const { data, isFetching, isError, refetch } = query;

  if (isError) {
    return (
      <div
        data-testid="epic-time-burnup-error"
        style={{ minHeight: CHART_HEIGHT }}
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
        style={{ minHeight: CHART_HEIGHT }}
        className="pr-0.5 text-sm text-muted-foreground italic"
      >
        No worklog data
      </p>
    );
  }

  if (!data) {
    return (
      <Skeleton
        data-testid="epic-time-burnup-loading"
        className="w-full"
        style={{ height: CHART_HEIGHT }}
      />
    );
  }

  const points = deriveTimeBurnup(stories, data, epicCreated, today);
  const base = points.map((p) => ({
    ...p,
    t: Date.UTC(
      Number(p.date.slice(0, 4)),
      Number(p.date.slice(5, 7)) - 1,
      Number(p.date.slice(8, 10)),
    ),
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
    base.length > 0 ? base[0].date : null,
    calendar,
  );
  const chartData = withProjection(base, projection);
  const hasProjection = projection.points.length > 0;

  return (
    <div>
      <div data-testid="epic-time-burnup" style={{ height: CHART_HEIGHT }}>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No timeline data</p>
        ) : (
          <ChartContainer
            config={{}}
            className="aspect-auto h-full w-full"
            aria-label="Epic time burnup chart"
          >
            <ComposedChart
              data={chartData}
              responsive
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
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
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={40}
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
        )}
      </div>
      <div
        data-testid="epic-time-legend"
        className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
      >
        <LegendItem marker={SERIES.estimate.marker} tone={SERIES.estimate.tone} label="Estimate" />
        <LegendItem marker={SERIES.logged.marker} tone={SERIES.logged.tone} label="Logged" />
        <LegendItem
          marker={SERIES.remaining.marker}
          tone={SERIES.remaining.tone}
          label="Remaining"
        />
        <ForecastLegend finish={finish} hasProjection={hasProjection} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {`${ESTIMATE_FORMULA_NOTE} Done stories collapse to their logged time.`}
      </p>
    </div>
  );
}
