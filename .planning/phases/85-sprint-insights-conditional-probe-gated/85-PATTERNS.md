# Phase 85: Sprint Insights (Conditional — Probe-Gated) - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 7 (2 new components, 2 extended files, 1 extended test file, 2 new barrel functions)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `taskflow/src/routes/dashboard/VelocityChart.tsx` | component | request-response + CRUD fan-out | `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` | exact |
| `taskflow/src/routes/dashboard/BurndownChart.tsx` | component | request-response | `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` | exact |
| `taskflow/src/routes/dashboard/dashboardMetrics.ts` (extend) | utility | transform | self (existing `computePersonalTileCounts`, `filterNonSubtasks`, `computeSpDone`) | exact |
| `taskflow/src/routes/dashboard/dashboardMetrics.test.ts` (extend) | test | — | self (existing `describe('computePersonalTileCounts')` block + `makeIssue` factory) | exact |
| `taskflow/src/services/jira.ts` (extend barrel) | service | CRUD, paginated | `taskflow/src/services/jira/sprints.ts` — `fetchSprintsForBoard`, `fetchActiveSprint` | exact |
| `taskflow/src/services/jira.ts` — `fetchClosedSprints` | service | CRUD, paginated tail | `taskflow/src/services/jira/sprints.ts:164` — `fetchSprintsForBoard` | exact |
| `taskflow/src/services/jira.ts` — `fetchSprintIssuesBySprintId` | service | CRUD | `taskflow/src/services/jira.ts:392` — `fetchSprintIssues` (headers + apiFetch pattern) | role-match |
| `taskflow/src/routes/dashboard/index.tsx` (extend) | route/view | — | self (lines 219–261 — additive `grid-cols-1 lg:grid-cols-2 gap-4` row) | exact |

---

## Pattern Assignments

### `taskflow/src/routes/dashboard/VelocityChart.tsx` (NEW — component, request-response + CRUD fan-out)

**Analog:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx`

**File-level directive and imports pattern** (lines 1–26):
```typescript
'use no memo';

// Props only — no readSecret, no useAuthStore inside the component.
// Auth values loaded once in index.tsx and passed down as props (D-16 pattern).
import { useQuery, useQueries } from '@tanstack/react-query';
import { BarChart2 } from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from '@/components/chart-wrapper';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { EmptyState } from '@/components/ui/empty-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchClosedSprints, fetchSprintIssuesBySprintId } from '@/services/jira';
import { computePersonalVelocitySeries } from './dashboardMetrics';
import pLimit from 'p-limit';
```

**Props-only interface pattern** (WeeklyTrendChart lines 29–34):
```typescript
interface VelocityChartProps {
  jiraBaseUrl: string;
  jiraToken: string;
  jiraUserDisplayName: string;
  boardId: number | null;
  storyPointsFieldKey: string;
  activeJiraProject: string;
}
```

**chartConfig declaration pattern** (WeeklyTrendChart lines 59–61):
```typescript
const chartConfig = {
  committed: { label: 'Committed', color: 'var(--chart-1)' },
  completed: { label: 'Completed', color: 'var(--chart-2)' },
} satisfies ChartConfig;
```

**Dedicated p-limit instance** — module-level or component-level (NOT `getJiraLimit()` from `lib/concurrency.ts`):
```typescript
// D-05: dedicated, tighter cap for velocity backfill fan-out — NOT the global p-limit(6)
const velocityLimit = pLimit(3);
```

**Query pattern — staleTime: Infinity, token in closure not queryKey** (WeeklyTrendChart lines 96–106):
```typescript
// Probe A+B PASSED 2026-06-15: closed-sprint endpoint returns sprint objects with startDate/endDate;
// SP field customfield_10106 confirmed on closed-sprint issues. Build is unconditional;
// <3-guard and error state handle runtime absence.

// ONE token-not-in-queryKey invariant (T-84-02): token lives in queryFn closure only.
const { data: closedSprints, isLoading: sprintsLoading, error: sprintsError, refetch: refetchSprints } = useQuery({
  queryKey: ['jira-closed-sprints', boardId],
  queryFn: () => fetchClosedSprints(jiraBaseUrl, jiraToken, boardId!, 6),
  staleTime: Infinity, // closed sprint data never changes
  enabled: !!jiraToken && boardId != null,
});

