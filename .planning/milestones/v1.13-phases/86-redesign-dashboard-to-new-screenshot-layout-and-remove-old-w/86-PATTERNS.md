# Phase 86: Dashboard Redesign — Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 8 (5 new source files + 3 new test files)
**Analogs found:** 8 / 8

All analog files verified to exist at `taskflow/src/routes/dashboard/` under the repo root
`/Users/mimo/Documents/Projects/taskflow/taskflow/`.

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/routes/dashboard/MyIssuesCard.tsx` | UI component — card | CRUD read (sprint-board cache) | `SprintHealthSection.tsx` | exact (same query key, same degradation pattern, same props-only D-16) |
| `src/routes/dashboard/UpcomingReleasesTimeline.tsx` | UI component — card | CRUD read (jira-fix-versions cache) | `DashboardReleaseCard.tsx` | exact (same queries, lift verbatim; extend 1-dot → 3-dot) |
| `src/routes/dashboard/HoursCommitsChart.tsx` | UI component — chart | request-response (Tempo + GitLab, 7 parallel queries) | `WeeklyTrendChart.tsx` (hours) + `ActivityStrip.tsx` (commits) | role-match for hours; partial for commits (dual-axis ComposedChart is net-new Recharts shape) |
| `src/routes/dashboard/index.tsx` (rewrite) | route composition | CRUD read (orchestrates token load + child props) | `index.tsx` (current) | exact retain — keep greeting/token/boardId shell; strip old widget composition |
| `src/routes/dashboard/MyIssuesCard.test.tsx` | test | unit + render | `SprintHealthSection.test.tsx` | exact (warm-cache seed via setQueryData + makeIssue factory) |
| `src/routes/dashboard/UpcomingReleasesTimeline.test.tsx` | test | unit + render | `DashboardReleaseCard.test.tsx` | exact (useQuery mock pattern + makeFixVersion factory) |
| `src/routes/dashboard/HoursCommitsChart.test.tsx` | test | unit | `WeeklyTrendChart.test.tsx` | role-match (no dual-axis test exists; adapt WeeklyTrendChart.test pattern) |
| `widget-removal.guard.test.ts` (extend) | test — fs guard | filesystem assertion | `widget-removal.guard.test.ts` (existing) | exact copy — add new `describe` block |

---

## Pattern Assignments

### `src/routes/dashboard/MyIssuesCard.tsx` (UI component, CRUD read)

**Analog:** `taskflow/src/routes/dashboard/SprintHealthSection.tsx`

**Directive note:** Props-only (no `useAuthStore`, no `readSecret`) — D-16 pattern. Receives `jiraBaseUrl`, `jiraToken`, `activeJiraProject`, `storyPointsFieldKey`, `jiraUserDisplayName` as props from the rewritten `index.tsx`.

**Imports pattern** (SprintHealthSection.tsx lines 19–36):
```tsx
'use no memo';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare } from 'lucide-react';      // icon changed to CheckSquare per UI-SPEC
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchSprintIssues } from '@/services/jira';
import { filterNonSubtasks } from './dashboardMetrics';  // survivor — KEEP
```

**Props interface** (copy and adapt from SprintHealthSection.tsx lines 38–45):
```tsx
interface MyIssuesCardProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
  storyPointsFieldKey: string;
  jiraUserDisplayName: string;
}
```

**Cache query — MUST reuse verbatim cache key** (SprintHealthSection.tsx lines 62–72):
```tsx
const {
  data: sprintIssuesRaw,
  isLoading,
  error,
  refetch,
} = useQuery({
  queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
  queryFn: () =>
    fetchSprintIssues(jiraBaseUrl, jiraToken, activeJiraProject, false, storyPointsFieldKey),
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
});
const showSkeleton = useDelayedLoading(isLoading);
```

**Issue derivation pattern** (lifted from `dashboardMetrics.ts` lines 64–84, verified by RESEARCH.md):
```tsx
const sprintIssues = Array.isArray(sprintIssuesRaw) ? sprintIssuesRaw : [];
const myNonSubtasks = filterNonSubtasks(sprintIssues).filter(
  (i) => i.fields.assignee?.displayName === jiraUserDisplayName,
);
const toDo      = myNonSubtasks.filter(i => i.fields.status.statusCategory?.key === 'new').length;
const inProgress = myNonSubtasks.filter(i => i.fields.status.statusCategory?.key === 'indeterminate').length;
const done       = myNonSubtasks.filter(i => i.fields.status.statusCategory?.key === 'done').length;
const total      = myNonSubtasks.length;
// D-03 invariant: toDo + inProgress + done === total (assert in test)
```

**Degradation pattern** (copy structure from SprintHealthSection.tsx lines 108–119; adapt to new states):
```tsx
// Loading skeleton — 200ms-gated via useDelayedLoading
{showSkeleton && (
  <div aria-busy="true" className="flex flex-col gap-2">
    <Skeleton className="h-2 w-full" />
    <Skeleton className="h-8 w-1/4" />
    <Skeleton className="h-2 w-full" />
  </div>
)}
// Error state
{!showSkeleton && error && (
  <ErrorState error={error} onRetry={refetch} viewName="My Issues" />
)}
// Empty state — 0 issues is valid (D-05); never an error
{!showSkeleton && !error && total === 0 && (
  <EmptyState icon={CheckSquare} title="No issues assigned"
    subtitle="You have no issues assigned in the current sprint." />
)}
```

**Card shell pattern** (DashboardReleaseCard.tsx lines 75–83 — Card + CardHeader label style):
```tsx
<Card role="region" aria-label="My issues this sprint">
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-xs font-normal text-muted-foreground uppercase tracking-wide">
      <CheckSquare className="size-4 text-chart-1" aria-hidden />
      MY ISSUES
    </CardTitle>
    <CardDescription>this sprint</CardDescription>
  </CardHeader>
  <CardContent className="flex flex-col gap-3">
    {/* states + data */}
  </CardContent>
