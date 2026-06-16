'use no memo';

/**
 * HoursCommitsChart — Phase 86 D-09/D-10/D-11/D-12/D-14
 *
 * Full-width dual-Y-axis grouped-bar ComposedChart showing:
 *   - Hours logged (blue, Tempo, left axis) for the rolling 7 calendar days ending today
 *   - Commits (green, GitLab, right axis) for the same 7 days
 *
 * Props-only (D-16): no useAuthStore, no readSecret inside this component.
 * Auth values loaded once in index.tsx and passed down as props.
 *
 * Queries:
 *   - Tempo: useQuery key ['dashboard','tempo-7day',jiraBaseUrl,todayDate,jiraUsername]
 *   - Commits: useQueries × 7, key ['standup','commits',...,day,...] (same as ActivityStrip)
 *
 * Tokens NEVER enter queryKey (T-86-05 / T-62-06).
 *
 * D-12: Tempo-off → empty state (not error).
 *       All-zero connected week → 7 flat bars with '0h'/'0' labels (not empty state).
 *
 * D-14: 'use no memo', responsive prop, explicit-height div, isAnimationActive={false}, var(--chart-N).
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import { Timer } from 'lucide-react';
import {
  Bar,
  ComposedChart,
  ReferenceLine,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { clickableCard } from '@/lib/clickable-card';
import { fetchUserCommits } from '@/services/gitlab';
import type { TempoWorklog } from '@/services/tempo/types';
import { fetchWorklogs } from '@/services/tempo/worklogs';
import { formatHoursMinutes } from './dashboardMetrics';

// ---------------------------------------------------------------------------
// Props interface — D-16: all auth values come from index.tsx props
// ---------------------------------------------------------------------------

interface HoursCommitsChartProps {
  jiraBaseUrl: string;
  jiraToken: string;
  jiraUsername: string;
  tempoEnabled: boolean;
  gitlabBaseUrl: string;
  gitlabToken: string;
  activeGitlabProject: number;
  gitlabUsername: string | null;
  gitlabName: string | null;
  gitlabEmail: string | null;
  /** Optional: makes the whole card clickable (navigates to Worklogs / Sprint Board). */
  onActivate?: () => void;
}

// ---------------------------------------------------------------------------
// Local-date helpers — NEVER toISOString() for local calendar dates (D-11)
// ---------------------------------------------------------------------------

/** Returns today's date as YYYY-MM-DD (local calendar, not UTC). */
function getTodayDate(): string {
  // en-CA locale yields YYYY-MM-DD — never toISOString() which shifts on UTC±
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Add N calendar days to a YYYY-MM-DD string.
 * Uses Date.UTC for arithmetic only — input and output are calendar dates with no timezone shift.
 * (Copied from dashboardMetrics.ts:159-163 — inlined here since addDays is not a survivor export.)
 *
 * The toISOString() below is the ONE sanctioned use: it reads back a Date that was
 * UTC-constructed via Date.UTC, so the UTC write and UTC read cancel exactly — there is no
 * local-timezone component to shift (DST-immune). Do NOT simplify Date.UTC → new Date here.
 */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d + n);
  return new Date(utcMs).toISOString().slice(0, 10);
}

/** Build an array of 7 local-calendar date strings, [6 days ago … today]. */
function getRolling7Days(todayDate: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(todayDate, i - 6));
}

// ---------------------------------------------------------------------------
// DayBucket type + buildRolling7Buckets — exported for unit tests (D-09/D-11/D-12)
// ---------------------------------------------------------------------------

export interface DayBucket {
  /** Calendar date as YYYY-MM-DD local calendar (never UTC-shifted). */
  day: string;
  /** Short weekday label for chart X-axis. */
  label: string;
  /** Whether this bucket is today. */
  isToday: boolean;
  /** Hours logged (summed from matching worklogs). */
  hours: number;
  /** Number of commits for this day. */
  commits: number;
}

