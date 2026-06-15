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
import { buildIdealGuideline, formatHoursMinutes, parseBurndownChanges } from './dashboardMetrics';

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

  // Anchor at activatedTime (when "Start Sprint" was clicked = the real sprint start), NOT
  // startTime (the configured/planning start, often hours earlier). On this DC the gap is a
  // morning of sprint-planning scope adds (~93 changes on day 1) — anchoring at activatedTime
  // folds those into the committed-scope baseline so the curve starts at sprint start with the
  // committed total, instead of ramping up through "planning day" (UAT-4c). Falls back to
  // startTime if activatedTime is absent.
  const sprintStart = burndownRaw
    ? (burndownRaw.activatedTime ?? burndownRaw.startTime)
    : undefined;

  // V5 defensive parsing: default .changes to {} before parse (T-85-04-01).
  // parseBurndownChanges (from 85-01) applies ?? 0 and Math.max(0,…) per-entry.
  // Cast via unknown: BurndownChangeEntry uses all-optional fields (A2 MEDIUM-confidence
  // shape) while parseBurndownChanges expects a slightly stricter inline type; both are
  // defensive and the runtime values are compatible.
  // Pass endTime so parseBurndownChanges can derive the ideal-burndown guideline
  // (linear from peak committed scope at sprintStart → 0 at endTime). The `ideal` field
  // feeds the dashed reference <Line> below, making the chart read as a true burndown.
  const burndownPoints =
    burndownRaw && sprintStart !== undefined
      ? parseBurndownChanges(
          (burndownRaw.changes ?? {}) as unknown as Parameters<typeof parseBurndownChanges>[0],
          sprintStart,
          burndownRaw.endTime,
        )
      : [];

  const hasBurndownData = burndownPoints.length > 0;

  // Dashed ideal guideline as its own dense daily series (flat across weekends, UAT-4d).
  // peak = committed scope = the highest remaining of the actual series (the sprint-start baseline).
  const peakRemaining = burndownPoints.reduce((max, p) => Math.max(max, p.remaining), 0);
  const idealPoints =
    burndownRaw && sprintStart !== undefined
      ? buildIdealGuideline(peakRemaining, sprintStart, burndownRaw.endTime)
      : [];

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
              {/* Time-proportional X-axis (UAT-4c). type=number + scale=time plot each point
                  at its true timestamp — a categorical axis spaced all the day-1 planning
                  changes evenly, swallowing half the chart. Domain spans the full sprint
                  window [sprintStart, endTime] so the remaining days stay visible; both the
                  remaining area and the ideal line stop at the last change (~now), leaving the
                  not-yet-reached days as empty space on the right (conventional burndown). */}
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={
                  sprintStart !== undefined && burndownRaw?.endTime
                    ? [sprintStart, burndownRaw.endTime]
                    : ['dataMin', 'dataMax']
                }
                tickFormatter={(v: number) =>
                  new Date(v).toLocaleDateString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
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
                  keeps accent reserved for data series). Its OWN dense daily series
                  (buildIdealGuideline) so it can step FLAT across weekends; type="linear"
                  keeps the flat weekend segments flat (monotone would smooth them into a
                  curve). Renders only when the sprint window (endTime + scope) is available. */}
              <Line
                data={idealPoints}
                type="linear"
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