</Card>
```

**Segmented bar (net-new visual, no analog):** Build inline with flex layout:
```tsx
// Big number row
<div className="flex items-baseline gap-1">
  <span className="text-4xl font-semibold text-foreground">{done}</span>
  <span className="text-sm font-normal text-muted-foreground"> of {total} done</span>
</div>
// Segmented bar — three proportional flex segments inside rounded track
<div
  role="img"
  aria-label={`Sprint progress: ${toDo} to do, ${inProgress} in progress, ${done} done`}
  className="h-2 rounded-full overflow-hidden bg-muted flex"
>
  {total > 0 && (
    <>
      <div className="bg-muted-foreground/40" style={{ width: `${(toDo / total) * 100}%` }} />
      <div className="bg-chart-1"             style={{ width: `${(inProgress / total) * 100}%` }} />
      <div className="bg-chart-2"             style={{ width: `${(done / total) * 100}%` }} />
    </>
  )}
</div>
// Legend
<div className="flex items-center gap-4">
  {[
    { label: 'To Do', count: toDo,       cls: 'bg-muted-foreground/40' },
    { label: 'In Progress', count: inProgress, cls: 'bg-chart-1' },
    { label: 'Done',  count: done,       cls: 'bg-chart-2' },
  ].map(({ label, count, cls }) => (
    <div key={label} className="flex items-center gap-1">
      <span className={`size-2 rounded-sm ${cls}`} />
      <span className="text-xs font-normal text-muted-foreground">{label} {count}</span>
    </div>
  ))}
</div>
```

**What changes vs analog:**
- Donut chart → segmented horizontal bar (net-new visual element)
- `computeSpDone`/`computeSpTotal` (deleted) → inline statusCategory bucketing
- Icon: `Activity` → `CheckSquare`
- D-05 empty state is 0 assigned issues (not 0 SP points as in SprintHealthSection)
- No `boardId` prop needed (MyIssuesCard does NOT use `fetchActiveSprint`)

---

### `src/routes/dashboard/UpcomingReleasesTimeline.tsx` (UI component, CRUD read)

**Analog:** `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx`

**Directive note:** Props-only (D-16). Receives `jiraBaseUrl`, `jiraToken`, `activeJiraProject`. Self-contained `useQuery` calls — mirror DashboardReleaseCard exactly, then extend 1-dot → 3-dot.

**Imports pattern** (DashboardReleaseCard.tsx lines 11–18):
```tsx
'use no memo';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { JiraFixVersion } from '@/services/jira';
import { fetchFixVersions, fetchReleaseIssues } from '@/services/jira';
```

**`getReleaseTimingLabel` — lift verbatim** (DashboardReleaseCard.tsx lines 26–37):
```tsx
type TimingLabel = 'overdue' | 'due-today' | { daysUntil: number } | null;

function getReleaseTimingLabel(releaseDate: string | undefined, released: boolean): TimingLabel {
  if (released || !releaseDate) return null;
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" — timezone-safe
  if (releaseDate < today) return 'overdue';
  if (releaseDate === today) return 'due-today';
  const msPerDay = 86_400_000;
  const days = Math.round((new Date(releaseDate).getTime() - new Date(today).getTime()) / msPerDay);
  return { daysUntil: days };
}
```

**Fix-versions query — MUST reuse verbatim cache key** (DashboardReleaseCard.tsx lines 45–50):
```tsx
const { data: fixVersions, isLoading, error, refetch } = useQuery({
  queryKey: ['jira-fix-versions', activeJiraProject],
  queryFn: () => fetchFixVersions(jiraBaseUrl, jiraToken, activeJiraProject),
  staleTime: 5 * 60_000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
});
const showSkeleton = useDelayedLoading(isLoading);
```

**"Next 3" sort — ascending (not descending like ReleasesTab)** (DashboardReleaseCard.tsx lines 54–58 — extend to slice 3):
```tsx
// ASCENDING sort: dashboard needs SOONEST first; ReleasesTab sorts descending (RESEARCH Pitfall 6)
const upcomingVersions: JiraFixVersion[] = (fixVersions ?? [])
  .filter((v) => !v.released && !!v.releaseDate)
  .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))
  .slice(0, 3);                 // take up to 3 (D-06)