// useQueries fan-out: each sprint gets its own staleTime:Infinity cache slot
const sprintIssueQueries = useQueries({
  queries: (closedSprints ?? []).map((sprint) => ({
    queryKey: ['jira-sprint-issues', sprint.id, storyPointsFieldKey],
    queryFn: () => velocityLimit(() =>
      fetchSprintIssuesBySprintId(jiraBaseUrl, jiraToken, sprint.id, storyPointsFieldKey)
    ),
    staleTime: Infinity,
    enabled: !!jiraToken && (closedSprints?.length ?? 0) > 0,
  })),
});
```

**useDelayedLoading pattern** (WeeklyTrendChart line 108):
```typescript
const showSkeleton = useDelayedLoading(sprintsLoading || !sprintIssueQueries.every((q) => !q.isLoading));
```

**role="region" wrapper + ChartWrapper + isEmpty={false} pattern** (WeeklyTrendChart lines 139–206):
```typescript
return (
  <div role="region" aria-label="Personal velocity chart">
    <ChartWrapper
      title="Personal Velocity"
      description="Committed vs completed story points · last 6 closed sprints"
      height={240}
      isLoading={showSkeleton}
      error={sprintsError}
      isEmpty={false}   // <3 case handled as children below — NOT ChartWrapper isEmpty
      onRetry={refetchSprints}
    >
      {/* Explicit-height outer div — WebKit 0×0 guard (Phase 81 D-03) */}
      <div style={{ height: 240 }} className="w-full">
        {qualifyingSprints.length < 3 ? (
          <div className="h-full w-full flex items-center justify-center">
            <EmptyState
              icon={BarChart2}
              title="Not enough sprint data"
              subtitle="At least 3 closed sprints with assigned story points are needed to show your velocity trend."
            />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full"
            aria-label="Personal velocity bar chart — committed vs completed story points per sprint">
            <BarChart data={velocitySeries} responsive>
              <XAxis dataKey="sprintName" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => String(v)} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="committed" name="Committed" fill="var(--chart-1)" fillOpacity={0.4} isAnimationActive={false} />
              <Bar dataKey="completed" name="Completed" fill="var(--chart-2)" isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </ChartWrapper>
  </div>
);
```

**Key anti-patterns to avoid:**
- Do NOT pass `isEmpty={qualifyingSprints.length < 3}` to `ChartWrapper` — that renders the generic "No data yet" copy. Always pass `isEmpty={false}` and render the custom `EmptyState` as `children`.
- Do NOT import `getJiraLimit()` from `lib/concurrency.ts` for this fan-out — use the local `pLimit(3)`.
- Do NOT put `jiraToken` in `queryKey` (T-84-02 / WeeklyTrendChart line comment).

---

### `taskflow/src/routes/dashboard/BurndownChart.tsx` (NEW — component, request-response)

**Analog:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx`

**File-level directive** (WeeklyTrendChart line 1):
```typescript
'use no memo';
```

**Props-only interface** (WeeklyTrendChart lines 29–34 pattern):
```typescript
interface BurndownChartProps {
  jiraBaseUrl: string;
  jiraToken: string;
  boardId: number | null;
  activeSprintId: number | null;
}
```

**GreenHopper burndown query — apiPath='' override** (no direct analog in WeeklyTrendChart; adapts from `src/services/jira/greenhopper/client.ts:34`):
```typescript
// Probe C PASSED 2026-06-15: scopechangeburndownchart returns .changes + .workRateData.
// statisticField=timeestimate — Y-axis is hours remaining, NOT story points.
// Build is unconditional; error state handles runtime absence.

const { data: burndownRaw, isLoading, error, refetch } = useQuery({
  queryKey: ['jira-burndown', boardId, activeSprintId],
  // Token in queryFn closure only — never in queryKey (T-84-02)
  queryFn: async () => {
    const res = await greenhopperFetch(
      jiraBaseUrl,
      jiraToken,
      `/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=${boardId}&sprintId=${activeSprintId}`,
      'Load Sprint Burndown',
      '', // apiPath override: rapid-charts root differs from GREENHOPPER_API_PATH (/rest/greenhopper/1.0/xboard)
    );
    if (!res.ok) throw new Error(`Burndown fetch failed: ${res.status}`);
    return res.json() as Promise<GreenHopperBurndown>;
  },
  staleTime: 30_000, // D-09: NOT Infinity — active sprint data changes throughout sprint
  enabled: !!jiraToken && boardId != null && activeSprintId != null,
});
```

**chartConfig + AreaChart render** (WeeklyTrendChart BarChart pattern adapted to AreaChart):
```typescript
const chartConfig = {
  remaining: { label: 'Remaining', color: 'var(--chart-3)' },
} satisfies ChartConfig;

// Inside ChartWrapper children, explicit-height div (WebKit 0×0 guard):
<div style={{ height: 240 }} className="w-full">
  <ChartContainer config={chartConfig} className="h-full w-full"
    aria-label="Sprint burndown area chart — hours remaining over sprint timeline">
    <AreaChart data={burndownPoints} responsive>
      <XAxis
        dataKey="t"
        tickFormatter={(v) => new Date(v).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
        tick={{ fontSize: 11 }}
        interval={2}
      />
      <YAxis
        tickFormatter={(v) => `${v}h`}  // HOURS — NOT story points (Probe C: statisticField=timeestimate)
        domain={[0, 'auto']}
        tick={{ fontSize: 11 }}
      />
      <Tooltip
        formatter={(v: number) => formatHoursMinutes(v / 3600)} // seconds → h+m
        labelFormatter={(t) => new Date(t).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
      />
      <Area
        type="monotone"
        dataKey="remaining"
        name="Remaining"
        stroke="var(--chart-3)"
        fill="var(--chart-3)"
        fillOpacity={0.2}
        isAnimationActive={false}
      />
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
```

**ChartWrapper isEmpty for burndown** (unlike VelocityChart, uses standard `isEmpty` prop):
```typescript
<ChartWrapper
  title="Sprint Burndown"
  description="Hours remaining · active sprint · time estimate"
  height={240}
  isLoading={showSkeleton}
  error={error}
  isEmpty={!hasBurndownData}  // true when .changes has no entries
  onRetry={refetch}
>
```

**formatHoursMinutes** — copy verbatim from `WeeklyTrendChart.tsx` lines 76–83 (or extract to `dashboardMetrics.ts` for reuse):
```typescript
function formatHoursMinutes(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
```

---

### `taskflow/src/routes/dashboard/dashboardMetrics.ts` (EXTEND — utility, transform)

**Analog:** self — `computePersonalTileCounts` (lines 64–85) + `filterNonSubtasks` (lines 28–30) + `computeSpDone` (lines 36–40)

**Personal displayName + subtask filter pattern** (lines 69–71 — copy and adapt):
```typescript
// From computePersonalTileCounts — the exact pattern for D-01 / D-04
const myNonSubtasks = issues.filter(
  (i) => !i.fields.issuetype.subtask && i.fields.assignee?.displayName === displayName,
);
```

**SP sum pattern** (lines 36–40 from `computeSpDone`, lines 46–50 from `computeSpTotal`):
```typescript
// committed = all my non-subtask issues (like computeSpTotal but personal-filtered)
const committed = myNonSubtasks.reduce(
  (sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0),
  0,
);

// completed = my DONE non-subtask issues (like computeSpDone but personal-filtered)
const completed = myNonSubtasks
  .filter((i) => i.fields.status.statusCategory?.key === 'done')
  .reduce((sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0), 0);
```

**Mandatory inline D-03 comment** — must appear at the `committed` sum derivation:
```typescript
// "Committed" here = my final-assigned sprint scope (sum of SP for all issues assigned to me
// in the closed sprint at fetch time), NOT start-of-sprint commitment. Mid-sprint scope
// additions and assignee changes are not captured. Acceptable approximation for a personal
// trend — probe confirmed 2026-06-15.
```

**New interfaces and function signatures to add** (after the existing Phase 84 block at line 244):
```typescript
// ---------------------------------------------------------------------------
// Phase 85 — INSIGHT-01/02: Velocity series + burndown timeline
// ---------------------------------------------------------------------------

export interface VelocityPoint {
  sprintName: string;
  committed: number;
  completed: number;
}

export function computePersonalVelocitySeries(
  sprints: JiraActiveSprint[],
  issuesBySprint: Map<number, JiraIssue[]>,
  displayName: string,
  spKey: string,
): VelocityPoint[] { ... }

export interface BurndownPoint {
  t: number;       // epoch ms
  remaining: number; // seconds remaining (Probe C: statisticField=timeestimate, stored in seconds)
  ideal?: number;  // optional ideal guideline value from workRateData
}

export function parseBurndownChanges(
  changes: Record<string, Array<{ key: string; statC?: { newValue: number; oldValue: number }; added?: boolean }>>,
  startTime: number,
): BurndownPoint[] { ... }
```

---

### `taskflow/src/routes/dashboard/dashboardMetrics.test.ts` (EXTEND — test)

**Analog:** self — existing `describe('computePersonalTileCounts')` block (lines 129–205) + `makeIssue` factory (lines 26–63)

**Reuse the existing `makeIssue` factory verbatim** (lines 26–63) — all new velocity tests use it unchanged, only the `overrides` fields needed are already supported (`subtask`, `sp`, `statusCategory`, `assignee`).

**Reuse the existing `SP_KEY` constant** (line 21):
```typescript
const SP_KEY = 'customfield_10016'; // already declared at top of file
```

**New `describe` block structure** — append after the `mergeActivityEntries` describe block (after line 381):
```typescript
// ---------------------------------------------------------------------------
// Phase 85 — computePersonalVelocitySeries
// ---------------------------------------------------------------------------
describe('computePersonalVelocitySeries', () => {
  // Test 1: Ordering landmine guard — tail selection
  it('selects last N sprints from ascending list (tail-first ordering)', () => { ... });

  // Test 2: Subtask SP exclusion
  it('excludes subtask SP from committed and completed velocity sums', () => { ... });

  // Test 3: Personal displayName filter
  it('excludes other users from velocity sums', () => { ... });

  // Test 4: <3 qualifying sprints guard
  it('qualifying sprints filter: sprints with 0 committed+completed are not qualifying', () => { ... });

  // Test 5: committed vs completed distinction
  it('committed includes non-done issues; completed only includes done issues', () => { ... });
});

// ---------------------------------------------------------------------------
// Phase 85 — parseBurndownChanges
// ---------------------------------------------------------------------------
describe('parseBurndownChanges', () => {
  it('returns ascending-time points anchored at startTime', () => { ... });
  it('clamps remaining to 0 — never negative', () => { ... });
});
```

---

### `taskflow/src/services/jira.ts` — `fetchClosedSprints` (EXTEND barrel — service, paginated CRUD)

**Analog:** `taskflow/src/services/jira/sprints.ts:164` — `fetchSprintsForBoard`

**Function skeleton** — follows `fetchSprintsForBoard` exactly except: state=closed, pagination loop, and tail slice:
```typescript
// Fetch the last N closed sprints for a board, always returning the MOST RECENT ones.
// ⚠ ORDERING LANDMINE (Probe A 2026-06-15): the /sprint?state=closed endpoint returns
// sprints ASCENDING (oldest first). A naive maxResults=6 fetch returns 2019 data.
// This function paginates to the full list and slices the LAST N entries.
export async function fetchClosedSprints(
  baseUrl: string,
  token: string,
  boardId: number,
  n = 6,
): Promise<JiraActiveSprint[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const PAGE = 50;
  const allSprints: JiraActiveSprint[] = [];
  let startAt = 0;

  for (;;) {
    const res = await apiFetch(
      'jira',
      `${base}/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=${PAGE}&startAt=${startAt}`,
      { headers },
      'Load Closed Sprints',
    );
    if (!res.ok) return [];
    const data = await res.json();
    const values: JiraActiveSprint[] = data?.values ?? [];
    allSprints.push(...values);
    if (data?.isLast || values.length < PAGE) break;
    startAt += PAGE;
  }

  // Tail slice — ascending list, so last N are newest (Probe A ordering landmine fix)
  return allSprints.slice(-n);
}
```

**Key difference from `fetchSprintsForBoard`:** no try/catch wrapping the whole function body (returns `[]` only on `!res.ok`). Match the existing barrel style for `fetchActiveSprint` which also returns `null` on catch. Choose one: either wrap in try/catch returning `[]`, or let errors propagate to TanStack Query's `error` state (preferred — lets the ChartWrapper `error` prop render the retry UI).

**apiFetch import** is already at the top of jira.ts — no new import needed.

---

### `taskflow/src/services/jira.ts` — `fetchSprintIssuesBySprintId` (EXTEND barrel — service, CRUD)

**Analog:** `taskflow/src/services/jira.ts:392` — `fetchSprintIssues` (headers + apiFetch pattern) + `taskflow/src/services/jira/sprints.ts:164` (simpler fetch structure)

**Function skeleton:**
```typescript
// Fetch all issues for a single closed sprint by sprint ID.
// Used by the velocity backfill; issues are filtered client-side to the current user.
// Fields: only what's needed for SP sum derivation (assignee, issuetype, status, SP key).
export async function fetchSprintIssuesBySprintId(
  baseUrl: string,
  token: string,
  sprintId: number,
  spKey: string,
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const fields = `assignee,issuetype,status,${spKey}`;
  // Include standard SP keys plus the discovered key (deduplicated), consistent with fetchSprintIssues
  const spFields = [...new Set(['customfield_10016', 'customfield_10028', spKey])].join(',');
  const url = `${base}/rest/agile/1.0/sprint/${sprintId}/issue?fields=assignee,issuetype,status,${spFields}&maxResults=200`;

  const res = await apiFetch('jira', url, { headers }, 'Load Sprint Issues');
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.issues ?? []) as JiraIssue[];
}
```

**Note on pagination:** closed sprints with >200 issues are rare; `maxResults=200` is a safe cap. If needed, add pagination loop mirroring `fetchSprintsForBoard`.

---

### `taskflow/src/routes/dashboard/index.tsx` (EXTEND — route/view)

**Analog:** self — lines 219–261 (the existing `grid-cols-1 lg:grid-cols-2 gap-4` additive section rows)

**Additive section pattern** (lines 238–261 — the Activity & Releases row to replicate exactly):
```typescript
{/* Sprint Insights — INSIGHT-01 / INSIGHT-02 */}
<div className="relative px-6 pb-6">
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <VelocityChart
      jiraBaseUrl={jiraBaseUrl ?? ''}
      jiraToken={jiraToken ?? ''}
      jiraUserDisplayName={jiraUserDisplayName ?? ''}
      boardId={boardId}
      storyPointsFieldKey={storyPointsFieldKey}
      activeJiraProject={activeJiraProject ?? ''}
    />
    <BurndownChart
      jiraBaseUrl={jiraBaseUrl ?? ''}
      jiraToken={jiraToken ?? ''}
      boardId={boardId}
      activeSprintId={??}  // sourced from the existing sprint query data
    />
  </div>
</div>
```

**activeSprintId sourcing** — `boardId` is already resolved via `useBoardId` (line 82). The active sprint ID must come from the existing sprint query or a second useQuery using `fetchActiveSprint` (passing `boardId` to skip re-discovery). Mirror how `SprintHealthSection` receives `boardId` as a prop (line 222–228).

**Import additions** at top of `index.tsx` (follow existing import grouping):
```typescript
import VelocityChart from './VelocityChart';
import BurndownChart from './BurndownChart';
```

**Placement:** append the new `div.relative.px-6.pb-6` block immediately after the closing `</div>` of the Activity & Releases row (after line 261, before the closing `</div>` of the root element at line 262).

---

## Shared Patterns

### `'use no memo'` directive
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` line 1; `taskflow/src/components/chart-wrapper.tsx` line 1
**Apply to:** `VelocityChart.tsx`, `BurndownChart.tsx` — both are new chart components; directive is mandatory (Phase 81 D-02 — React Compiler conflict with Recharts `responsive` prop).

### Token-not-in-queryKey (T-84-02)
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` lines 95–106 (comment + queryKey shape)
**Apply to:** All new `useQuery` / `useQueries` calls in `VelocityChart.tsx` and `BurndownChart.tsx`.
Pattern: `queryKey: ['jira-closed-sprints', boardId]` — token absent. Token accessed via component prop closure inside `queryFn` only.

### explicit-height inner div (WebKit 0×0 guard)
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` lines 153–155 (comment + div); `taskflow/src/components/chart-wrapper.tsx` line 52
**Apply to:** Both `VelocityChart.tsx` and `BurndownChart.tsx` chart render paths.
```typescript
{/* Explicit-height outer div — WebKit 0×0 guard (Phase 81 D-03) */}
<div style={{ height: 240 }} className="w-full">
  <ChartContainer ...>
```

### `isAnimationActive={false}`
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` line 178
**Apply to:** All `Bar`, `Area`, and `Line` elements in both charts (Phase 81 D-06 — prevents Tauri/WebKit rendering issues and test flakiness).

### `responsive` prop (not `ResponsiveContainer`)
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` line 160 — `<BarChart data={buckets} responsive ...>`
**Apply to:** `<BarChart ... responsive>` in `VelocityChart.tsx`; `<AreaChart ... responsive>` in `BurndownChart.tsx`. Never import `ResponsiveContainer` (Phase 81 D-02).

### `var(--chart-N)` CSS-var colors
**Source:** `taskflow/src/routes/dashboard/dashboardMetrics.ts` lines 109–111; `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` line 60
**Apply to:** All color props in both charts — `fill="var(--chart-1)"`, `stroke="var(--chart-3)"`, etc. No hardcoded hex values (exception: the `WeeklyTrendChart` uses per-bar semantic hex for met/under-target states — this phase does NOT use per-bar semantic coloring, so the exception does not apply here).

### `role="region"` + `aria-label` wrapper
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` lines 140, 122
**Apply to:** outermost `<div>` of `VelocityChart.tsx` and `BurndownChart.tsx`.
```typescript
<div role="region" aria-label="Personal velocity chart">  // VelocityChart
<div role="region" aria-label="Sprint burndown chart">    // BurndownChart
```

### `useDelayedLoading` hook
**Source:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` line 108
**Apply to:** both chart components — pass the combined loading state to `useDelayedLoading` before passing to `ChartWrapper isLoading`.

### ChartWrapper API
**Source:** `taskflow/src/components/chart-wrapper.tsx` lines 9–57
**Key facts:**
- State precedence: `error > isLoading > isEmpty > children` (line 31–45 comment)
- `isEmpty={false}` bypasses the generic "No data yet" — use this for custom empty states as `children`
- `onRetry` wires to `ErrorState`'s retry button
- `height` defaults to 240 (line 27) — still pass explicitly for clarity

### apiFetch + Bearer headers pattern
**Source:** `taskflow/src/services/jira/sprints.ts` lines 28–29 and lines 171–172
**Apply to:** `fetchClosedSprints` and `fetchSprintIssuesBySprintId` in `jira.ts` barrel.
```typescript
const base = baseUrl.replace(/\/$/, '');
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
```

### greenhopperFetch path override
**Source:** `taskflow/src/services/jira/greenhopper/client.ts` lines 34–57
**Critical detail** (line 42): `const url = \`${baseUrl.replace(/\/$/, '')}${apiPath}${path}\``
Passing `apiPath=''` and the full rapid-charts path as `path` produces `baseUrl + '' + fullPath = baseUrl + fullPath` (correct). Any other value for `apiPath` will produce a doubled prefix (404).
```typescript
greenhopperFetch(
  baseUrl, token,
  `/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=${boardId}&sprintId=${sprintId}`,
  'Load Sprint Burndown',
  '',  // apiPath override — must be empty string
)
```

---

## No Analog Found

All files in scope have strong codebase analogs. No files require falling back to RESEARCH.md patterns exclusively.

| Note | Detail |
|------|--------|
| `parseBurndownChanges` entry-level `.changes` shape | Top-level GreenHopper shape is probe-confirmed. Entry-level field names (`statC.newValue` / `statC.oldValue`) are assumed from API conventions — verify against `probe.sh` output before finalizing the parser. If field names differ, only `parseBurndownChanges` needs adjustment. |
| Burndown time unit | `statisticField: timeestimate` stores values in SECONDS (Jira standard). Tooltip `formatter` should divide by 3600 to get hours. Verify magnitude of one `.changes` entry value against `probe.sh` output (see RESEARCH.md Assumption A4). |

---

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/`, `taskflow/src/services/jira.ts`, `taskflow/src/services/jira/`, `taskflow/src/lib/`, `taskflow/src/components/`, `taskflow/src/hooks/`
**Files read:** 9 source files
**Pattern extraction date:** 2026-06-15
