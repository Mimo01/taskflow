'use no memo';

/**
 * WeeklyTrendChart — Phase 84 DASH-04/07
 *
 * Renders a Mon–Fri bar chart of Tempo-logged hours with an 8h/day reference line.
 * Props-only component — no useAuthStore, no readSecret (D-16 pattern).
 * Auth values are loaded once in index.tsx and passed down as props.
 *
 * One new fetch (D-05): ['dashboard', 'tempo-week', jiraBaseUrl, weekStartDate, jiraUsername].
 * Token NEVER enters the queryKey (T-84-02 / T-62-06).
 *
 * Pitfall 6: an all-zero week (empty worklogs array) is VALID data — renders the chart,
 * not the empty state. isEmpty={!tempoEnabled} — never isEmpty={worklogs.length === 0}.
 */
import { useQuery } from '@tanstack/react-query';
import { Timer } from 'lucide-react';
import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartWrapper } from '@/components/chart-wrapper';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { EmptyState } from '@/components/ui/empty-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchWorklogs } from '@/services/tempo/worklogs';
import { DAILY_TARGET_HOURS, buildWeekBuckets } from './dashboardMetrics';

// Props only — no readSecret, no useAuthStore inside the component.
// Auth values loaded once in index.tsx and passed down as props (D-16 pattern).
interface WeeklyTrendChartProps {
  jiraBaseUrl: string;
  jiraToken: string;
  jiraUsername: string;
  tempoEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Week date helpers — "which week am I in" only.
// The worklog bucketing itself is string-based inside buildWeekBuckets.
// en-CA locale yields YYYY-MM-DD from local calendar — never toISOString() (no UTC shift).
// ---------------------------------------------------------------------------

/** Returns Monday of the current week as YYYY-MM-DD (local calendar). */
function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  // toLocaleDateString('en-CA') → YYYY-MM-DD from local calendar (no UTC shift)
  return monday.toLocaleDateString('en-CA');
}

/** Returns today's date as YYYY-MM-DD (local calendar, not UTC). */
function getTodayDate(): string {
  // en-CA locale yields YYYY-MM-DD — never toISOString() which shifts on UTC±
  return new Date().toLocaleDateString('en-CA');
}

const chartConfig = {
  hours: { label: 'Hours logged', color: 'var(--chart-1)' },
} satisfies ChartConfig;

export default function WeeklyTrendChart({
  jiraBaseUrl,
  jiraToken,
  jiraUsername,
  tempoEnabled,
}: WeeklyTrendChartProps) {
  // Compute week boundaries once — local calendar dates, never toISOString()
  const weekStartDate = getMondayOfCurrentWeek();
  const todayDate = getTodayDate();

  // ONE permitted new fetch (D-05). Token lives in queryFn closure, NOT in queryKey (T-84-02).
  const {
    data: worklogs,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'tempo-week', jiraBaseUrl, weekStartDate, jiraUsername],
    queryFn: () =>
      fetchWorklogs(jiraBaseUrl, jiraToken, [jiraUsername], weekStartDate, todayDate),
    staleTime: 30_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!jiraUsername && tempoEnabled,
  });

  const showSkeleton = useDelayedLoading(isLoading);

  // Build Mon–Fri buckets from pre-normalized worklogs (dateStarted already YYYY-MM-DD).
  // An empty array yields all-zero buckets — this is valid data, not an empty state (Pitfall 6).
  const buckets = buildWeekBuckets(worklogs ?? [], weekStartDate);

  // D-06: Tempo-off is a graceful empty state (not an error).
  // Render the card shell with the Tempo-not-connected EmptyState when tempoEnabled=false,
  // bypassing ChartWrapper's generic "No data yet" message.
  if (!tempoEnabled) {
    return (
      <div role="region" aria-label="Weekly hours logged">
        <div className="bg-card rounded-[var(--radius)] border border-border p-6">
          <p className="text-base font-semibold text-foreground">Hours logged this week</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Mon – Fri · 8 h/day target</p>
          <div style={{ height: 240 }} className="w-full flex items-center justify-center">
            <EmptyState
              icon={Timer}
              title="Tempo not connected"
              subtitle="Connect Tempo in Settings to see your logged hours."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Weekly hours logged">
      <ChartWrapper
        title="Hours logged this week"
        description="Mon – Fri · 8 h/day target"
        height={240}
        isLoading={showSkeleton}
        // tempoEnabled=true with empty worklogs → render all-zero bars (Pitfall 6).
        // isEmpty stays false — an all-zero week is valid data, not empty.
        error={error}
        isEmpty={false}
        onRetry={refetch}
      >
        {/* Explicit-height outer div — WebKit 0×0 guard (Phase 81 D-03 / same class as
            virtualized-table-zero-width-col memory). */}
        <div style={{ height: 240 }} className="w-full">
          <ChartContainer
            config={chartConfig}
            className="h-full w-full"
            aria-label="Weekly logged hours bar chart"
          >
            <BarChart data={buckets} responsive>
              <XAxis dataKey="label" />
              <YAxis domain={[0, 12]} tickFormatter={(v) => `${v}h`} />
              {/* isAnimationActive={false} required — Phase 81 D-06 (animation causes test flakiness
                  and WebKit rendering issues in Tauri). */}
              <Bar dataKey="hours" fill="var(--chart-1)" isAnimationActive={false} />
              <ReferenceLine
                y={DAILY_TARGET_HOURS}
                stroke="var(--chart-2)"
                label={{ value: 'Target', position: 'right', fontSize: 11 }}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </ChartWrapper>
    </div>
  );
}