```

**Per-release issues — use `useQueries` for 3 parallel fetches** (adapt from DashboardReleaseCard.tsx lines 62–68):
```tsx
// 1 query per upcoming release, parallel, same cache key pattern
const releaseIssueResults = useQueries({
  queries: upcomingVersions.map((v) => ({
    queryKey: ['jira-release-issues', activeJiraProject, v.name],
    queryFn: () => fetchReleaseIssues(jiraBaseUrl, jiraToken, activeJiraProject, v.name),
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  })),
});
```

**`donePct` logic — copy verbatim** (DashboardReleaseCard.tsx lines 70–73):
```tsx
const doneCount = issueList.filter(i => i.fields.status.statusCategory?.key === 'done').length;
const donePct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
// D-CLAMP: Math.min(100, donePct) as an extra safety guard per RESEARCH.md STRIDE
```

**Timing label render layer — add "Tomorrow" case** (DashboardReleaseCard.tsx line 110 comparison — add before the generic daysUntil branch):
```tsx
// Note: getReleaseTimingLabel() returns { daysUntil: 1 } for tomorrow.
// Render layer handles the "Tomorrow" string (function unchanged per RESEARCH.md).
function formatTimingLabel(timing: TimingLabel): { text: string; className: string } {
  if (timing === 'due-today') return { text: 'Today',    className: 'text-muted-foreground' };
  if (timing === 'overdue')   return { text: 'overdue',  className: 'text-amber-600 dark:text-amber-400' };
  if (timing && typeof timing === 'object') {
    if (timing.daysUntil === 1) return { text: 'Tomorrow',           className: 'text-muted-foreground' };
    return { text: `in ${timing.daysUntil} days`, className: 'text-muted-foreground' };
  }
  return { text: '',           className: '' };
}
```

**Card shell + skeleton + empty state** (DashboardReleaseCard.tsx lines 75–129 — match structure exactly):
```tsx
<Card role="region" aria-label="Upcoming releases">
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-xs font-normal text-muted-foreground uppercase tracking-wide">
      <Calendar className="size-4 text-chart-1" aria-hidden />
      UPCOMING RELEASES
    </CardTitle>
    <CardDescription>next 3 with due dates</CardDescription>
  </CardHeader>
  <CardContent className="flex flex-col gap-3">
    {/* Skeleton */}
    {showSkeleton && (
      <div className="flex flex-col gap-2" aria-busy="true">
        {[0, 1, 2].map((i) => <div key={i} className="h-2 rounded bg-muted animate-pulse" />)}
      </div>
    )}
    {/* Error */}
    {!showSkeleton && error && (
      <ErrorState error={error} onRetry={refetch} viewName="Upcoming Releases" />
    )}
    {/* Empty */}
    {!showSkeleton && !error && upcomingVersions.length === 0 && (
      <EmptyState icon={Calendar} title="No upcoming releases"
        subtitle="No unreleased versions with a due date were found." />
    )}
    {/* Timeline — 3-dot layout (net-new visual vs DashboardReleaseCard single-dot) */}
    {!showSkeleton && !error && upcomingVersions.length > 0 && (
      <div className="relative flex justify-between">
        {/* Track line behind dots */}
        <div className="absolute top-[5px] left-0 right-0 h-px bg-border" />
        {upcomingVersions.map((v, idx) => { /* dot + label per release */ })}
      </div>
    )}
  </CardContent>
</Card>
```

**What changes vs analog (DashboardReleaseCard):**
- 1 soonest version → up to 3 (`slice(0, 3)`) with `useQueries`
- Single vertical card layout → horizontal timeline with dots
- No `<Badge>` — plain text timing labels (UI-SPEC uses text, not badges)
- "Tomorrow" render case added to format helper
- `<Progress>` retained per release dot as readiness bar (same `donePct` source)

---

### `src/routes/dashboard/HoursCommitsChart.tsx` (UI component — chart, dual-data-source)

**Primary analog:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` (hours series)
**Secondary analog:** `taskflow/src/routes/dashboard/ActivityStrip.tsx` (commits `fetchUserCommits` pattern)
**Net-new shape:** Dual-axis `ComposedChart` with `yAxisId` — no existing analog in the repo.

**Directive note:** Props-only (D-16). Receives all auth values as props. `HoursCommitsChart` is responsible for its own `useQuery`/`useQueries` calls.

**Imports pattern** (WeeklyTrendChart.tsx lines 16–25 — adapt for ComposedChart + dual-axis):
```tsx
'use no memo';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Timer } from 'lucide-react';
import { Bar, Cell, ComposedChart, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchUserCommits } from '@/services/gitlab';
import { fetchWorklogs } from '@/services/tempo/worklogs';
import { formatHoursMinutes } from './dashboardMetrics';  // survivor — KEEP
```

**Props interface** (WeeklyTrendChart.tsx lines 29–34 — extend with gitlab fields):
```tsx
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
}
```

**Local-date helpers** (WeeklyTrendChart.tsx lines 42–57 — copy verbatim, adapt for rolling-7):
```tsx
/** Returns today's date as YYYY-MM-DD (local calendar, not UTC). */
function getTodayDate(): string {
  // en-CA locale yields YYYY-MM-DD — never toISOString() which shifts on UTC±
  return new Date().toLocaleDateString('en-CA');
}

/** addDays — copy from dashboardMetrics.ts lines 159–163 (inline here if metrics file is slimmed). */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d + n);
  return new Date(utcMs).toISOString().slice(0, 10);
}

/** Build an array of 7 local-calendar date strings, [6 days ago … today]. */
function getRolling7Days(todayDate: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(todayDate, i - 6));
}
```

**Tempo worklogs query — adapt cache key from 'tempo-week' → 'tempo-7day'** (WeeklyTrendChart.tsx lines 83–93):
```tsx
const todayDate = getTodayDate();
const fromDate  = addDays(todayDate, -6);  // 6 days ago

const {
  data: worklogs,
  isLoading: worklogsLoading,
  error: worklogsError,
  refetch: refetchWorklogs,
} = useQuery({
  // New cache key: anchor on todayDate so key auto-rotates at midnight (RESEARCH.md)
  queryKey: ['dashboard', 'tempo-7day', jiraBaseUrl, todayDate, jiraUsername],
  queryFn: () => fetchWorklogs(jiraBaseUrl, jiraToken, [jiraUsername], fromDate, todayDate),
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!jiraUsername && tempoEnabled,
});
```

