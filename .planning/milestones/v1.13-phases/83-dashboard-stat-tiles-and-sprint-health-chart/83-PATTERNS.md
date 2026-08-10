# Phase 83: Dashboard Stat Tiles and Sprint Health Chart - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 6 (4 new, 1 modified, 1 deleted)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/routes/dashboard/dashboardMetrics.ts` | utility (pure functions) | transform | `src/lib/my-tasks-sort.ts` | role-match (pure transform module) |
| `src/routes/dashboard/dashboardMetrics.test.ts` | test | transform | `src/lib/my-tasks-sort.test.ts` | exact (pure fn unit test structure) |
| `src/routes/dashboard/StatTile.tsx` | component | request-response (warm-cache read) | `src/routes/dashboard/DashboardSprintCard.tsx` | role-match (dashboard card component) |
| `src/routes/dashboard/SprintHealthSection.tsx` | component | request-response (warm-cache read + chart) | `src/routes/dashboard/DashboardSprintCard.tsx` + `src/routes/dashboard/SmokeTestChart.tsx` | exact (combines card + ChartWrapper patterns) |
| `src/routes/dashboard/index.tsx` (MODIFIED) | route/page | request-response | itself (`index.tsx`) — structural surgery only | self-analog |
| `src/routes/dashboard/SmokeTestChart.tsx` (DELETE) | — | — | — | — |

---

## Pattern Assignments

### `src/routes/dashboard/dashboardMetrics.ts` (utility, transform)

**Analog:** `src/routes/dashboard/DashboardSprintCard.tsx` (source of all logic to extract)

**Imports pattern** — copy from DashboardSprintCard lines 17-18, strip React/hooks, add only JiraIssue type:
```typescript
import type { JiraIssue } from '@/services/jira';
```
No React imports — this module is pure TypeScript with zero React/hooks dependencies. That is what makes it unit-testable.

**Core patterns lifted verbatim from DashboardSprintCard.tsx:**

`getDaysRemaining` (lines 29-34 — lift verbatim):
```typescript
export function getDaysRemaining(endDateIso: string | undefined): number | null {
  if (!endDateIso) return null;
  const ms = new Date(endDateIso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
```

`filterNonSubtasks` (derived from DashboardSprintCard.tsx line 76):
```typescript
export function filterNonSubtasks(issues: JiraIssue[]): JiraIssue[] {
  return issues.filter((i) => !i.fields.issuetype.subtask);
}
```

`computeSpDone` (derived from DashboardSprintCard.tsx lines 78-83):
```typescript
export function computeSpDone(issues: JiraIssue[], spKey: string): number {
  return filterNonSubtasks(issues)
    .filter((i) => i.fields.status.statusCategory?.key === 'done')
    .reduce((sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0), 0);
}
```

`computeSpTotal` (derived from DashboardSprintCard.tsx lines 85-88):
```typescript
export function computeSpTotal(issues: JiraIssue[], spKey: string): number {
  return filterNonSubtasks(issues)
    .reduce((sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0), 0);
}
```

`computePersonalTileCounts` (derived from DashboardInProgressCard.tsx lines 62-67 + RESEARCH.md Q6):
```typescript
export function computePersonalTileCounts(
  issues: JiraIssue[],
  displayName: string,
  today: string, // YYYY-MM-DD — caller passes new Date().toISOString().slice(0, 10)
): { open: number; inProgress: number; overdue: number } {
  const mine = filterNonSubtasks(issues).filter(
    (i) => i.fields.assignee?.displayName === displayName,
  );
  const open = mine.filter((i) => i.fields.status.statusCategory?.key !== 'done').length;
  const inProgress = mine.filter(
    (i) => i.fields.status.statusCategory?.key === 'indeterminate',
  ).length;
  const overdue = mine.filter((i) => {
    const duedate = i.fields.duedate as string | null | undefined;
    return !!duedate && duedate < today && i.fields.status.statusCategory?.key !== 'done';
  }).length;
  return { open, inProgress, overdue };
}
```

