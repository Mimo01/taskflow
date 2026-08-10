# Phase 83: Dashboard Stat Tiles and Sprint Health Chart - Research

**Researched:** 2026-06-15
**Domain:** React + TanStack Query warm-cache derivation, Recharts v3 PieChart donut, shadcn chart primitive
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Remove `DashboardSprintCard`, `DashboardInProgressCard`, `DashboardReleaseCard` (as standalone card) and `SmokeTestChart`. Retain gradient hero greeting + en-GB date. Retain next-release countdown logic from `DashboardReleaseCard` — rehoused in the new layout.
- **D-02:** Four tiles: Open, In Progress, Overdue, SP Done. First three are personal (current user's assigned issues in active sprint); SP Done is whole-sprint velocity (all done story points, not just mine).
- **D-03:** Tile definitions over warm sprint-board cache:
  - Open = my assigned issues with `status.statusCategory.key !== 'done'`
  - In Progress = my assigned issues with `status.statusCategory.key === 'indeterminate'`
  - Overdue = my assigned issues with `duedate` earlier than today AND not done
  - SP Done = sum of story points of done non-subtask issues across the whole sprint
- **D-04:** SP sums exclude subtasks everywhere. Unit test: parent(5 SP) + 2 subtasks(2 SP each) asserts total = 5, not 9.
- **D-05:** Current-user matching = `assignee.displayName === jiraUserDisplayName` from auth store. Do not introduce accountId plumbing this phase.
- **D-06:** Tiles are static display only — no drill-down, no click handlers.
- **D-07:** Donut chart segmented by `statusCategory` (3 segments: To Do / In Progress / Done). Colors from semantic `--chart-N` CSS-var aliases. Built via `ChartWrapper` + shadcn `chart` primitive.
- **D-08:** Donut segments are points-weighted (story points per category, subtasks excluded). Donut center: total sprint SP (exact content is Claude's discretion).
- **D-09:** Sprint health section = sprint days remaining + overall %-complete progress bar (done SP / total SP, div-by-zero guarded) + points-by-status donut. Reuse `getDaysRemaining` logic and %-progress logic from `DashboardSprintCard`.
- **D-10:** All tile + chart figures derive from the warm `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` cache. Zero new network requests on Dashboard load. Open item: sprint days-remaining needs `endDate` from `fetchActiveSprint` query key `['jira-active-sprint',activeJiraProject,jiraBaseUrl,boardId]` — planner must confirm this is warm or find another source. (See Critical Open Question 1 resolution below.)
- **D-11:** Every section has its own `Skeleton`/`ErrorState`/`EmptyState` and degrades independently.

### Claude's Discretion

- Tile layout/grid and visual treatment.
- Exact donut center content (total SP vs nothing).
- Progress-bar styling and placement within sprint-health section.
- Exact placement of retained next-release countdown.
- Component decomposition (new `StatTile` + `SprintHealthSection` vs inline).

### Deferred Ideas (OUT OF SCOPE)

- Stat-tile drill-down (requires Phase 82 My Tasks filter wiring, Overdue bucket, URL param).
- Per-status donut granularity (one segment per workflow status).
- MRs-awaiting-review tile and hours-logged tile (Phase 84, DASH-04/06).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Dashboard keeps gradient hero + en-GB date; removes previous 3 cards | D-01 locked; hero section at `index.tsx` lines 74–101 is retained unchanged; 3-card grid lines 107–130 and SmokeTestChart lines 103–105 are removed |
| DASH-02 | Personal stat tiles: Open, In Progress, Overdue, SP Done | D-02/D-03/D-04/D-05 locked; all derivable from warm sprint-board cache; `duedate` confirmed in `fetchSprintIssues` fields= string |
| DASH-03 | Sprint health: progress, days remaining, points-by-status chart | D-07/D-08/D-09 locked; `getDaysRemaining` lifted from `DashboardSprintCard`; active-sprint `endDate` requires warm `['jira-active-sprint',...]` cache (see Critical Q1) |
| DASH-07 | Each section degrades independently | D-11 locked; `ChartWrapper` handles chart section; stat-tiles row needs its own skeleton guard |
</phase_requirements>

---

## Summary

Phase 83 is a frontend refactor — no new API calls, no new services. The work is entirely about deriving four stat metrics and one sprint-health section from two already-warm TanStack Query caches, then rendering them with existing primitives (`ChartWrapper`, `Progress`, `Skeleton`, `ErrorState`, `EmptyState`).

The sprint-board cache key `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` is the primary source. This cache contains `JiraIssue[]` with `fields.status.statusCategory.key`, `fields.assignee.displayName`, `fields.issuetype.subtask`, `fields[storyPointsFieldKey]`, and `fields.duedate` (via index signature, cast as `string | null | undefined`). All four tiles and the donut are fully derivable from it.

The critical open item from D-10 — sprint days-remaining needing `endDate` — is resolved: the active-sprint query `['jira-active-sprint',activeJiraProject,jiraBaseUrl,boardId]` is prefetched by `Sidebar.tsx` for the `/dashboard` path AND mounted by `DashboardSprintCard` today. After Phase 83 removes `DashboardSprintCard`, the Sidebar prefetch still fires on hover/navigation to `/dashboard`. The planner should mount a fetch-disabled `useQuery` with the active-sprint key inside `SprintHealthSection` to consume this warm cache reactively — exactly the pattern from project memory (reactive cache-read badge: use `enabled: false` not `queryClient.getQueryData`).

The donut is a `PieChart` + `Pie` from Recharts v3 inside `ChartWrapper`. The Phase 81 rules apply: `responsive` prop on `PieChart` (not `ResponsiveContainer`), explicit 200px height outer div (WebKit guard), `isAnimationActive={false}`, `'use no memo'` already in `ChartWrapper`. Colors are `var(--chart-1)` (To Do), `var(--chart-2)` (In Progress), `var(--chart-3)` (Done) per UI-SPEC.

**Primary recommendation:** Mount one `useQuery` for sprint-board (data + loading/error) and one fetch-disabled `useQuery` for active-sprint (endDate only). Derive all metrics client-side. Render `StatTile` grid + `SprintHealthSection` with independent degradation. Lift `getDaysRemaining` and the subtask-exclusion filter from `DashboardSprintCard` into shared utility functions.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stat metric derivation (Open/InProgress/Overdue/SP Done) | Frontend client | — | Pure client-side array filter/reduce over warm cache; no server involvement |
| Sprint days remaining | Frontend client | — | `getDaysRemaining(endDate)` pure function; `endDate` from warm active-sprint cache |
| %-progress bar | Frontend client | — | `donePoints / totalPoints` already computed in `DashboardSprintCard` |
| Donut chart rendering | Frontend client (Recharts) | — | PieChart/Pie from Recharts v3 inside ChartWrapper |
| Warm cache reads | TanStack Query | — | `useQuery` with `enabled:false` for reactive reads; never `getQueryData` in render |
| Per-section state (loading/error/empty) | Frontend UI components | — | `ChartWrapper` for chart section; manual skeleton guard for stat-tiles row |
| Next-release countdown | Frontend client | — | Fix-versions cache `['jira-fix-versions',activeJiraProject]`; logic lifted from `DashboardReleaseCard` |

---

## Critical Open Questions — RESOLVED

### Q1: D-10 — Zero-new-API-calls for sprint days-remaining

**Finding (VERIFIED: codebase):** `fetchSprintIssues` (query key `['jira-issues','sprint-board',...]`) does NOT contain `endDate`. The sprint-board payload is `JiraIssue[]` from Jira's search API — it contains issue fields only, not sprint metadata. `endDate` lives exclusively in `JiraActiveSprint` returned by `fetchActiveSprint`.

**Is `['jira-active-sprint',...]` warm on Dashboard load?**

- `Sidebar.tsx` `prefetchForPath()` at line 124: the condition is `path === '/sprint-board' || path === '/dashboard'`. The `/dashboard` path triggers `getGhAllData()` (the GreenHopper all-data prefetch) but does NOT trigger the active-sprint prefetch. The active-sprint prefetch only fires for `path === '/sprint-board'` (line 145 — inside the `if (path === '/sprint-board')` block).
- `DashboardSprintCard` today mounts the active-sprint query directly — after Phase 83 removes it, that mount disappears.

**Verdict:** The `['jira-active-sprint',activeJiraProject,jiraBaseUrl,boardId]` cache is NOT reliably warm on Dashboard load in all user paths. If the user navigated directly to Dashboard without visiting Sprint Board first, this cache would be empty and a new fetch would fire — violating criterion 3.

**Recommended resolution (two options; planner must choose one):**

Option A — Mount the active-sprint query inside `SprintHealthSection` with `enabled: true` and `staleTime: 5 * 60_000`. This is one new query, but it was already being made by `DashboardSprintCard`. The net effect is zero NEW queries compared to the current Dashboard (the old card already fired it). Criterion 3 says "no new network request fires when the Dashboard loads" — if interpreted as "no net increase vs today," this is acceptable. Include this query in the section's loading/error gate.

Option B — Update `Sidebar.tsx` `prefetchForPath` to also run the active-sprint prefetch for `path === '/dashboard'`. Then `SprintHealthSection` reads it with `enabled: false` (purely reactive, zero-fetch). This genuinely satisfies "zero new API calls" because the prefetch fires before the user even navigates to Dashboard.

**Planner recommendation:** Option B is cleaner for criterion 3 and matches the project pattern. The Sidebar already does active-sprint prefetch for `/sprint-board`; copying the same block for `/dashboard` is one extra call (3 lines) to `prefetchForPath`. Then `SprintHealthSection` uses:

```typescript
// Reactive warm-cache read — never triggers a fetch (enabled: false)
const { data: activeSprint } = useQuery({
  queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId],
  queryFn: () => fetchActiveSprint(jiraBaseUrl ?? '', jiraToken ?? '', activeJiraProject ?? '', boardId ?? undefined),
  enabled: false, // reads from prefilled cache only
  staleTime: 5 * 60_000,
});
```

If Option B is impractical (e.g. Sidebar can't easily receive `boardId` for the prefetch), fall back to Option A with a clear code comment: "One query per existing `DashboardSprintCard` behavior — not net-new."

### Q2: Warm-cache read pattern — reactive vs imperative

**Finding (VERIFIED: codebase + project memory):** The project memory note `reactive_cache_read_badge` exactly describes this. `queryClient.getQueryData(key)` in render is non-reactive — if TanStack Query updates the cache via `setQueryData` or a background refetch, the component does NOT re-render. The correct pattern is `useQuery({ queryKey, queryFn, enabled: false })` — it reads from cache AND re-renders when the cache updates.

**Current dashboard cards:** `DashboardSprintCard` and `DashboardInProgressCard` both use `useQuery` with `enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject` (i.e., `enabled: true`). They allow the query to fetch — they are NOT using `enabled: false`. So there is no existing example of an `enabled: false` read in the dashboard today.

**Phase 83 pattern:** For the sprint-board data (the primary source), use `enabled: true` with the same `staleTime: 30_000` as today's cards — this is fine because TanStack Query deduplicates the query. For the active-sprint `endDate` (if using Option B above), use `enabled: false`.

### Q3: SP-sum subtask exclusion — exact filter expression

**Finding (VERIFIED: codebase, `DashboardSprintCard.tsx` line 76):**

```typescript
const stories = sprintIssues.filter((i) => !i.fields.issuetype.subtask);
```

The field is `i.fields.issuetype.subtask` (boolean), NOT a name comparison. The JiraIssue type comment at line 166 explicitly says: "Use this — NOT name comparison. Admins can rename issue types."

**SP field access pattern (VERIFIED: codebase, `DashboardSprintCard.tsx` lines 78–88):**

```typescript
const donePoints = stories
  .filter((i) => i.fields.status.statusCategory?.key === 'done')
  .reduce(
    (sum, i) => sum + ((i.fields[storyPointsFieldKey] as number | null | undefined) ?? 0),
    0,
  );
```

`storyPointsFieldKey` comes from `useSettingsStore()` — it's the dynamically discovered story-points custom field ID (usually `customfield_10016` or `customfield_10028`, discovered at app startup via `fetchCustomFields`). It is stored in `settingsStore.storyPointsFieldKey` and passed to `fetchSprintIssues` and the query key.

**Unit test target:** A pure function that takes `(issues: JiraIssue[], storyPointsFieldKey: string)` and returns SP totals should be placed in `src/routes/dashboard/dashboardMetrics.ts` (or similar pure-logic module). The mandated test:

```typescript
it('excludes subtask SPs from total', () => {
  const parent = makeIssue({ subtask: false, sp: 5, statusCategory: 'done' });
  const sub1 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done' });
  const sub2 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done' });
  expect(computeSpDone([parent, sub1, sub2], 'customfield_10016')).toBe(5);
});
```

### Q4: Donut via ChartWrapper + Recharts v3

**Finding (VERIFIED: codebase, `chart-wrapper.tsx`, `SmokeTestChart.tsx`, `chart-wrapper.test.tsx`):**

`ChartWrapper` props (exact interface):
```typescript
interface ChartWrapperProps {
  title: string;
  description?: string;
  height?: number;         // default 240; set to 200 for donut per UI-SPEC
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  children: ReactNode;
}
```

`ChartWrapper` already has `'use no memo'` at line 1. It renders an explicit-height div: `<div style={{ height }} className="w-full">`. The `height` default is 240; the UI-SPEC mandates 200px for the donut — pass `height={200}`.

**PieChart donut pattern (to use inside ChartWrapper):**

```typescript
// Source: chart-wrapper.test.tsx + SmokeTestChart.tsx analog; Recharts v3 pattern
import { Pie, PieChart } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

const donutConfig = {
  todo: { label: 'To Do', color: 'var(--chart-1)' },
  inProgress: { label: 'In Progress', color: 'var(--chart-2)' },
  done: { label: 'Done', color: 'var(--chart-3)' },
} satisfies ChartConfig;

// Inside the render (must NOT be in a memoized component due to 'use no memo' on ChartWrapper):
<ChartWrapper
  title="Sprint Health"
  description="Story points by status category"
  height={200}
  isLoading={isLoading}
  error={error}
  isEmpty={totalSP === 0}
  onRetry={refetch}
>
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
</ChartWrapper>
```

**Important:** `ChartContainer` uses `ResponsiveContainer` internally (line 70 of `chart.tsx`) with `initialDimension={{ width: 320, height: 200 }}`. This is NOT the Phase 81 D-02 violation — the rule is "never import or use `ResponsiveContainer` directly in our code." The shadcn `ChartContainer` wraps it internally with an `initialDimension` prop that prevents the 0×0 WebKit collapse. The Phase 81 rule about `responsive` prop applies to chart components like `BarChart`, `PieChart` — check Recharts v3 docs for the `responsive` prop on PieChart. The outer explicit-height div on `ChartWrapper` (via `style={{ height }}`) is the primary WebKit guard.

**SmokeTestChart analog confirms the pattern:** `<ChartContainer config={...} className="h-full w-full">` inside `ChartWrapper` — this is the established pattern.

### Q5: statusCategory access and values

**Finding (VERIFIED: codebase, `jira.ts` line 156):**

```typescript
statusCategory?: { key: 'new' | 'indeterminate' | 'done' };
```

The three values are:
- `'new'` — To Do / Not Started (maps to donut segment 1, `var(--chart-1)`)
- `'indeterminate'` — In Progress (maps to donut segment 2, `var(--chart-2)`)
- `'done'` — Done (maps to donut segment 3, `var(--chart-3)`)

Field path: `issue.fields.status.statusCategory?.key`

The `statusCategory` is optional (`?`) — issues without it should be treated as `'new'` (defensive null-coalesce: `?? 'new'`).

**Donut data derivation:**

```typescript
const nonSubtasks = sprintIssues.filter((i) => !i.fields.issuetype.subtask);

const spByCategory = { new: 0, indeterminate: 0, done: 0 };
for (const issue of nonSubtasks) {
  const cat = issue.fields.status.statusCategory?.key ?? 'new';
  const sp = (issue.fields[storyPointsFieldKey] as number | null | undefined) ?? 0;
  if (cat in spByCategory) spByCategory[cat as keyof typeof spByCategory] += sp;
  else spByCategory.new += sp; // fallback for unknown categories
}

const donutData = [
  { name: 'todo', value: spByCategory.new, fill: 'var(--chart-1)' },
  { name: 'inProgress', value: spByCategory.indeterminate, fill: 'var(--chart-2)' },
  { name: 'done', value: spByCategory.done, fill: 'var(--chart-3)' },
].filter((d) => d.value > 0); // Recharts PieChart renders incorrectly with 0-value slices
```

### Q6: Personal filter pattern

**Finding (VERIFIED: codebase, `DashboardInProgressCard.tsx` lines 62–67):**

```typescript
// D-08 Option B — displayName comparison; no type cast needed
const myInProgressSubtasks = sprintIssues.filter(
  (issue) =>
    issue.fields.issuetype.subtask &&
    issue.fields.status.statusCategory?.key === 'indeterminate' &&
    issue.fields.assignee?.displayName === jiraUserDisplayName,
);
```

For Phase 83 personal tiles (which filter parent issues, not subtasks):

```typescript
const myIssues = sprintIssues.filter(
  (i) =>
    !i.fields.issuetype.subtask &&
    i.fields.assignee?.displayName === jiraUserDisplayName,
);
```

**`assignee-filter.ts` suitability:** `matchesAssigneeFilter` in `assignee-filter.ts` is designed for multi-user filter dropdowns (takes a `Set<string>` of selected values, including an `UNASSIGNED_FILTER` sentinel). It is NOT suitable for the simple single-user identity match needed here. The direct `assignee?.displayName === jiraUserDisplayName` pattern from `DashboardInProgressCard` is the correct pattern to replicate. Null-assignee handling is automatic — if `assignee` is null, `?.displayName` is `undefined`, which never equals the display name string.

**Overdue tile filter** (D-03): `duedate` is in `fetchSprintIssues`' `fields=` string (confirmed: line 408 of `jira.ts`). Accessed via index signature cast: `issue.fields.duedate as string | null | undefined`. Pattern from `my-tasks-sort.ts` line 54:

```typescript
const duedate = issue.fields.duedate as string | null | undefined;
const today = new Date().toISOString().slice(0, 10); // timezone-safe YYYY-MM-DD
const isOverdue = !!duedate && duedate < today && cat !== 'done';
```

### Q7: Per-section independent degradation (D-11)

**Finding (VERIFIED: codebase, `chart-wrapper.tsx`):**

`ChartWrapper` handles the chart section's loading/empty/error states automatically via its `isLoading`/`isEmpty`/`error`/`onRetry` props. The stat-tiles row has no `ChartWrapper` — it needs a manual skeleton guard pattern (matching `DashboardSprintCard`'s `useDelayedLoading` approach).

**`useDelayedLoading` pattern (VERIFIED: used in `DashboardSprintCard.tsx` line 71):**

```typescript
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
const showSkeleton = useDelayedLoading(isLoading);
```

Stat-tiles row should apply this: when `showSkeleton`, render 4 skeleton tiles; otherwise render the real tiles. If `error`, render `ErrorState`. If `!activeSprint && !isLoading`, render `EmptyState` with "No active sprint" copy.

**Existing shared primitives (VERIFIED: codebase):**
- `src/components/ui/skeleton.tsx` — `data-slot="skeleton"`
- `src/components/ui/error-state.tsx` — used by `ChartWrapper`; takes `error`, `onRetry`, `viewName`
- `src/components/ui/empty-state.tsx` — takes `icon`, `title`, `subtitle`
- `src/components/ui/progress.tsx` — Base UI `ProgressPrimitive.Root` accepting `value` (0-100); renders a track + indicator; height is `h-1.5` (6px, not 8px — note: UI-SPEC says 8px but the primitive track is `h-1.5`; executor should use the primitive as-is or override via `indicatorClassName`)

---

## Standard Stack

### Core (all already in project — zero new installs)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| recharts | ^3.8.1 | PieChart/Pie donut | Installed (Phase 81) |
| @tanstack/react-query | existing | Warm-cache reads | Installed |
| react-router-dom | existing | `useOutletContext` for onIssueClick | Installed |
| lucide-react | existing | Tile icons | Installed |

### Supporting (all in project already)

| Component | Path | Purpose |
|-----------|------|---------|
| `ChartWrapper` | `@/components/chart-wrapper` | Sprint health chart card chrome |
| `ChartContainer` | `@/components/ui/chart` | Recharts wrapper with CSS-var color injection |
| `Progress` | `@/components/ui/progress` | %-complete progress bar |
| `Skeleton` | `@/components/ui/skeleton` | Loading state placeholder |
| `ErrorState` | `@/components/ui/error-state` | Fetch error display |
| `EmptyState` | `@/components/ui/empty-state` | No active sprint display |
| `useDelayedLoading` | `@/hooks/useDelayedLoading` | Prevents skeleton flash on fast loads |

**Installation:** No new packages needed.

---

## Package Legitimacy Audit

No new packages are installed in this phase. All dependencies were installed in prior phases.

---

## Architecture Patterns

### System Architecture Diagram

```
Dashboard route (index.tsx)
  │
  ├─► [warm cache reads]
  │     ├─ useQuery(['jira-issues','sprint-board',...]) ──► JiraIssue[] (parent + subtask)
  │     └─ useQuery(['jira-active-sprint',...], enabled:false) ──► JiraActiveSprint | null
  │           (populated by Sidebar prefetch OR Option A: enabled:true)
  │
  ├─► [stat tile derivation — pure client-side]
  │     filterNonSubtasks() → myIssues → [open, inProgress, overdue counts]
  │     filterNonSubtasks() → donePoints sum (all sprint, not personal)
  │
  ├─► <hero section>           ← retained, no changes
  ├─► <StatTiles row>          ← 4 tiles, independent skeleton/empty/error
  ├─► <SprintHealthSection>    ← progress bar + donut, ChartWrapper handles state
  └─► <ReleaseCountdown>       ← DashboardReleaseCard logic, retained
```

### Recommended Project Structure

```
src/routes/dashboard/
├── index.tsx                     ← rewritten: hero retained, new layout
├── StatTile.tsx                  ← new: single tile component
├── SprintHealthSection.tsx       ← new: progress bar + donut
├── dashboardMetrics.ts           ← new: pure derivation functions (testable)
├── SmokeTestChart.tsx            ← DELETE
├── DashboardSprintCard.tsx       ← DELETE (logic extracted to dashboardMetrics.ts)
├── DashboardInProgressCard.tsx   ← DELETE
├── DashboardReleaseCard.tsx      ← KEEP or extract logic inline — planner choice
└── [existing files unchanged]
```

### Pattern 1: Pure Metric Derivation Module

Extract all stat/donut computations into `src/routes/dashboard/dashboardMetrics.ts` — pure functions with no React/hooks dependencies. This makes them trivially unit-testable.

```typescript
// Source: DashboardSprintCard.tsx lines 76-92 (adapted)
// File: src/routes/dashboard/dashboardMetrics.ts

export function filterNonSubtasks(issues: JiraIssue[]): JiraIssue[] {
  return issues.filter((i) => !i.fields.issuetype.subtask);
}

export function computeSpDone(issues: JiraIssue[], spKey: string): number {
  return filterNonSubtasks(issues)
    .filter((i) => i.fields.status.statusCategory?.key === 'done')
    .reduce((sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0), 0);
}

export function computeSpTotal(issues: JiraIssue[], spKey: string): number {
  return filterNonSubtasks(issues)
    .reduce((sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0), 0);
}

export function computeDonutData(issues: JiraIssue[], spKey: string): DonutSegment[] { ... }

export function computePersonalTileCounts(
  issues: JiraIssue[],
  displayName: string,
  today: string,  // YYYY-MM-DD
): { open: number; inProgress: number; overdue: number } { ... }

// Lifted verbatim from DashboardSprintCard.tsx line 29-34
export function getDaysRemaining(endDateIso: string | undefined): number | null {
  if (!endDateIso) return null;
  const ms = new Date(endDateIso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
```

### Pattern 2: Fetch-Disabled Reactive Cache Read

```typescript
// For active-sprint endDate (Option B — after Sidebar prefetch added for /dashboard)
const { data: activeSprint } = useQuery({
  queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId],
  queryFn: () =>
    fetchActiveSprint(jiraBaseUrl ?? '', jiraToken ?? '', activeJiraProject ?? '', boardId ?? undefined),
  enabled: false,   // never fetches — reads from prefetch-populated cache only
  staleTime: 5 * 60_000,
});
```

### Pattern 3: ChartWrapper + PieChart Donut

```typescript
// Inside SprintHealthSection — wrap donut in ChartWrapper for status states
<ChartWrapper
  title="Sprint Health"
  description="Story points by status category"
  height={200}
  isLoading={isLoading}
  error={error}
  isEmpty={totalSP === 0}
  onRetry={refetch}
>
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
</ChartWrapper>
```

Note: `PieChart` from Recharts v3 accepts `responsive` prop (same as `BarChart`). Do NOT import or use `ResponsiveContainer` directly — ChartContainer handles it internally with WebKit `initialDimension` guard.

### Pattern 4: Donut Center Label

Recharts v3 supports a center label via `<Pie label>` or via an absolute-positioned overlay div inside `ChartContainer`. The overlay approach is simpler and does not require recharts label prop wiring:

```typescript
// Overlay approach — absolute center within the 200px height container
<div className="relative">
  <ChartContainer ...>
    <PieChart responsive>...</PieChart>
  </ChartContainer>
  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
    <p className="text-2xl font-semibold">{totalSP}</p>
    <p className="text-xs text-muted-foreground">pts</p>
  </div>
</div>
```

### Anti-Patterns to Avoid

- **`queryClient.getQueryData()` in render:** Non-reactive — component won't re-render on cache updates. Use `useQuery({ enabled: false })` instead.
- **Hardcoded hex in chart segments:** Use `var(--chart-1)`, `var(--chart-2)`, `var(--chart-3)` via `ChartConfig.color` field. Never inline hex or OKLCH.
- **0-value PieChart slices:** Filter out `donutData` entries where `value === 0` — Recharts renders empty slices incorrectly.
- **`ResponsiveContainer` import:** Phase 81 D-02 — never import directly. `ChartContainer` wraps it; use `responsive` prop on `PieChart` instead.
- **Subtask SP inclusion:** Always filter `!i.fields.issuetype.subtask` before SP sums. Never use issue type name comparison.
- **`<div role="button">` on tiles:** Tiles are static (D-06). Use `<div role="region" aria-label="...">` only. No `cursor-pointer`, no `hover:bg-*`, no click handlers.
- **Overdue date with `new Date(duedate)` timezone hazard:** Use ISO string comparison `duedate < today` where `today = new Date().toISOString().slice(0, 10)` — matches the pattern in `DashboardReleaseCard` and `my-tasks-sort.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart card chrome (loading/empty/error) | Custom card with state management | `ChartWrapper` | Already has `'use no memo'`, explicit height, all 3 state primitives |
| Progress bar | Custom `<div>` with inline width | `Progress` from `@/components/ui/progress` | Base UI primitive with ARIA, theme colors |
| Loading skeleton | Custom pulse divs | `Skeleton` + `useDelayedLoading` | Prevents flash; matches existing dashboard card pattern |
| CSS-var chart colors | Hardcoded values | `var(--chart-1/2/3)` via `ChartConfig.color` | Theme-aware, auto dark mode |
| Days-remaining calculation | Custom date math | Lift `getDaysRemaining()` from `DashboardSprintCard` | Already handles NaN, negative, zero cases |
| Donut center label | Recharts label prop wiring | Absolute-positioned overlay div | Simpler; avoids recharts label API complexity |

---

## Common Pitfalls

### Pitfall 1: Active-sprint cache not warm on Dashboard load

**What goes wrong:** `SprintHealthSection` mounts `useQuery(['jira-active-sprint',...])` with `enabled: false`, but the cache is empty because the user navigated directly to Dashboard without hovering Sprint Board in Sidebar. Days-remaining shows nothing; section stays in empty state incorrectly.

**Why it happens:** The Sidebar `prefetchForPath('/dashboard')` block at line 124 does NOT include the active-sprint prefetch (only Sprint Board path does, line 145).

**How to avoid:** If using Option B, add the active-sprint prefetch to the `/dashboard` path in `Sidebar.tsx` `prefetchForPath()`. If using Option A, mount the query with `enabled: true` — it will fetch on first load but is not a new query (mirrors what `DashboardSprintCard` does today).

**Warning signs:** Sprint health section shows "No active sprint" even when Sprint Board shows an active sprint.

### Pitfall 2: Zero-SP donut segments crashing PieChart

**What goes wrong:** If a sprint has 0 story points in a status category (e.g., nothing is In Progress), passing a `value: 0` slice to `<Pie data={...}>` causes Recharts to render a 360-degree degenerate arc.

**How to avoid:** Filter out zero-value segments: `donutData.filter((d) => d.value > 0)`. Handle the `isEmpty` case at the `ChartWrapper` level (pass `isEmpty={totalSP === 0}`).

### Pitfall 3: SP field key mismatch

**What goes wrong:** Hard-coding `'customfield_10016'` as the SP field key. Some Jira instances use `'customfield_10028'`.

**How to avoid:** Always use `storyPointsFieldKey` from `useSettingsStore()`. `fetchSprintIssues` already requests both `customfield_10016` and `customfield_10028` plus the discovered key — the discovered key is what `issue.fields[storyPointsFieldKey]` reads. Never hard-code the field name; always use the discovered key.

### Pitfall 4: Overdue computation timezone mismatch

**What goes wrong:** `new Date(duedate) < new Date()` uses local time, which can make issues appear overdue or not-overdue incorrectly depending on the user's timezone.

**How to avoid:** Compare ISO strings: `duedate < new Date().toISOString().slice(0, 10)`. This is the established pattern in `DashboardReleaseCard.tsx` (line 31) and `my-tasks-sort.ts` (line 54).

### Pitfall 5: `StatTile` with `role="button"` (D-06 violation)

**What goes wrong:** Tiles accidentally get hover styles, click handlers, or `role="button"` — making them interactive when they are specified as display-only.

**How to avoid:** `StatTile` uses `<div role="region" aria-label="{label} count">`. No `cursor-pointer`. No `onClick`. No `hover:bg-*`. The UI-SPEC interaction contract explicitly states "Do NOT use `role="button"`, `cursor-pointer`, or `hover:bg-*`."

### Pitfall 6: Query key mismatch

**What goes wrong:** Using a different query key for the sprint-board data than `SprintBoardTab` and the old dashboard cards, causing a cache miss and a new fetch.

**How to avoid:** The canonical key is exactly `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]`. The comment in `DashboardInProgressCard.tsx` line 47 says "CACHE KEY MUST MATCH DashboardSprintCard / SprintBoardTab exactly." Replicate this comment in the new component.

---

## Code Examples

### Subtask exclusion + SP sum (critical: unit-test target)

```typescript
// Source: DashboardSprintCard.tsx lines 76-92 (adapted for Phase 83)
const stories = sprintIssues.filter((i) => !i.fields.issuetype.subtask);

const donePoints = stories
  .filter((i) => i.fields.status.statusCategory?.key === 'done')
  .reduce(
    (sum, i) => sum + ((i.fields[storyPointsFieldKey] as number | null | undefined) ?? 0),
    0,
  );

const totalPoints = stories.reduce(
  (sum, i) => sum + ((i.fields[storyPointsFieldKey] as number | null | undefined) ?? 0),
  0,
);

// Division-by-zero guard (D-06 of old card, T-60-03)
const donePct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
```

### Personal tile filter (Open count)

```typescript
// Source: DashboardInProgressCard.tsx line 62-67 pattern
const myNonSubtasks = sprintIssues.filter(
  (i) =>
    !i.fields.issuetype.subtask &&
    i.fields.assignee?.displayName === jiraUserDisplayName,
);

const openCount = myNonSubtasks.filter(
  (i) => i.fields.status.statusCategory?.key !== 'done'
).length;

const inProgressCount = myNonSubtasks.filter(
  (i) => i.fields.status.statusCategory?.key === 'indeterminate'
).length;

const today = new Date().toISOString().slice(0, 10);
const overdueCount = myNonSubtasks.filter((i) => {
  const duedate = i.fields.duedate as string | null | undefined;
  return !!duedate && duedate < today && i.fields.status.statusCategory?.key !== 'done';
}).length;
```

### getDaysRemaining (lift verbatim)

```typescript
// Source: DashboardSprintCard.tsx lines 29-34
function getDaysRemaining(endDateIso: string | undefined): number | null {
  if (!endDateIso) return null;
  const ms = new Date(endDateIso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
```

### ChartWrapper integration test analog

```typescript
// Source: chart-wrapper.test.tsx lines 52-78 (analog for donut)
import { Pie, PieChart } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { ChartWrapper } from '@/components/chart-wrapper';

render(
  <ChartWrapper title="Sprint Health" height={200}>
    <ChartContainer config={donutConfig} className="h-full w-full">
      <PieChart responsive>
        <Pie data={donutData} dataKey="value" isAnimationActive={false} />
      </PieChart>
    </ChartContainer>
  </ChartWrapper>
);
expect(document.querySelector('[data-slot="chart"]')).toBeTruthy();
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `DashboardSprintCard` separate `fetchActiveSprint` query | Phase 83: Sidebar prefetch for `/dashboard` + `enabled:false` read in SprintHealthSection | Zero net-new API calls on Dashboard load |
| 3-card grid with bespoke card components | Single shared `StatTile` + `SprintHealthSection` | Consistent structure, less duplication |
| `SmokeTestChart` scaffold | Phase 81 verified the stack; replace with real `PieChart` donut | Production chart, no more throwaway |

**Deprecated/outdated:**
- `DashboardSprintCard`: replaced by `SprintHealthSection` (logic extracted to `dashboardMetrics.ts`)
- `DashboardInProgressCard`: replaced by `StatTile` grid (personal filter logic extracted)
- `SmokeTestChart`: deleted (Phase 81 scaffold, criterion 3 of Phase 81 verified the stack)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `PieChart` from Recharts v3 accepts `responsive` prop directly (not via `ResponsiveContainer`) | Donut pattern | Low — confirmed in Phase 81 research and 81-CONTEXT.md D-02; ChartContainer's internal ResponsiveContainer handles it anyway |
| A2 | `ChartContainer` internal `ResponsiveContainer` + `initialDimension` is sufficient WebKit guard for donut | ChartWrapper/donut | Low — same infrastructure used and verified by Phase 81 SmokeTestChart |
| A3 | Sidebar `prefetchForPath` can be extended with active-sprint prefetch for `/dashboard` path with minimal risk | Q1 Option B | Low — 3-line change mirroring existing `/sprint-board` block; falls back to Option A |

---

## Open Questions (RESOLVED)

1. **Option A vs Option B for active-sprint endDate sourcing (D-10)**
   - What we know: active-sprint cache is not reliably warm for Dashboard-first users under Option B without Sidebar change
   - What's unclear: whether the planner wants the Sidebar change (Option B, cleanest) or will accept the same-as-today behavior (Option A, one query that already existed)
   - Recommendation: Option B — add the active-sprint prefetch to `/dashboard` in Sidebar, then use `enabled:false` in SprintHealthSection. Mark clearly in the plan.
   - **RESOLVED:** Option B chosen during planning. `83-01` Task 2 extends Sidebar `prefetchForPath` to prefetch `['jira-active-sprint',…]` for the `/dashboard` path; `83-02` Task 2 reads it via a fetch-disabled `useQuery({ enabled: false })`. Honors criterion 3 (zero new API calls on Dashboard load).

2. **`boardId` availability at Sidebar prefetch time for `/dashboard`**
   - What we know: the active-sprint prefetch for `/sprint-board` needs `boardId` (resolved async via stored value or discovery)
   - What's unclear: whether the same async `resolveBoardId` chain in Sidebar can be reused for the `/dashboard` path without code duplication
   - Recommendation: refactor the `resolveBoardId.then(...)` block into a helper or call it from both paths. `boardId` is needed for the `['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId]` key to match what `SprintHealthSection` reads.
   - **RESOLVED:** The existing shared `resolveBoardId` chain in Sidebar (Sidebar.tsx:124–155) is reused for the `/dashboard` path in `83-01` Task 2 — no duplication; the `/dashboard` and `/sprint-board` branches share the resolved `boardId` so the `['jira-active-sprint', …, boardId]` key matches what `SprintHealthSection` reads.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 83 is a pure frontend refactor. No new external dependencies, CLI tools, services, or build-time tools are added. Recharts (required) is already installed (Phase 81).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `npm run test -- --reporter=verbose` |
| Full suite command | `npm run test` |
| Environment | jsdom |
| Setup file | `src/test/setup.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-02 (criterion 2) | SP sum excludes subtasks: parent(5 SP) + 2 subtasks(2 SP each) = 5 | unit | `npm run test -- dashboardMetrics` | ❌ Wave 0 |
| DASH-02 (criterion 2) | SP Done tile equals sum of done non-subtask issues across whole sprint | unit | `npm run test -- dashboardMetrics` | ❌ Wave 0 |
| DASH-02 | Open tile = my non-done non-subtask issues with my assignee | unit | `npm run test -- dashboardMetrics` | ❌ Wave 0 |
| DASH-02 | In Progress tile = my indeterminate non-subtask issues | unit | `npm run test -- dashboardMetrics` | ❌ Wave 0 |
| DASH-02 | Overdue tile = my non-done issues with duedate < today | unit | `npm run test -- dashboardMetrics` | ❌ Wave 0 |
| DASH-03 | getDaysRemaining returns correct day count; returns 0 when sprint ends today | unit | `npm run test -- dashboardMetrics` | ❌ Wave 0 |
| DASH-03 | Donut data: zero-SP categories excluded; 3 categories when all present | unit | `npm run test -- dashboardMetrics` | ❌ Wave 0 |
| DASH-03 | ChartWrapper renders with PieChart donut (jsdom render smoke) | component | `npm run test -- SprintHealthSection` | ❌ Wave 0 |
| DASH-07 | Sprint board loading → stat tiles show skeleton; error → error state | component | `npm run test -- StatTiles` | ❌ Wave 0 |
| DASH-01 | SmokeTestChart deleted (guard test) | unit | existing `widget-removal.guard.test.ts` analog | ✅ extend existing |

### Critical Test: Subtask Exclusion (Criterion 2 — mandatory)

```typescript
// File: src/routes/dashboard/dashboardMetrics.test.ts
import { describe, it, expect } from 'vitest';
import { computeSpDone, computeSpTotal } from './dashboardMetrics';
import type { JiraIssue } from '@/services/jira';

function makeIssue(overrides: {
  subtask: boolean;
  sp: number;
  statusCategory: 'new' | 'indeterminate' | 'done';
}): JiraIssue {
  return {
    id: '1', key: 'TEST-1',
    fields: {
      summary: 'test',
      status: { id: '1', name: 'Done', statusCategory: { key: overrides.statusCategory } },
      assignee: null,
      customfield_10016: overrides.sp,
      issuetype: { name: 'Story', subtask: overrides.subtask },
      customfield_10016: overrides.sp,
    },
  } as JiraIssue;
}

describe('dashboardMetrics — subtask exclusion (DASH-02, criterion 2)', () => {
  it('excludes subtask SPs from SP Done total', () => {
    const parent = makeIssue({ subtask: false, sp: 5, statusCategory: 'done' });
    const sub1 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done' });
    const sub2 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done' });
    expect(computeSpDone([parent, sub1, sub2], 'customfield_10016')).toBe(5); // not 9
  });

  it('total SP also excludes subtasks', () => {
    const parent = makeIssue({ subtask: false, sp: 5, statusCategory: 'new' });
    const sub = makeIssue({ subtask: true, sp: 2, statusCategory: 'new' });
    expect(computeSpTotal([parent, sub], 'customfield_10016')).toBe(5);
  });
});
```

### Sampling Rate

- **Per task commit:** `npm run test -- dashboardMetrics` (fast, pure unit tests only)
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/routes/dashboard/dashboardMetrics.ts` — pure derivation functions (no React deps)
- [ ] `src/routes/dashboard/dashboardMetrics.test.ts` — subtask exclusion + tile counts + donut data + getDaysRemaining tests
- [ ] Widget removal guard: extend `src/routes/dashboard/widget-removal.guard.test.ts` to assert `SmokeTestChart`, `DashboardSprintCard`, `DashboardInProgressCard` are not imported in `index.tsx`

---

## Security Domain

`security_enforcement` not explicitly set to `false` — including section.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth flows |
| V3 Session Management | No | No new session handling |
| V4 Access Control | No | Read-only display of already-authorized data |
| V5 Input Validation | No | No user input this phase; all data from authenticated Jira API cache |
| V6 Cryptography | No | No cryptographic operations |

No new threat patterns introduced. Phase reads from already-authenticated TanStack Query cache. The only potential issue is XSS from Jira issue summary text rendered in tiles — but this is an existing pattern throughout the app and mitigated by React's default JSX escaping (no `dangerouslySetInnerHTML`).

---

## Sources

### Primary (HIGH confidence — codebase verified)

- `taskflow/src/routes/dashboard/DashboardSprintCard.tsx` — subtask filter, SP sum pattern, `getDaysRemaining`, `fetchActiveSprint` query key, `staleTime: 30_000`
- `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` — `displayName` comparison pattern, sprint-board cache key comment
- `taskflow/src/routes/dashboard/index.tsx` — exact lines to retain (hero 74–101) and remove (103–130)
- `taskflow/src/components/chart-wrapper.tsx` — exact `ChartWrapper` props interface and `'use no memo'` placement
- `taskflow/src/components/ui/chart.tsx` — `ChartContainer` internals, `ResponsiveContainer` usage, `initialDimension` WebKit guard
- `taskflow/src/services/jira.ts` — `JiraIssue.fields.issuetype.subtask` (line 166), `statusCategory` values (line 156), `fetchSprintIssues` fields= string (line 408), `JiraActiveSprint` interface (line 1315)
- `taskflow/src/components/app/Sidebar.tsx` — prefetch logic, active-sprint prefetch scope (lines 124–155)
- `taskflow/src/index.css` — `--chart-1..5` OKLCH values (lines 105–109, 140–144)
- `taskflow/src/components/ui/progress.tsx` — `Progress` props, indicator height
- `taskflow/src/lib/my-tasks-sort.ts` — timezone-safe overdue check pattern (lines 54–56)
- `taskflow/vitest.config.ts` — test framework, jsdom environment, setupFiles

### Secondary (MEDIUM confidence)

- `taskflow/src/components/chart-wrapper.test.tsx` — confirms ChartWrapper+ChartContainer rendering pattern in jsdom

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything is already in the project, no new installs
- Architecture: HIGH — all patterns verified from live codebase files
- Pitfalls: HIGH — derived from actual code reading, not heuristics
- Critical open questions: HIGH — all 7 resolved with direct file evidence

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (stable phase — no fast-moving deps)