**Commits queries — 7 parallel via `useQueries`** (ActivityStrip.tsx lines 158–190 — adapt key for 7 days):
```tsx
const rolling7 = getRolling7Days(todayDate);

const commitsResults = useQueries({
  queries: rolling7.map((day) => ({
    // Cache key MUST match ActivityStrip/StandupNotesPage exactly for the shared day
    // (yesterday's entry will warm-cache-hit without a duplicate network call)
    queryKey: [
      'standup', 'commits',
      gitlabBaseUrl, activeGitlabProject, day,
      gitlabUsername || gitlabName || '',
    ],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token) throw new Error('No GitLab token');
      return fetchUserCommits(
        gitlabBaseUrl ?? '',
        token,
        activeGitlabProject ?? 0,
        day,                              // single-day date param — fetchUserCommits handles UTC conversion internally
        [gitlabUsername ?? ''],
        [gitlabName ?? ''],
        [gitlabEmail ?? ''],
      );
    },
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!activeGitlabProject
              && (!!gitlabUsername || !!gitlabName),
    staleTime: 5 * 60_000,
  })),
});
```

**Rolling-7 bucket builder (net-new helper)** (adapts `buildWeekBuckets` from dashboardMetrics.ts lines 180–197):
```tsx
interface DayBucket {
  day: string;      // YYYY-MM-DD local calendar
  label: string;    // short weekday "Mon", "Tue", ...
  isToday: boolean;
  hours: number;
  commits: number;
}

function buildRolling7Buckets(
  worklogs: TempoWorklog[],
  commitsByDay: Map<string, number>,
  todayDate: string,
): DayBucket[] {
  const buckets: DayBucket[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(todayDate, i - 6);
    const d = new Date(`${day}T12:00:00`);   // noon to dodge DST edge
    return {
      day,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: day === todayDate,
      hours: 0,
      commits: commitsByDay.get(day) ?? 0,
    };
  });
  // Bucket by pre-normalized dateStarted (string equality — same pattern as buildWeekBuckets)
  for (const wl of worklogs) {
    const b = buckets.find((b) => b.day === wl.dateStarted);
    if (b) b.hours += wl.timeSpentSeconds / 3600;
  }
  return buckets;
}
```

**ChartConfig** (WeeklyTrendChart.tsx lines 59–61 — extend to two series):
```tsx
const chartConfig = {
  hours:   { label: 'Hours logged', color: 'var(--chart-1)' },
  commits: { label: 'Commits',      color: 'var(--chart-2)' },
} satisfies ChartConfig;
```

**Tempo-off empty state — lift verbatim** (WeeklyTrendChart.tsx lines 106–123):
```tsx
// D-12: Tempo-off → empty state, not error. Never isEmpty when tempoEnabled + data is all-zero.
if (!tempoEnabled) {
  return (
    <Card role="region" aria-label="Past 7 days hours and commits">
      <CardHeader>
        <CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
          PAST 7 DAYS · HOURS & COMMITS PER DAY
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
```

**Chart body — dual-axis ComposedChart (net-new shape; `responsive` + dual `YAxis` pitfall flagged):**
```tsx
// WebKit 0×0 guard: explicit-height outer div required (Phase 81 D-03)
// isAnimationActive={false} required on all Bar (Phase 81 D-06)
// Both <Bar> and both <YAxis> MUST carry matching yAxisId strings or bars disappear
<div style={{ height: 280 }} className="w-full">
  <ChartContainer
    config={chartConfig}
    className="h-full w-full"
    aria-label="Hours and commits per day bar chart"
  >
    <ComposedChart data={dayBuckets} responsive margin={{ top: 24, right: 40, left: 0, bottom: 0 }}>
      <XAxis dataKey="label" tick={<TodayAwareTick todayLabel={todayLabel} />} />
      <YAxis yAxisId="hours"   orientation="left"  tickFormatter={(v) => `${v}h`} />
      <YAxis yAxisId="commits" orientation="right" />
      <ReferenceLine
        yAxisId="hours"
        y={maxHours}
        strokeDasharray="4 4"
        stroke="var(--muted-foreground)"
      />
      <Bar yAxisId="hours" dataKey="hours" fill="var(--chart-1)" radius={[4,4,0,0]} isAnimationActive={false}>
        {dayBuckets.map((b) => (
          <Cell
            key={b.day}
            fill="var(--chart-1)"
            stroke={b.isToday ? 'var(--foreground)' : undefined}
            strokeWidth={b.isToday ? 2 : 0}
          />
        ))}
        <LabelList
          dataKey="hours"
          position="top"
          fontSize={12}
          fill="var(--muted-foreground)"
          formatter={(v: unknown) => {
            const n = typeof v === 'number' ? v : Number(v);
            return Number.isFinite(n) && n > 0 ? formatHoursMinutes(n) : '0h';
          }}
        />
      </Bar>
      <Bar yAxisId="commits" dataKey="commits" fill="var(--chart-2)" radius={[4,4,0,0]}
           isAnimationActive={false} minPointSize={1}>
        {dayBuckets.map((b) => (
          <Cell
            key={b.day}
            fill="var(--chart-2)"
            stroke={b.isToday ? 'var(--foreground)' : undefined}
            strokeWidth={b.isToday ? 2 : 0}
          />
        ))}
        <LabelList
          dataKey="commits"
          position="bottom"
          fontSize={12}
          fill="var(--muted-foreground)"
          formatter={(v: unknown) => String(Number.isFinite(Number(v)) ? Number(v) : 0)}
        />
      </Bar>
    </ComposedChart>
  </ChartContainer>
</div>
```