`computeDonutData` (derived from RESEARCH.md Q5 pattern):
```typescript
export interface DonutSegment {
  name: string;
  value: number;
  fill: string;
}

export function computeDonutData(issues: JiraIssue[], spKey: string): DonutSegment[] {
  const nonSubtasks = filterNonSubtasks(issues);
  const spByCategory = { new: 0, indeterminate: 0, done: 0 };
  for (const issue of nonSubtasks) {
    const cat = issue.fields.status.statusCategory?.key ?? 'new';
    const sp = (issue.fields[spKey] as number | null | undefined) ?? 0;
    if (cat in spByCategory) spByCategory[cat as keyof typeof spByCategory] += sp;
    else spByCategory.new += sp;
  }
  return [
    { name: 'todo', value: spByCategory.new, fill: 'var(--chart-1)' },
    { name: 'inProgress', value: spByCategory.indeterminate, fill: 'var(--chart-2)' },
    { name: 'done', value: spByCategory.done, fill: 'var(--chart-3)' },
  ].filter((d) => d.value > 0); // Recharts PieChart renders incorrectly with 0-value slices
}
```

Division-by-zero guard for %-progress (DashboardSprintCard.tsx line 91):
```typescript
// Division-by-zero guard (D-06, T-60-03) — copy this comment verbatim
const donePct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
```

---

### `src/routes/dashboard/dashboardMetrics.test.ts` (test, transform)

**Analog:** `src/lib/my-tasks-sort.test.ts` (pure function unit test with `makeIssue` factory pattern)

**Imports pattern** (my-tasks-sort.test.ts lines 1-11):
```typescript
import { describe, expect, it } from 'vitest';
import { computeSpDone, computeSpTotal, computePersonalTileCounts, computeDonutData, getDaysRemaining } from './dashboardMetrics';
import type { JiraIssue } from '@/services/jira';
```

**`makeIssue` factory pattern** (my-tasks-sort.test.ts lines 17-47 — adapt for Phase 83 fields):
```typescript
function makeIssue(overrides: {
  subtask: boolean;
  sp: number;
  statusCategory: 'new' | 'indeterminate' | 'done';
  assignee?: string | null;
  duedate?: string | null;
}): JiraIssue {
  return {
    id: '1',
    key: 'TEST-1',
    fields: {
      summary: 'test',
      status: {
        id: '1',
        name: 'Done',
        statusCategory: { key: overrides.statusCategory },
      },
      assignee: overrides.assignee ? { displayName: overrides.assignee } : null,
      issuetype: { name: overrides.subtask ? 'Sub-task' : 'Story', subtask: overrides.subtask },
      duedate: overrides.duedate ?? null,
      customfield_10016: overrides.sp,
    },
  } as unknown as JiraIssue;
}
```

**Critical mandated test** (RESEARCH.md validation section — exact fixture from criterion 2):
```typescript
describe('dashboardMetrics — subtask exclusion (DASH-02, criterion 2)', () => {
  it('excludes subtask SPs from SP Done total', () => {
    const parent = makeIssue({ subtask: false, sp: 5, statusCategory: 'done' });
    const sub1 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done' });
    const sub2 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done' });
    expect(computeSpDone([parent, sub1, sub2], 'customfield_10016')).toBe(5); // not 9
  });
});
```

**Test suite structure** (my-tasks-sort.test.ts pattern — one `describe` block per exported function):
```typescript
describe('getDaysRemaining', () => { ... });
describe('computeSpDone', () => { ... });
describe('computeSpTotal', () => { ... });
describe('computePersonalTileCounts', () => { ... });
describe('computeDonutData', () => { ... });
```

No `beforeEach`/`afterEach` or mocks needed — pure functions with no side effects.

---

### `src/routes/dashboard/StatTile.tsx` (component, request-response)

**Analog:** `src/routes/dashboard/DashboardSprintCard.tsx` (card surface, header pattern, skeleton pattern)

**Imports pattern** (DashboardSprintCard.tsx lines 13-18 — simplify for display-only component):
```typescript
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
```
No `useQuery`, no `useDelayedLoading` — `StatTile` is a pure display component; loading/error state is managed by the parent (`index.tsx`).

**Props interface** (UI-SPEC component inventory):
```typescript
interface StatTileProps {
  label: string;
  value: number;
  icon: LucideIcon;
  iconClass?: string;
  valueClass?: string;
}
```

