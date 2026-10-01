'use no memo';

/**
 * EpicTimeBurnup — Time-mode chart built from worklogs (quick 261001-hsz, extended by
 * 261001-ilq, 261001-qvu). Mounted only when the Time metric is selected. Series: Estimate (collapse model area), Logged (cumulative worklog time)
 * and Remaining (estimate - logged), plus the daily-logged-rate forecast with its
 * optimistic-to-pessimistic band (one point per calendar day, flat on non-working days,
 * dots only on hover). The worklog query and the time forecast are owned by the section.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  deriveProjection,
  deriveTimeBurnup,
  type EpicForecast,
  ESTIMATE_FORMULA_NOTE,
  type WorkCalendar,
  withProjection,
} from '@/lib/epic-progress';
import { STATUS_CATEGORY_COLOR } from '@/lib/statusStyles';
import type { EpicWorklogDay, JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import { LegendItem, tickLabel } from './EpicCfdChart';
import { EpicChartTooltip, FORECAST_COLOR, timeRows } from './EpicChartTooltip';

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
  /** Time forecast from the section (shared with the averaged Finish); null while unavailable. */
  forecast: EpicForecast | null;
  calendar: WorkCalendar;
}

const hoursLabel = (h: number) => formatDuration(Math.round(h * HOUR));

export function EpicTimeBurnup({
  query,
  stories,
  epicCreated,
  today,
  forecast,
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

  // The projection maths is unit-agnostic (it only scales `remaining` by day counts), so the
  // forecast's remaining (seconds) is converted to hours to match the chart's hour axis.
  const projection = forecast
    ? deriveProjection(
        { ...forecast, remaining: forecast.remaining / HOUR },
        today,
        base.length > 0 ? base[0].date : null,
        calendar,
      )
    : { points: [], clippedAfter: null };
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
                  />
                )}
              />
              <Area
                dataKey="estimate"
                type="stepAfter"
                stroke={STATUS_CATEGORY_COLOR.new}
                fill={STATUS_CATEGORY_COLOR.new}
                fillOpacity={0.15}
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
                dataKey="logged"
                type="stepAfter"
                stroke={STATUS_CATEGORY_COLOR.done}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="remaining"
                type="stepAfter"
                stroke={STATUS_CATEGORY_COLOR.indeterminate}
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
                activeDot={{
                  r: 3,
                  fill: FORECAST_COLOR,
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
        <LegendItem color={STATUS_CATEGORY_COLOR.new} label="Estimate" />
        <LegendItem color={STATUS_CATEGORY_COLOR.done} label="Logged" />
        <LegendItem color={STATUS_CATEGORY_COLOR.indeterminate} label="Remaining" />
        {hasProjection ? <LegendItem dashed color={FORECAST_COLOR} label="Forecast" /> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {`${ESTIMATE_FORMULA_NOTE} Done stories collapse to their logged time.`}
      </p>
    </div>
  );
}