**Today-pill X-axis tick (net-new; no repo analog — `foreignObject` approach):**
```tsx
// ASSUMPTION A2: foreignObject works in Tauri WebKit. If not, fall back to SVG <text> + <rect>.
interface CustomTickProps { x?: number; y?: number; payload?: { value: string }; todayLabel: string }
function TodayAwareTick({ x = 0, y = 0, payload, todayLabel }: CustomTickProps) {
  if (payload?.value === todayLabel) {
    return (
      <foreignObject x={x - 16} y={y} width={32} height={20}>
        <div className="flex justify-center">
          <span className="text-xs font-normal bg-foreground text-background rounded-full px-2 py-0.5">
            {payload.value}
          </span>
        </div>
      </foreignObject>
    );
  }
  return (
    <text x={x} y={y + 10} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)">
      {payload?.value}
    </text>
  );
}
```

**Header-right totals** (net-new; pattern adapts the Card/CardHeader structure from DashboardReleaseCard):
```tsx
// Render inside <CardHeader>:
<div className="flex items-center justify-between">
  <CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
    PAST 7 DAYS · HOURS & COMMITS PER DAY
  </CardTitle>
  <div className="flex items-center gap-4">
    <span className="text-sm font-normal" style={{ color: 'var(--chart-1)' }}>
      {formatHoursMinutes(totalHours)} h logged
    </span>
    <span className="text-sm font-normal" style={{ color: 'var(--chart-2)' }}>
      {totalCommits} commits
    </span>
  </div>
</div>
```

**What is a clean analog vs what is net-new:**

| Sub-feature | Analog exists? | Source |
|-------------|----------------|--------|
| `fetchWorklogs` query pattern | YES | WeeklyTrendChart.tsx lines 83–93 |
| Local-date bucketing via string equality | YES | dashboardMetrics.ts `buildWeekBuckets` lines 180–197 |
| `fetchUserCommits` per-day, parallel cache key | YES | ActivityStrip.tsx lines 158–190 |
| `Cell` today-stroke highlight on bars | YES | WeeklyTrendChart.tsx lines 165–176 |
| `LabelList position="top"` with 0-value label | YES (but WeeklyTrendChart returns '' not '0h') | WeeklyTrendChart.tsx lines 177–184 (change `''` → `'0h'`) |
| `tempoEnabled=false` → EmptyState (not error) | YES | WeeklyTrendChart.tsx lines 106–123 |
| `isAnimationActive={false}` on Bar | YES | WeeklyTrendChart.tsx line 165 |
| Explicit-height `<div style={{ height }}>` | YES | WeeklyTrendChart.tsx line 141 |
| `ChartContainer` + `responsive` on chart element | YES | WeeklyTrendChart.tsx lines 144–147 |
| Dual `<YAxis>` with `yAxisId` | NET-NEW | No dual-axis chart in repo — see RESEARCH.md ComposedChart pitfalls |
| `<ComposedChart>` instead of `<BarChart>` | NET-NEW | Only `<BarChart>` / `<PieChart>` exist in codebase |
| Today-pill on X-axis tick via foreignObject | NET-NEW | No custom X-axis tick exists in repo |
| `buildRolling7Buckets` helper | NET-NEW | Adapts `buildWeekBuckets`; rolling window (not Mon-Fri fixed) |
| 7× parallel `useQueries` for commits | NET-NEW (shape) | ActivityStrip uses single `useQuery` for 1 day; same cache key, 7 instances |

---

### `src/routes/dashboard/index.tsx` (route composition — REWRITE)

**Analog:** `taskflow/src/routes/dashboard/index.tsx` (current file — lines to retain vs remove)

**Retain verbatim (lines 1–92 structure):**
```tsx
'use no memo';
// Imports to KEEP:
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useBoardId } from '@/hooks/useBoardId';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchActiveSprint, fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
// NEW imports replacing old widget imports:
import MyIssuesCard from './MyIssuesCard';
import UpcomingReleasesTimeline from './UpcomingReleasesTimeline';
import HoursCommitsChart from './HoursCommitsChart';
```

**`getTimeGreeting()` — retain verbatim** (index.tsx lines 25–30):
```tsx
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}
```

**First-name parser — retain verbatim** (index.tsx lines 88–91):
```tsx
const tokens = (jiraUserDisplayName?.trim().split(/\s+/) ?? []).filter(
  (t) => !/^\[.*\]$/.test(t) && !/^\(.*\)$/.test(t),
);
const firstName = tokens.find((t) => t !== t.toUpperCase()) ?? tokens[0] ?? null;
```

**Token-load effects — retain verbatim** (index.tsx lines 54–69 — both PAT effects):
```tsx
useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat').then((t) => setJiraToken(t)).catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);

useEffect(() => {
  if (gitlabBaseUrl) {
    readSecret('gitlab-pat').then((t) => setGitlabToken(t)).catch(() => setGitlabToken(null));
  }
}, [gitlabBaseUrl]);
```

**Sprint-board query — retain verbatim** (index.tsx lines 100–112; change variable name to `sprintIssuesRaw`):
```tsx
const { data: sprintIssuesRaw, isLoading: sprintBoardLoading } = useQuery({
  queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
  queryFn: () => fetchSprintIssues(jiraBaseUrl ?? '', jiraToken ?? '',
                                   activeJiraProject ?? '', false, storyPointsFieldKey),
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
});
```