**Card surface pattern** (DashboardSprintCard.tsx line 96):
```typescript
<div
  role="region"
  aria-label={`${label}`}
  className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[80px]"
>
```
**CRITICAL:** Do NOT use `role="button"`, `cursor-pointer`, or `hover:bg-*` — tiles are static (D-06/UI-SPEC interaction contract).

**Header pattern** (DashboardSprintCard.tsx lines 98-101):
```typescript
<div className="flex items-center gap-2">
  <Icon className={cn('size-4', iconClass)} aria-hidden />
  <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
</div>
```

**Value display pattern** (UI-SPEC typography: tile value = text-3xl font-semibold):
```typescript
<p
  className={cn('text-3xl font-semibold text-primary', valueClass)}
  aria-label={`${value} ${label}`}
>
  {value}
</p>
```

**Skeleton pattern** (DashboardSprintCard.tsx lines 103-110 — the 3-block animate-pulse pattern):
```typescript
// Note: StatTile's parent (index.tsx) controls skeleton visibility via showSkeleton prop
// When rendering skeleton, replace the tile grid with 4 skeleton tiles:
{showSkeleton && (
  <div className="flex flex-col gap-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-4 rounded bg-muted animate-pulse" />
    ))}
  </div>
)}
```

---

### `src/routes/dashboard/SprintHealthSection.tsx` (component, request-response + chart)

**Analog:** `src/routes/dashboard/DashboardSprintCard.tsx` (query pattern, progress bar, skeleton) + `src/routes/dashboard/SmokeTestChart.tsx` (ChartWrapper + ChartContainer integration)

**Imports pattern** (combine DashboardSprintCard.tsx lines 13-18 + SmokeTestChart.tsx lines 2-5):
```typescript
import { useQuery } from '@tanstack/react-query';
import { Pie, PieChart } from 'recharts';
import { ChartWrapper } from '@/components/chart-wrapper';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { JiraActiveSprint, JiraIssue } from '@/services/jira';
import { fetchActiveSprint, fetchSprintIssues } from '@/services/jira';
import {
  computeDonutData,
  computeSpDone,
  computeSpTotal,
  getDaysRemaining,
} from './dashboardMetrics';
```

**Props interface** (receives resolved auth values as props — DashboardSprintCard.tsx props pattern lines 20-27):
```typescript
interface SprintHealthSectionProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
  storyPointsFieldKey: string;
  boardId: number | null;
}
```

**Sprint-board cache key** — MUST match exactly (DashboardInProgressCard.tsx line 47 comment):
```typescript
// CACHE KEY MUST MATCH DashboardSprintCard / SprintBoardTab exactly
const { data: sprintIssuesRaw, isLoading: issuesLoading, error, refetch } = useQuery({
  queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
  queryFn: () =>
    fetchSprintIssues(jiraBaseUrl, jiraToken, activeJiraProject, false, storyPointsFieldKey),
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
});
```