/**
 * Build 7 DayBucket objects for the rolling 7-day window ending at todayDate.
 * Adapts buildWeekBuckets pattern (dashboardMetrics.ts:180) for rolling window.
 *
 * Bucketing uses direct string equality on worklog.dateStarted (pre-normalized YYYY-MM-DD
 * from fetchWorklogs — same pattern as buildWeekBuckets to avoid UTC-shift bugs).
 *
 * Commits come from the caller-supplied commitsByDay Map (day → commit count)
 * built from 7× useQueries results.
 *
 * @param worklogs    Array of TempoWorklog — dateStarted already YYYY-MM-DD (pre-normalized)
 * @param commitsByDay  Map from YYYY-MM-DD → commit count
 * @param todayDate   Today's date as YYYY-MM-DD (local calendar)
 */
export function buildRolling7Buckets(
  worklogs: TempoWorklog[],
  commitsByDay: Map<string, number>,
  todayDate: string,
): DayBucket[] {
  // Build 7 zero-filled buckets: 6 days ago → today
  const buckets: DayBucket[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(todayDate, i - 6);
    // Use noon (T12:00:00) to dodge DST edge — label derivation only
    const d = new Date(`${day}T12:00:00`);
    return {
      day,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: day === todayDate,
      hours: 0,
      commits: commitsByDay.get(day) ?? 0,
    };
  });

  // Bucket worklogs by pre-normalized dateStarted (string equality — same as buildWeekBuckets)
  for (const wl of worklogs) {
    const b = buckets.find((b) => b.day === wl.dateStarted);
    if (b) b.hours += wl.timeSpentSeconds / 3600;
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// Chart config — two series (hours: blue, commits: green)
// ---------------------------------------------------------------------------

// Semantic series colors — bound to the app's Tailwind palette so they are pixel-identical
// to the bg-blue-500 / bg-green-500 used everywhere else (statusStyles, My Issues card).
const HOURS_COLOR = 'var(--color-blue-500)'; // blue = hours logged
const COMMITS_COLOR = 'var(--color-green-500)'; // green = commits

const chartConfig = {
  hours: { label: 'Hours logged', color: HOURS_COLOR },
  commits: { label: 'Commits', color: COMMITS_COLOR },
} satisfies ChartConfig;

// Value-label layer. Rendered as a child of the chart so it can read the live x/y
// scales via Recharts v3 hooks. This labels EVERY day (including 0-value days that
// draw no bar): hours above each bar tip, commits below it — positions track heights.
interface LabelDatum {
  day: string;
  label: string;
  hours: number;
  commits: number;
  hoursNorm: number;
  commitsNorm: number;
}
function ValueLabels({ data }: { data: LabelDatum[] }) {
  // v3 category scale already returns the band CENTER — do not add bandwidth/2.
  const xScale = useXAxisScale() as unknown as ((v: string | number) => number) | undefined;
  const yScale = useYAxisScale() as unknown as ((v: number) => number) | undefined;
  if (!xScale || !yScale) return null;
  const y0 = yScale(0);
  return (
    <g>
      {data.map((b) => {
        const cx = xScale(b.label);
        const yTop = (b.hours > 0 ? yScale(b.hoursNorm) : y0) - 6;
        const yBot = (b.commits > 0 ? yScale(b.commitsNorm) : y0) + 14;
        return (
          <g key={b.day}>
            <text x={cx} y={yTop} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)">
              {b.hours > 0 ? formatHoursMinutes(b.hours) : '0h'}
            </text>
            <text x={cx} y={yBot} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)">
              {b.commits}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HoursCommitsChart({
  jiraBaseUrl,
  jiraToken,
  jiraUsername,
  tempoEnabled,
  gitlabBaseUrl,
  gitlabToken,
  activeGitlabProject,
  gitlabUsername,
  gitlabName,
  gitlabEmail,
  onActivate,
}: HoursCommitsChartProps) {
  const click = clickableCard(onActivate);
  // Rolling-7 date anchor — auto-rotates at midnight via queryKey (D-09)
  const todayDate = getTodayDate();
  const fromDate = addDays(todayDate, -6); // 6 days ago

  // ---------------------------------------------------------------------------
  // Tempo worklogs query
  // Key differs from WeeklyTrendChart's 'tempo-week' key (different window shape).
  // todayDate anchor ensures key auto-rotates at midnight without manual invalidation.
  // Token NEVER in queryKey (T-86-05 / T-62-06).
  // ---------------------------------------------------------------------------
  const {
    data: worklogs,
    isLoading: worklogsLoading,
    error: worklogsError,
    refetch: refetchWorklogs,
  } = useQuery({
    queryKey: ['dashboard', 'tempo-7day', jiraBaseUrl, todayDate, jiraUsername],
    queryFn: () => fetchWorklogs(jiraBaseUrl, jiraToken, [jiraUsername], fromDate, todayDate),
    staleTime: 30_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!jiraUsername && tempoEnabled,
  });

  // ---------------------------------------------------------------------------
  // GitLab commits — 7 parallel useQueries, one per day
  // Cache key MUST match ActivityStrip/StandupNotesPage VERBATIM for warm-cache sharing.
  // Token NEVER in queryKey (T-86-05).
  // ---------------------------------------------------------------------------
  const rolling7 = getRolling7Days(todayDate);

  const commitsResults = useQueries({
    queries: rolling7.map((day) => ({
      queryKey: [
        'standup',
        'commits',
        gitlabBaseUrl,
        activeGitlabProject,
        day,
        gitlabUsername || gitlabName || '',
      ],
      queryFn: () =>
        fetchUserCommits(
          gitlabBaseUrl ?? '',
          gitlabToken ?? '',
          activeGitlabProject ?? 0,
          day, // single-day date param — fetchUserCommits handles UTC conversion internally
          [gitlabUsername ?? ''],
          [gitlabName ?? ''],
          [gitlabEmail ?? ''],
        ),
      enabled:
        !!gitlabBaseUrl &&
        !!gitlabToken &&
        !!activeGitlabProject &&
        (!!gitlabUsername || !!gitlabName),
      staleTime: 5 * 60_000,
    })),
  });

  // Build commitsByDay Map from 7 useQueries results (result.data?.length ?? 0 per day)
  const commitsByDay = new Map<string, number>(
    rolling7.map((day, i) => [day, commitsResults[i]?.data?.length ?? 0]),
  );

  // Build 7 rolling buckets from fetched data
  const dayBuckets = buildRolling7Buckets(worklogs ?? [], commitsByDay, todayDate);

  // Derived values for header totals and reference line
  const totalHours = dayBuckets.reduce((sum, b) => sum + b.hours, 0);
  const totalCommits = dayBuckets.reduce((sum, b) => sum + b.commits, 0);
  const maxHours = Math.max(...dayBuckets.map((b) => b.hours), 0);
  const maxCommits = Math.max(...dayBuckets.map((b) => b.commits), 0);
  // Diverging chart data. Each side is normalized to its OWN max so hours (up) and
  // commits (down) reach similar visual heights — the shared numeric scale would
  // otherwise make commits dwarf hours. Real values are shown in the HTML label rows;
  // the bars only encode relative height. 0-edge case: max=0 → all bars flat (0).
  const chartData = dayBuckets.map((b) => ({
    ...b,
    hoursNorm: maxHours > 0 ? b.hours / maxHours : 0,
    commitsNorm: maxCommits > 0 ? -(b.commits / maxCommits) : 0,
  }));

  // Loading/skeleton state (200ms-gated to prevent flicker on warm-cache reads)
  const showSkeleton = useDelayedLoading(worklogsLoading);

  // ---------------------------------------------------------------------------
  // D-12: Tempo-off → graceful empty state (not an error)
  // This is the ONLY case that renders an EmptyState. An all-zero connected week
  // renders flat bars — NEVER shows empty state (Pitfall 6).
  // ---------------------------------------------------------------------------
  if (!tempoEnabled) {
    return (
      <Card
        role="region"
        aria-label="Past 7 days hours and commits"
        className={click.className}
        {...click.props}
      >
        <CardHeader>
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            PAST 7 DAYS · HOURS &amp; COMMITS PER DAY
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ height: 280 }} className="w-full flex items-center justify-center">
            <EmptyState
              icon={Timer}
              title="Tempo not connected"
              subtitle="Connect Tempo in Settings to see logged hours."
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      role="region"
      aria-label="Past 7 days hours and commits"
      className={click.className}
      {...click.props}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wide">
            PAST 7 DAYS · HOURS &amp; COMMITS PER DAY
          </CardTitle>
          {/* Legend — single line, square swatches, uncolored text */}
          <div className="flex items-center gap-4 text-sm tabular-nums text-muted-foreground">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: HOURS_COLOR }}
                aria-hidden
              />
              {formatHoursMinutes(totalHours)} logged
            </span>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: COMMITS_COLOR }}
                aria-hidden
              />
              {totalCommits} commits
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Loading skeleton — 200ms-gated via useDelayedLoading */}
        {showSkeleton && (
          <div style={{ height: 280 }} className="w-full flex items-center" aria-busy="true">
            <Skeleton className="w-full h-full rounded-md" />
          </div>
        )}
        {/* Error state — Tempo fetch failure; never hides the tempo-off empty state */}
        {!showSkeleton && worklogsError && (
          <div style={{ height: 280 }} className="w-full flex items-center justify-center">
            <ErrorState
              error={worklogsError}
              onRetry={refetchWorklogs}
              viewName="Hours & Commits"
            />
          </div>
        )}
        {/* Chart — tempoEnabled=true and not loading/error. All-zero week still renders here (D-12).
            Value labels sit at each bar's tip (above hours, below commits) so they track the
            individual bar heights. Day labels are in their own row below. */}
        {!showSkeleton && !worklogsError && (
          /* WebKit 0×0 guard: explicit-height outer div required (Phase 81 D-03). */
          <div style={{ height: 300 }} className="flex w-full flex-col">
            {/* Diverging bar chart: hours up (blue), commits down (green), shared zero baseline.
                cursor override forces the pointer over Recharts' SVG too (#5). */}
            <div
              className={`min-h-0 flex-1 ${onActivate ? 'cursor-pointer [&_*]:!cursor-pointer' : ''}`}
            >
              <ChartContainer
                config={chartConfig}
                className="h-full w-full"
                aria-label="Hours and commits per day diverging bar chart"
              >
                <ComposedChart
                  data={chartData}
                  responsive
                  stackOffset="sign"
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <XAxis dataKey="label" hide />
                  {/* Normalized domain: each side fills its half; headroom leaves room for the
                      per-bar value labels at the tips */}
                  <YAxis hide domain={[-1.25, 1.25]} />
                  {/* Two horizontal guide lines: 0 (center) and the max line (top), no labels */}
                  <ReferenceLine y={0} stroke="var(--border)" />
                  <ReferenceLine y={1} stroke="var(--border)" strokeDasharray="3 3" />
                  {/* 0-value days draw no bar (no minPointSize) */}
                  <Bar
                    dataKey="hoursNorm"
                    stackId="a"
                    fill={HOURS_COLOR}
                    maxBarSize={40}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="commitsNorm"
                    stackId="a"
                    fill={COMMITS_COLOR}
                    maxBarSize={40}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  {/* Value labels for ALL days (incl. 0-value days that draw no bar):
                      hours above the bar tip, commits below — positioned from the live scales */}
                  <ValueLabels data={chartData} />
                </ComposedChart>
              </ChartContainer>
            </div>

            {/* Day labels + date (with month) on a second line */}
            <div className="mt-1 flex px-2">
              {dayBuckets.map((b) => (
                <div key={b.day} className="flex-1 text-center">
                  <div className="text-sm text-muted-foreground">{b.label}</div>
                  <div className="text-xs tabular-nums text-muted-foreground/60">
                    {new Date(`${b.day}T12:00:00`).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