**Active-sprint query — retain verbatim** (index.tsx lines 130–141):
```tsx
const { data: activeSprint } = useQuery({
  queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId],
  queryFn: () => fetchActiveSprint(jiraBaseUrl ?? '', jiraToken ?? '',
                                   activeJiraProject ?? '', boardId ?? undefined),
  staleTime: 5 * 60_000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && boardId != null,
});
```

**Sprint-day subline (net-new, no exact analog — derive from active-sprint dates):**
```tsx
// D-13: Sprint-position subline. Both dates: local calendar. Hide clause when sprint null.
const today = new Date().toLocaleDateString('en-CA');  // YYYY-MM-DD
const sprintClause = (() => {
  if (!activeSprint?.startDate || !activeSprint?.endDate) return '';
  // addDays(date, 0) trick or inline diff:
  const [sy, sm, sd] = activeSprint.startDate.slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = activeSprint.endDate.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const elapsed = Math.round((Date.UTC(ty, tm-1, td) - Date.UTC(sy, sm-1, sd)) / 86_400_000) + 1;
  const total   = Math.round((Date.UTC(ey, em-1, ed) - Date.UTC(sy, sm-1, sd)) / 86_400_000) + 1;
  return ` · Sprint day ${elapsed} of ${total}`;
})();
```

**Hero header shell — retain + upgrade `text-3xl` → `text-4xl`** (index.tsx lines 150–157):
```tsx
<div className="flex items-end justify-between gap-4 px-6 pt-5 pb-5 border-b border-border/50 shrink-0">
  <div className="flex flex-col gap-1 min-w-0">
    <h1 className="text-4xl font-semibold text-foreground">  {/* text-3xl → text-4xl per UI-SPEC */}
      {timeGreeting} {firstName ?? 'there'}
    </h1>
    <p className="text-xs text-muted-foreground mt-1">
      {new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
      {sprintClause}
    </p>
  </div>
</div>
```

**New 3-region composition — replaces old widget grid** (index.tsx lines 160–270 — REPLACE entirely):
```tsx
<div className="flex flex-col gap-4 px-6 py-4">
  {/* Top row: MY ISSUES (left) + UPCOMING RELEASES (right) */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <MyIssuesCard
      jiraBaseUrl={jiraBaseUrl ?? ''}
      jiraToken={jiraToken ?? ''}
      activeJiraProject={activeJiraProject ?? ''}
      storyPointsFieldKey={storyPointsFieldKey}
      jiraUserDisplayName={jiraUserDisplayName ?? ''}
    />
    <UpcomingReleasesTimeline
      jiraBaseUrl={jiraBaseUrl ?? ''}
      jiraToken={jiraToken ?? ''}
      activeJiraProject={activeJiraProject ?? ''}
    />
  </div>

  {/* Bottom row: PAST 7 DAYS chart — full-width */}
  <HoursCommitsChart
    jiraBaseUrl={jiraBaseUrl ?? ''}
    jiraToken={jiraToken ?? ''}
    jiraUsername={jiraUsername ?? ''}
    tempoEnabled={tempoEnabled}
    gitlabBaseUrl={gitlabBaseUrl ?? ''}
    gitlabToken={gitlabToken ?? ''}
    activeGitlabProject={activeGitlabProject ?? 0}
    gitlabUsername={gitlabUsername ?? null}
    gitlabName={gitlabName ?? null}
    gitlabEmail={gitlabEmail ?? null}
  />
</div>
```

**What is REMOVED from index.tsx (RESEARCH.md "Remove all imports of"):**
- Imports: `StatTile`, `SprintHealthSection`, `WeeklyTrendChart`, `ActivityStrip`, `DashboardReleaseCard`, `VelocityChart`, `BurndownChart`, `computePersonalTileCounts`, `computeSpDone`, `Activity`, `CheckCircle2`, `Clock`, `Zap`
- All JSX rendering those components and the `showTileSkeleton`, `tileCounts`, `spDone` derivations
- The 4-tile grid block (lines 162–207) and both 2-column widget rows (lines 209–248, 249–269)

---

## Test File Pattern Assignments

### `src/routes/dashboard/MyIssuesCard.test.tsx`

**Analog:** `taskflow/src/routes/dashboard/SprintHealthSection.test.tsx`

**Test scaffold — copy verbatim, adapt factory and assertions** (SprintHealthSection.test.tsx lines 1–95):
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
}));

const SP_KEY = 'customfield_10016';
const SPRINT_BOARD_KEY = ['jira-issues', 'sprint-board', 'PROJ', SP_KEY];

function makeIssue(overrides: {
  subtask: boolean;
  assignee: string | null;
  statusCategory: 'new' | 'indeterminate' | 'done';
}): JiraIssue {
  return { /* minimal JiraIssue shape */ } as unknown as JiraIssue;
}