**Active-sprint cache read** (RESEARCH.md Pattern 2 — Option A: enabled:true with staleTime; same behavior as today's DashboardSprintCard):
```typescript
const { data: activeSprint, isLoading: sprintLoading } = useQuery({
  queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId],
  queryFn: () =>
    fetchActiveSprint(jiraBaseUrl ?? '', jiraToken ?? '', activeJiraProject ?? '', boardId ?? undefined),
  staleTime: 5 * 60_000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
});
```
**Note:** If Sidebar.tsx is extended to prefetch active-sprint for `/dashboard` (Option B), change `enabled` to `false`. Either way, `queryFn` signature must be provided so TanStack Query can refetch on cache expiry.

**isLoading + skeleton** (DashboardSprintCard.tsx lines 70-71):
```typescript
const isLoading = issuesLoading || sprintLoading;
const showSkeleton = useDelayedLoading(isLoading);
```

**Normalise array** (DashboardSprintCard.tsx line 74 — both cards do this):
```typescript
const sprintIssues: JiraIssue[] = Array.isArray(sprintIssuesRaw) ? sprintIssuesRaw : [];
```

**ChartWrapper + PieChart donut** (SmokeTestChart.tsx lines 15-35 adapted for PieChart):
```typescript
const donutConfig = {
  todo: { label: 'To Do', color: 'var(--chart-1)' },
  inProgress: { label: 'In Progress', color: 'var(--chart-2)' },
  done: { label: 'Done', color: 'var(--chart-3)' },
} satisfies ChartConfig;

// ...inside render:
<ChartWrapper
  title="Sprint Health"
  description="Story points by status category"
  height={200}
  isLoading={showSkeleton}
  error={error}
  isEmpty={totalSP === 0}
  onRetry={refetch}
>
  <div className="relative">
    <ChartContainer config={donutConfig} className="h-full w-full">
      <PieChart responsive>
        <Pie
          data={donutData}
          dataKey="value"
          nameKey="name"
          innerRadius="60%"
          outerRadius="80%"
          isAnimationActive={false}
        />
      </PieChart>
    </ChartContainer>
    {/* Donut center label — absolute overlay (RESEARCH.md Pattern 4) */}
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <p className="text-2xl font-semibold">{totalSP}</p>
      <p className="text-xs text-muted-foreground">pts</p>
    </div>
  </div>
</ChartWrapper>
```

**Progress bar** (DashboardSprintCard.tsx lines 131-137 — exact pattern for the progress + caption):
```typescript
<Progress value={donePct} />
<p className="text-xs text-muted-foreground">
  {donePct}% complete
  {totalPoints > 0 && ` · ${donePoints} / ${totalPoints} pts`}
</p>
```

**Days remaining display** (DashboardSprintCard.tsx lines 124-128):
```typescript
{daysLeft === 0 && <span className="text-xs text-muted-foreground">Sprint ends today</span>}
{daysLeft !== null && daysLeft > 0 && (
  <span className="text-xs text-muted-foreground">
    {daysLeft} {daysLeft === 1 ? 'day' : 'days'} remaining
  </span>
)}
```

**Empty state** (DashboardSprintCard.tsx line 114 — no active sprint):
```typescript
{!showSkeleton && !activeSprint && (
  <EmptyState
    icon={Activity}
    title="No active sprint"
    subtitle="Start a sprint in Jira to see health metrics here."
  />
)}
```

**Section card container** (DashboardSprintCard.tsx line 96 extended with p-6):
```typescript
<div role="region" aria-label="Sprint health" className="rounded-lg border border-border bg-card p-6 flex flex-col gap-4">
```

---

### `src/routes/dashboard/index.tsx` (MODIFIED — structural surgery)

**Analog:** itself — retain the hero `<section>` (lines 74-101), rewrite below it.

**Lines to retain unchanged** (index.tsx lines 1-101 minus the 3 deleted card imports):

Keep all of:
- `AMBIENT_CURVES` constant (lines 19-29)
- `getTimeGreeting()` helper (lines 12-17)
- `useAuthStore`, `useSettingsStore`, `readSecret`, `useEffect`, `useState` imports (lines 1-6)
- `useOutletContext` import (line 2)
- `useBoardId` hook (line 3 + line 51)
- `jiraToken` load via `readSecret` effect (lines 40-47)
- `today` en-GB date formatting (lines 53-58)
- `firstName` display-name parse logic (lines 66-69)
- The entire hero `<section>` (lines 74-101)

**Lines to REMOVE** (index.tsx):
- Line 7: `import DashboardInProgressCard from './DashboardInProgressCard';`
- Line 8: `import DashboardReleaseCard from './DashboardReleaseCard';`
- Line 9: `import DashboardSprintCard from './DashboardSprintCard';`
- Line 10: `import { SmokeTestChart } from './SmokeTestChart';`
- Lines 103-105: `<div className="relative px-6 pb-2"><SmokeTestChart /></div>`
- Lines 107-130: The 3-card grid `<div className="relative grid...">...</div>`

**New imports to ADD** (place after retained imports, before component):
```typescript
import StatTile from './StatTile';
import SprintHealthSection from './SprintHealthSection';
import DashboardReleaseCard from './DashboardReleaseCard'; // retained for countdown
import { computePersonalTileCounts, computeSpDone, filterNonSubtasks } from './dashboardMetrics';
import { useQuery } from '@tanstack/react-query';
import { fetchSprintIssues } from '@/services/jira';
import { Activity, CheckCircle2, Clock, Zap } from 'lucide-react';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
```

**Stat tiles row pattern** (replace the 3-card grid — UI-SPEC grid spec):
```typescript
{/* Stat tiles — 4-tile grid replacing 3-card grid (DASH-02) */}
<div className="relative px-6 pb-6">
  {showTileSkeleton && (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4 min-h-[80px] flex flex-col gap-3">
          <div className="h-3 rounded bg-muted animate-pulse w-1/2" />
          <div className="h-7 rounded bg-muted animate-pulse w-1/3" />
        </div>
      ))}
    </div>
  )}
  {!showTileSkeleton && tileError && (
    <ErrorState error={tileError} onRetry={refetchTiles} viewName="stat tiles" />
  )}
  {!showTileSkeleton && !tileError && (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatTile label="Open" value={tileCounts.open} icon={Activity} iconClass="text-sky-500" />
      <StatTile label="In Progress" value={tileCounts.inProgress} icon={Zap} iconClass="text-amber-500" />
      <StatTile label="Overdue" value={tileCounts.overdue} icon={Clock} iconClass="text-destructive"
        valueClass={tileCounts.overdue > 0 ? 'text-destructive' : undefined} />
      <StatTile label="SP Done" value={spDone} icon={CheckCircle2} iconClass="text-green-500" />
    </div>
  )}
</div>
```

**New sections layout** (replacing lines 103-130 in index.tsx):
```typescript
{/* stat-tiles row — DASH-02 */}
<div className="relative px-6 pb-6">{/* ...tile grid... */}</div>

{/* sprint health — DASH-03 */}
<div className="relative px-6 pb-6">
  <SprintHealthSection
    jiraBaseUrl={jiraBaseUrl ?? ''}
    jiraToken={jiraToken ?? ''}
    activeJiraProject={activeJiraProject ?? ''}
    storyPointsFieldKey={storyPointsFieldKey}
    boardId={boardId}
  />
</div>

{/* release countdown — retained from DASH-01 */}
<div className="relative px-6 pb-6">
  <DashboardReleaseCard
    jiraBaseUrl={jiraBaseUrl ?? ''}
    jiraToken={jiraToken ?? ''}
    activeJiraProject={activeJiraProject ?? ''}
  />
</div>
```

---

### `src/routes/dashboard/SmokeTestChart.tsx` (DELETE)

No pattern needed — this file is deleted outright. The `widget-removal.guard.test.ts` file should be extended to add:
```typescript
it('SmokeTestChart.tsx does not exist', () => {
  expect(fs.existsSync(path.join(DASHBOARD_DIR, 'SmokeTestChart.tsx'))).toBe(false);
});
```
Pattern for this assertion: `widget-removal.guard.test.ts` lines 22-41 — `fs.existsSync(path.join(DASHBOARD_DIR, 'filename'))` assertion with `toBe(false)`.

---

## Shared Patterns

### Cache Key — MUST match across all consumers
**Source:** `src/routes/dashboard/DashboardInProgressCard.tsx` line 47 comment + lines 48-54
**Apply to:** `SprintHealthSection.tsx`, `index.tsx` (if it reads sprint-board directly)
```typescript
// CACHE KEY MUST MATCH DashboardSprintCard / SprintBoardTab exactly
queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
queryFn: () =>
  fetchSprintIssues(jiraBaseUrl, jiraToken, activeJiraProject, false, storyPointsFieldKey),
staleTime: 30_000,
enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
```

### Props-only Auth Pattern
**Source:** `src/routes/dashboard/DashboardSprintCard.tsx` lines 20-27 + JSDoc at lines 10-11
**Apply to:** `StatTile.tsx` (receives counts as props), `SprintHealthSection.tsx` (receives auth as props)
```typescript
// Props only — no readSecret, no useAuthStore (D-16)
// Auth values are loaded once in index.tsx and passed down as props.
```

### Skeleton Flash Prevention
**Source:** `src/routes/dashboard/DashboardSprintCard.tsx` lines 70-71 + `src/hooks/useDelayedLoading.ts`
**Apply to:** Any component with `isLoading` state that should not flash skeletons on fast loads
```typescript
const showSkeleton = useDelayedLoading(isLoading);
```

### 3-Block Animate-Pulse Skeleton
**Source:** `src/routes/dashboard/DashboardSprintCard.tsx` lines 103-110 (identical in DashboardInProgressCard.tsx lines 118-124)
**Apply to:** Any loading state in a card-surface component
```typescript
{showSkeleton && (
  <div className="flex flex-col gap-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-4 rounded bg-muted animate-pulse" />
    ))}
  </div>
)}
```

### Array Normalise Guard
**Source:** `src/routes/dashboard/DashboardSprintCard.tsx` line 74 (repeated in DashboardInProgressCard.tsx line 59)
**Apply to:** All components that read `fetchSprintIssues` — it returns `JiraIssue[]` directly but the query `data` is initially `undefined`
```typescript
const sprintIssues: JiraIssue[] = Array.isArray(sprintIssuesRaw) ? sprintIssuesRaw : [];
```

### ChartWrapper State Delegation
**Source:** `src/components/chart-wrapper.tsx` lines 9-18 (full props interface)
**Apply to:** `SprintHealthSection.tsx` for the donut card section
```typescript
// ChartWrapper handles all three states — pass mutually-exclusive flags:
<ChartWrapper
  title="Sprint Health"
  description="Story points by status category"
  height={200}           // explicit height = WebKit 0×0 guard (Phase 81 D-05)
  isLoading={showSkeleton}
  error={error}
  isEmpty={totalSP === 0}
  onRetry={refetch}
>
  {/* children only rendered when not loading/error/empty */}
</ChartWrapper>
```

### Overdue Date — Timezone-Safe ISO String Comparison
**Source:** `src/routes/dashboard/DashboardReleaseCard.tsx` line 31 + `src/lib/my-tasks-sort.ts` line 54
**Apply to:** `dashboardMetrics.ts` `computePersonalTileCounts` overdue filter
```typescript
const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" — timezone-safe
// Then compare: duedate < today (string comparison is safe for ISO dates)
```

### SP Field Key — Never Hard-Code
**Source:** `src/routes/dashboard/DashboardSprintCard.tsx` lines 80-82 (RESEARCH.md Pitfall 3)
**Apply to:** All SP-summing code in `dashboardMetrics.ts` and `SprintHealthSection.tsx`
```typescript
// Always use storyPointsFieldKey from useSettingsStore() — never 'customfield_10016'
const sp = (issue.fields[storyPointsFieldKey] as number | null | undefined) ?? 0;
```

### SmokeTestChart — ChartWrapper + ChartContainer Integration
**Source:** `src/routes/dashboard/SmokeTestChart.tsx` lines 15-36 (donut variant replaces BarChart)
**Apply to:** `SprintHealthSection.tsx` donut rendering
```typescript
// Pattern confirmed working in jsdom (chart-wrapper.test.tsx line 76):
// expect(document.querySelector('[data-slot="chart"]')).toBeTruthy();
// expect(document.querySelector('.recharts-surface')).toBeTruthy();
<ChartContainer config={donutConfig} className="h-full w-full">
  <PieChart responsive>
    <Pie data={donutData} dataKey="value" nameKey="name"
         innerRadius="60%" outerRadius="80%" isAnimationActive={false} />
  </PieChart>
</ChartContainer>
```

---

## No Analog Found

All files have close analogs. No files require falling back to RESEARCH.md patterns exclusively — RESEARCH.md patterns are all grounded in the codebase analogs read above.

---

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/`, `taskflow/src/components/`, `taskflow/src/lib/`, `taskflow/src/hooks/`, `taskflow/src/stores/`
**Files read:** 13 (DashboardSprintCard, DashboardInProgressCard, DashboardReleaseCard, index.tsx, SmokeTestChart, chart-wrapper.tsx, chart-wrapper.test.tsx, progress.tsx, error-state.tsx, empty-state.tsx, widget-removal.guard.test.ts, my-tasks-sort.test.ts, useDelayedLoading.test.ts)
**Pattern extraction date:** 2026-06-15
