'use no memo';

/**
 * EpicTimeBurnup — Time-mode burnup built from worklogs (quick 261001-hsz).
 * Mounted only when the Time metric is selected, so Count/SP never fetch worklogs.
 * Two series: Estimate (collapse model) and Logged (cumulative daily worklog time).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { deriveTimeBurnup, ESTIMATE_FORMULA_NOTE, formatDateKey } from '@/lib/epic-progress';
import type { EpicWorklogDay, JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';

const HOUR = 3600;
const CHART_HEIGHT = 220;

const timeChartConfig = {
  estimate: { label: 'Estimate', color: 'var(--color-gray-400)' },
  logged: { label: 'Logged (from worklogs)', color: 'var(--color-green-500)' },
} satisfies ChartConfig;

interface EpicTimeBurnupProps {
  /** Worklog query owned by the section (lifted so the hero forecast shares it). */
  query: Pick<
    UseQueryResult<Map<string, EpicWorklogDay[]>>,
    'data' | 'isError' | 'isFetching' | 'refetch'
  >;
  stories: JiraIssue[];
  epicCreated: string | undefined;
  today: string;
}

function Swatch({ name }: { name: string }) {
  return (
    <span
      className="size-2 shrink-0 rounded-[2px]"
      style={{ background: `var(--color-${name})` }}
    />
  );
}

export function EpicTimeBurnup({ query, stories, epicCreated, today }: EpicTimeBurnupProps) {
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
  const chartData = points.map((p) => ({
    ...p,
    estimate: p.estimate / HOUR,
    logged: p.logged / HOUR,
  }));

  return (
    <div>
      <div data-testid="epic-time-burnup" style={{ height: CHART_HEIGHT }}>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No timeline data</p>
        ) : (
          <ChartContainer
            config={timeChartConfig}
            className="aspect-auto h-full w-full"
            aria-label="Epic time burnup chart"
          >
            <ComposedChart
              data={chartData}
              responsive
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatDateKey(String(v))}
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
                cursor={{ stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) => `${formatDateKey(String(v))}, ${String(v).slice(0, 4)}`}
                    formatter={(value, name, _item, _index, payload) => {
                      const key = String(name) as keyof typeof timeChartConfig;
                      const point = payload as { estimate?: number; logged?: number } | undefined;
                      return (
                        <>
                          <div className="flex w-full items-center gap-2">
                            <Swatch name={key} />
                            <span className="text-muted-foreground">
                              {timeChartConfig[key]?.label ?? key}
                            </span>
                            <span className="ml-auto font-mono font-medium tabular-nums">
                              {formatDuration(Number(value) * HOUR)}
                            </span>
                          </div>
                          {key === 'logged' && point ? (
                            <div className="flex w-full items-center gap-2">
                              <span className="size-2 shrink-0" />
                              <span className="text-muted-foreground">Remaining</span>
                              <span className="ml-auto font-mono font-medium tabular-nums">
                                {formatDuration(
                                  Math.max((point.estimate ?? 0) - (point.logged ?? 0), 0) * HOUR,
                                )}
                              </span>
                            </div>
                          ) : null}
                        </>
                      );
                    }}
                  />
                }
              />
              <Area
                dataKey="estimate"
                type="stepAfter"
                stroke="var(--color-estimate)"
                fill="var(--color-estimate)"
                fillOpacity={0.15}
                isAnimationActive={false}
              />
              <Line
                dataKey="logged"
                type="stepAfter"
                stroke="var(--color-logged)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {`${ESTIMATE_FORMULA_NOTE} Done stories collapse to their logged time.`}
      </p>
    </div>
  );
}