// Warm-cache seed pattern (SprintHealthSection.test.tsx lines 69–95):
function renderWithQuery(ui: React.ReactElement, { sprintIssues }: { sprintIssues?: JiraIssue[] } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (sprintIssues !== undefined) {
    queryClient.setQueryData(SPRINT_BOARD_KEY, sprintIssues);
  }
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}
```

**D-03 invariant test — assert sum === total** (net-new; no analog):
```tsx
it('D-03: toDo + inProgress + done === total for any fixture', () => {
  // This is a pure unit test on the derivation logic, not a render test.
  // Import the derivation inline or extract to a testable helper.
  const issues = [ /* mixed statusCategory fixture */ ];
  const myIssues = filterNonSubtasks(issues).filter(i => i.fields.assignee?.displayName === 'Alice');
  const toDo = myIssues.filter(i => i.fields.status.statusCategory?.key === 'new').length;
  const inProgress = myIssues.filter(i => i.fields.status.statusCategory?.key === 'indeterminate').length;
  const done = myIssues.filter(i => i.fields.status.statusCategory?.key === 'done').length;
  expect(toDo + inProgress + done).toBe(myIssues.length);
});
```

**D-05 empty state test:**
```tsx
it('D-05: renders empty state when 0 issues assigned to me', async () => {
  // Pass an issue assigned to a different user → myNonSubtasks is empty
  const issues = [makeIssue({ subtask: false, assignee: 'Other User', statusCategory: 'done' })];
  renderWithQuery(<MyIssuesCard {...defaultProps} />, { sprintIssues: issues });
  expect(screen.getByText('No issues assigned')).toBeTruthy();
});
```

---

### `src/routes/dashboard/UpcomingReleasesTimeline.test.tsx`

**Analog:** `taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx`

**Test scaffold — copy verbatim** (DashboardReleaseCard.test.tsx lines 1–50):
```tsx
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false }),
    useQueries: vi.fn().mockReturnValue([]),   // add useQueries mock for 3-dot version
  };
});

function makeFixVersion(name: string, releaseDate: string | undefined, released = false) {
  return { id: name, name, released, releaseDate };
}
```

**D-06/D-08 fewer-than-3 test** (net-new):
```tsx
it('D-08: renders only 2 dots when only 2 upcoming releases exist', async () => {
  // mock useQuery with 2 versions; assert 2 dots rendered, no placeholder
});
it('D-08: renders empty state when 0 upcoming releases with due dates', async () => {
  // mock useQuery with [] versions; assert empty state
});
```

---

### `src/routes/dashboard/HoursCommitsChart.test.tsx`

**Analog:** `taskflow/src/routes/dashboard/WeeklyTrendChart.test.tsx` (adapt structure)

**D-12 all-zero week test (critical per CONTEXT.md):**
```tsx
it('D-12: renders 7 flat bars (not empty state) when all hours and commits are 0', () => {
  // mock useQuery (tempo) → worklogs: []
  // mock useQueries (commits) → all 7 days return []
  // assert: ChartContainer present, EmptyState absent
});
it('D-12: renders "0h" labels on flat 0-hour bars', () => { /* assert LabelList '0h' text */ });
```

**Tempo-off test (from WeeklyTrendChart pattern):**
```tsx
it('renders Tempo empty state when tempoEnabled=false', () => {
  // render with tempoEnabled=false prop
  // assert: "Tempo not connected" text present; no chart
});
```

---

### `widget-removal.guard.test.ts` (extend)

**Analog:** `taskflow/src/routes/dashboard/widget-removal.guard.test.ts` (existing — exact copy pattern)

**Extend with a new `describe` block after existing ones** (widget-removal.guard.test.ts lines 22–44 — copy structure):
```ts
describe('dashboard subtree — Phase 86 widget removal guard', () => {
  // Filesystem absence — one assertion per deleted file:
  it('StatTile.tsx does not exist',                () => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'StatTile.tsx'))).toBe(false); });
  it('StatTile.test.tsx does not exist',           () => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'StatTile.test.tsx'))).toBe(false); });
  it('SprintHealthSection.tsx does not exist',     () => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'SprintHealthSection.tsx'))).toBe(false); });
  it('SprintHealthSection.test.tsx does not exist',() => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'SprintHealthSection.test.tsx'))).toBe(false); });
  it('WeeklyTrendChart.tsx does not exist',        () => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'WeeklyTrendChart.tsx'))).toBe(false); });
  it('WeeklyTrendChart.test.tsx does not exist',   () => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'WeeklyTrendChart.test.tsx'))).toBe(false); });
  it('ActivityStrip.tsx does not exist',           () => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'ActivityStrip.tsx'))).toBe(false); });
  it('ActivityStrip.test.tsx does not exist',      () => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'ActivityStrip.test.tsx'))).toBe(false); });
  it('DashboardReleaseCard.tsx does not exist',    () => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'DashboardReleaseCard.tsx'))).toBe(false); });
  it('DashboardReleaseCard.test.tsx does not exist',() => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'DashboardReleaseCard.test.tsx'))).toBe(false); });
  it('VelocityChart.tsx does not exist',           () => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'VelocityChart.tsx'))).toBe(false); });
  it('BurndownChart.tsx does not exist',           () => { expect(fs.existsSync(path.join(DASHBOARD_DIR, 'BurndownChart.tsx'))).toBe(false); });

  // Source-string check — strip comments then assert absences (widget-removal.guard.test.ts lines 35–44):
  it('index.tsx does not import old Phase 83–85 widgets', () => {
    const indexSrc = fs.readFileSync(path.join(DASHBOARD_DIR, 'index.tsx'), 'utf8');
    const nonCommentLines = indexSrc
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
      .join('\n');
    expect(nonCommentLines).not.toMatch(/StatTile/);
    expect(nonCommentLines).not.toMatch(/SprintHealthSection/);
    expect(nonCommentLines).not.toMatch(/WeeklyTrendChart/);
    expect(nonCommentLines).not.toMatch(/ActivityStrip/);
    expect(nonCommentLines).not.toMatch(/DashboardReleaseCard/);
    expect(nonCommentLines).not.toMatch(/VelocityChart/);
    expect(nonCommentLines).not.toMatch(/BurndownChart/);
  });
});
```

Note on `ActivityStrip.test.tsx`: the RESEARCH.md removal map states `ActivityStrip.tsx` has no dedicated test file, but the filesystem shows `ActivityStrip.test.tsx` does exist (found at `taskflow/src/routes/dashboard/ActivityStrip.test.tsx`). Include the absence assertion for it.

---

## Shared Patterns

### D-16 Props-Only Pattern
**Source:** `taskflow/src/routes/dashboard/SprintHealthSection.tsx` (comment on line 18) and `DashboardReleaseCard.tsx` (comment on lines 7–9)
**Apply to:** `MyIssuesCard`, `UpcomingReleasesTimeline`, `HoursCommitsChart`

All three new card components receive auth values as props from `index.tsx`. No `useAuthStore` or `readSecret` inside the card components. `index.tsx` owns the single PAT load via `useEffect` + `readSecret`.

### `useDelayedLoading` 200ms Skeleton Gate
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` line 95; `DashboardReleaseCard.tsx` line 52
**Apply to:** All three new card components

