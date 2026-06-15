'use no memo';

/**
 * BurndownChart — Phase 85 INSIGHT-02
 *
 * Renders an active-sprint hours-remaining AreaChart from the GreenHopper
 * scopechangeburndownchart endpoint. Y-axis is HOURS (not story points).
 *
 * // Probe C PASSED 2026-06-15: scopechangeburndownchart returns .changes +
 * // .workRateData. statisticField=timeestimate — Y-axis is hours remaining,
 * // NOT story points. Build is unconditional; error state handles runtime absence.
 *
 * Props-only component — no useAuthStore, no readSecret (D-16 pattern).
 * Auth values are loaded once in index.tsx and passed down as props.
 *
 * Token NEVER enters the queryKey (T-84-02 / T-85-04-04).
 * boardId + activeSprintId arrive as props (T-85-04-02 — never hardcoded).
 */

import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartWrapper } from '@/components/chart-wrapper';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchBurndown } from '@/services/jira';
import { formatHoursMinutes, parseBurndownChanges } from './dashboardMetrics';

// Props only — no readSecret, no useAuthStore inside the component.
// Auth values loaded once in index.tsx and passed down as props (D-16 pattern).
interface BurndownChartProps {
  jiraBaseUrl: string;
  jiraToken: string;
  boardId: number | null;
  activeSprintId: number | null;
}

const chartConfig = {
  remaining: { label: 'Remaining', color: 'var(--chart-3)' },
  ideal: { label: 'Ideal', color: 'var(--muted-foreground)' },
} satisfies ChartConfig;

export default function BurndownChart({
  jiraBaseUrl,
  jiraToken,
  boardId,
  activeSprintId,
}: BurndownChartProps) {
  // ONE permitted new fetch. Token lives in queryFn closure, NOT in queryKey (T-84-02 / T-85-04-04).
  const {
    data: burndownRaw,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['jira-burndown', boardId, activeSprintId],
    queryFn: () =>
      // fetchBurndown already encapsulates: rapid-charts path, apiPath='' override (D-08),
      // throw-on-not-ok, AND the data.ts error envelope (ApiError → setJiraConnected(false)
      // for 401s, network-error wrap per Phase 71 D-04). Do NOT call greenhopperFetch directly.
      fetchBurndown(jiraBaseUrl, jiraToken, boardId!, activeSprintId!),
    staleTime: 30_000, // D-09 — active-sprint burndown changes mid-sprint; NOT Infinity
    enabled: !!jiraToken && boardId != null && activeSprintId != null,
  });

  const showSkeleton = useDelayedLoading(isLoading);

  // V5 defensive parsing: default .changes to {} before parse (T-85-04-01).
  // parseBurndownChanges (from 85-01) applies ?? 0 and Math.max(0,…) per-entry.
  // Cast via unknown: BurndownChangeEntry uses all-optional fields (A2 MEDIUM-confidence
  // shape) while parseBurndownChanges expects a slightly stricter inline type; both are
  // defensive and the runtime values are compatible.
  // Pass endTime so parseBurndownChanges can derive the ideal-burndown guideline
  // (linear from peak committed scope at startTime → 0 at endTime). The `ideal` field
  // feeds the dashed reference <Line> below, making the chart read as a true burndown.
  const burndownPoints = burndownRaw
    ? parseBurndownChanges(
        (burndownRaw.changes ?? {}) as unknown as Parameters<typeof parseBurndownChanges>[0],
        burndownRaw.startTime,
        burndownRaw.endTime,
      )
    : [];

  const hasBurndownData = burndownPoints.length > 0;

  return (
    <div role="region" aria-label="Sprint burndown chart">
      <ChartWrapper
        title="Sprint Burndown"
        description="Hours remaining · active sprint · time estimate"
        height={240}
        isLoading={showSkeleton}
        error={error}
        isEmpty={!hasBurndownData}
        onRetry={refetch}
      >
        {/* Explicit-height outer div — WebKit 0×0 guard (Phase 81 D-03). */}
        <div style={{ height: 240 }} className="w-full">
          <ChartContainer
            config={chartConfig}
            className="h-full w-full"
            aria-label="Sprint burndown area chart — hours remaining over sprint timeline"
          >
            <AreaChart data={burndownPoints} responsive>
              <XAxis
                dataKey="t"
                tickFormatter={(v: number) =>
                  new Date(v).toLocaleDateString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
                tick={{ fontSize: 11 }}
                interval={2}
              />
              {/* Y-axis: BurndownPoint.remaining is SECONDS (Probe C / 85-01 unit comment).
                  Divide by 3600 to display hours. h suffix mandatory — never SP/points. */}
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v / 3600)}h`}
                domain={[0, 'auto']}
                tick={{ fontSize: 11 }}
              />
              {/* Tooltip: remaining is SECONDS — divide by 3600 before passing to
                  formatHoursMinutes (which expects hours). Consistent with Y-axis /3600. */}
              <Tooltip
                formatter={(value) => {
                  const v = typeof value === 'number' ? value : Number(value);
                  return [formatHoursMinutes(v / 3600), 'Remaining'];
                }}
                labelFormatter={(label) => {
                  const ms = typeof label === 'number' ? label : Number(label);
                  return new Date(ms).toLocaleDateString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                  });
                }}
              />
              {/* Remaining area — var(--chart-3) per UI-SPEC color assignment */}
              <Area
                type="monotone"
                dataKey="remaining"
                name="Remaining"
                stroke="var(--chart-3)"
                fill="var(--chart-3)"
                fillOpacity={0.2}
                isAnimationActive={false}
              />
              {/* Ideal burndown guideline — dashed --muted-foreground (not a chart token,
                  keeps accent reserved for data series). dataKey="ideal" is the linear
                  reference line parseBurndownChanges derives from peak scope → 0 at endTime.
                  Renders only when the sprint window (endTime) is available. */}
              <Line
                type="monotone"
                dataKey="ideal"
                name="Ideal"
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </ChartWrapper>
    </div>
  );
}