```tsx
const showSkeleton = useDelayedLoading(isLoading);
```

Never use raw `isLoading` directly to toggle skeleton — always gate through `useDelayedLoading` to prevent a 200ms flash on warm-cache reads.

### Per-Section Independent Degradation (DASH-07)
**Source:** `taskflow/src/routes/dashboard/ActivityStrip.tsx` lines 213–295
**Apply to:** All three new card components

Each card owns `error` / `showSkeleton` / `isEmpty` — one card's failure never blanks another. Pattern: `{showSkeleton && ...} {!showSkeleton && error && ...} {!showSkeleton && !error && isEmpty && ...} {!showSkeleton && !error && !isEmpty && ...}`.

### `'use no memo'` Directive
**Source:** Every existing dashboard widget (index.tsx line 1, WeeklyTrendChart.tsx line 1, ActivityStrip.tsx line 1)
**Apply to:** All new `.tsx` files in `src/routes/dashboard/`

First line of every new component file must be `'use no memo';`.

### Local-Calendar Date (`en-CA`)
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` lines 49–56; `dashboardMetrics.ts` lines 159–163
**Apply to:** `HoursCommitsChart.tsx`, `index.tsx` (sprint subline)

Always `new Date().toLocaleDateString('en-CA')` for YYYY-MM-DD local-calendar dates. Never `toISOString().slice(0, 10)` for local dates (UTC-shift trap — except in `getReleaseTimingLabel` where it IS safe because releaseDate is already a calendar-local YYYY-MM-DD string and UTC today compares consistently).

### Token Never in `queryKey`
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` line 89 comment; `ActivityStrip.tsx` line 97 comment
**Apply to:** All `useQuery` / `useQueries` calls in all new components

PAT tokens live in `queryFn` closure only. If a token is a prop, it is accessed inside `queryFn`, never added to `queryKey`.

### `isAnimationActive={false}` on All Chart Bars
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` line 165; `SprintHealthSection.tsx` line 173
**Apply to:** `HoursCommitsChart.tsx` — both `<Bar>` elements

Required by Phase 81 D-06: animation causes test flakiness and WebKit rendering issues in Tauri.

### `ChartContainer` + `responsive` on Chart Element
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` lines 144–147
**Apply to:** `HoursCommitsChart.tsx`

```tsx
// `responsive` prop goes on the Recharts chart element, NOT on a <ResponsiveContainer> wrapper
<ChartContainer config={chartConfig} className="h-full w-full">
  <ComposedChart data={...} responsive ...>
```

### ErrorState + EmptyState Imports
**Source:** `taskflow/src/routes/dashboard/ActivityStrip.tsx` lines 26–27
**Apply to:** All three new card components

```tsx
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
```

---

## No Analog Found

| File section | Reason |
|-------------|--------|
| `HoursCommitsChart` — dual-axis `ComposedChart` with two `yAxisId` | No dual-axis chart exists in the repo. Executor should follow the RESEARCH.md Recharts pitfall table and verify `responsive` prop on `<ComposedChart>` (Assumption A1). |
| `HoursCommitsChart` — today-pill X-axis via `foreignObject` | No custom `tick` renderer exists in the repo. Tauri WebKit `foreignObject` support is Assumption A2 — executor should test and fall back to SVG `<text>` + `<rect>` if needed. |
| `buildRolling7Buckets` helper | Rolling-7 window is new; `buildWeekBuckets` (Mon–Fri fixed) is the closest analog to copy structure from. |
| `index.tsx` sprint-day subline calc | No `differenceInCalendarDays` utility in the repo — use inline `Date.UTC` arithmetic copied from `dashboardMetrics.ts` `addDays` pattern (lines 159–163). |

---

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/`, `taskflow/src/components/`
**Files read:** `index.tsx`, `DashboardReleaseCard.tsx`, `WeeklyTrendChart.tsx`, `ActivityStrip.tsx`, `SprintHealthSection.tsx`, `dashboardMetrics.ts` (lines 1–197), `chart-wrapper.tsx`, `widget-removal.guard.test.ts`, `index.test.tsx`, `SprintHealthSection.test.tsx`, `DashboardReleaseCard.test.tsx`
**Pattern extraction date:** 2026-06-15
