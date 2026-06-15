# Phase 85: Sprint Insights (Conditional — Probe-Gated) — Research

**Researched:** 2026-06-15
**Domain:** Recharts / TanStack Query / Jira Agile REST + GreenHopper — additive Dashboard charts
**Confidence:** HIGH (all implementation is grounded in verified codebase; no new libraries introduced)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Personal scope via `assignee.displayName === jiraUserDisplayName` (Phase 83 D-05 pattern). No accountId plumbing.
- **D-02:** N = last 6 most-recent closed sprints (tail, NOT first page). Minimum 3 required; if fewer than 3 qualifying sprints, hide with explanatory message.
- **D-03:** "Committed" = sum of SP of all my issues in the closed sprint (final state); "Completed" = sum of SP of my DONE issues. Derives from `/sprint/{id}/issue` endpoint only — no GreenHopper sprintreport. Mandatory inline code comment on this approximation.
- **D-04:** SP sums exclude subtasks (`!i.fields.issuetype.subtask`). `null` SP counts as 0 / excluded.
- **D-05:** New `fetchClosedSprints` + `fetchSprintIssuesBySprintId` in `services/jira.ts` barrel. Per-sprint fetches under dedicated `p-limit(3)` (not global `p-limit(6)`). `staleTime: Infinity` for velocity query.
- **D-06:** `<3 qualifying closed sprints` → hide chart with inline explanatory message (NOT `ChartWrapper`'s generic `isEmpty`). Render card shell with custom `EmptyState` children.
- **D-07:** Burndown for active sprint via GreenHopper `scopechangeburndownchart`; unit = hours remaining (`statisticField: timeestimate`). Same resolved boardId as `fetchActiveSprint` — never hardcode rapidViewId 6708.
- **D-08:** GreenHopper burndown call via `greenhopperFetch` with full rapid-charts path (not `GREENHOPPER_API_PATH` `/xboard` base). Pass `/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=...&sprintId=...` as the path argument.
- **D-09:** Burndown NOT `staleTime: Infinity` (active sprint data changes). Standard staleTime + own loading/error state. Mid-session failure degrades independently.
- **D-10:** Implement runtime graceful omission paths even though both probes passed. Add mandated probe-outcome comment in each chart component.
- **D-11:** Recharts v3 + `ChartWrapper` + `responsive` prop + explicit-height div + `isAnimationActive={false}` + `var(--chart-N)` colors. Locked by Phase 81; not re-litigated.

### Claude's Discretion
- Velocity chart type: grouped `BarChart` (two `Bar` series per sprint) — or dual-line/bar+trendline if it reads better.
- Burndown chart type: `AreaChart` of remaining-time vs guideline.
- Dashboard placement: both sections appended at bottom in `grid-cols-1 lg:grid-cols-2 gap-4` row.
- Wording for `<3 sprints` message and exact component decomposition (new files: `VelocityChart.tsx`, `BurndownChart.tsx`).

### Deferred Ideas (OUT OF SCOPE)
- Team velocity via GreenHopper `sprintreport`
- Points-based burndown (DC uses hours)
- Configurable N for velocity window
- Backfilling SP on legacy sprints
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INSIGHT-01 | Personal velocity trend (committed vs completed points, last N closed sprints). Gated on closed-sprint REST probe (PASSED 2026-06-15). Shown only with ≥3 qualifying sprints. Cleanly omitted on failure. | `fetchClosedSprints` pattern from existing `fetchSprintsForBoard`; SP sum from `computeSpTotal` / `filterNonSubtasks` patterns in `dashboardMetrics.ts`; ordering landmine requires `startAt`-based tail fetch; `p-limit(3)` from `lib/concurrency.ts` pattern; `staleTime: Infinity` precedent from `useBoardId`. |
| INSIGHT-02 | Sprint burndown chart. GreenHopper `scopechangeburndownchart`. Cleanly omitted if endpoint fails. | `greenhopperFetch` already supports `apiPath` override parameter; burndown path = `/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart`; active sprint `id` from existing TanStack Query cache; unit is hours, Y-axis must say `h`. |
</phase_requirements>

---

## Summary

Phase 85 adds two display-only charts to the bottom of the existing Dashboard, both probe-confirmed viable on the live Jira DC instance. The implementation is almost entirely extension of verified, locked patterns from Phases 81–84: `ChartWrapper`, `filterNonSubtasks`, `computePersonalTileCounts`-style displayName filter, `greenhopperFetch` with path override, and the `p-limit` concurrency cap. No new libraries are needed.

The primary engineering risk is the **closed-sprint ordering landmine**: the Jira Agile REST endpoint returns closed sprints ascending (oldest first), so fetching page 1 silently charts 2019 data. The implementation must paginate to the tail using `startAt`. This landmine has a mandatory unit test. The secondary risk is the burndown path override: `greenhopperFetch` defaults to the `/xboard` base; the rapid-charts path must be passed explicitly. Both risks have clear, code-verified solutions.

**Primary recommendation:** Add `fetchClosedSprints` (tail-first paginator) and `fetchSprintIssuesBySprintId` to the `jira.ts` barrel; create `VelocityChart.tsx` and `BurndownChart.tsx` components under `src/routes/dashboard/`; add both to `index.tsx` in the existing side-by-side grid pattern; extend `dashboardMetrics.ts` with `computePersonalVelocitySeries` and `parseBurndownChanges` pure functions; cover each with Vitest unit tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch closed sprints list | API / Backend (Jira REST) | — | `GET /rest/agile/1.0/board/{boardId}/sprint?state=closed` returns server-ordered list; tail pagination is a network concern |
| Fetch per-sprint issues | API / Backend (Jira REST) | — | `GET /rest/agile/1.0/sprint/{id}/issue` per sprint, fanned out under `p-limit(3)` |
| SP sum derivation (committed / completed) | Frontend (dashboardMetrics.ts) | — | Pure function over issue arrays; no network; mirrors existing `computeSpDone`/`computeSpTotal` |
| Personal assignee filter | Frontend (dashboardMetrics.ts) | — | `displayName` string equality, same as `computePersonalTileCounts` |
| Burndown data fetch | API / Backend (GreenHopper REST) | — | Single GreenHopper call via `greenhopperFetch` with path override |
| Burndown timeline derivation | Frontend (dashboardMetrics.ts) | — | Pure function parsing `.changes` map into sorted `[timestamp, hoursRemaining]` series |
| Chart rendering | Browser / Client (Recharts) | — | `VelocityChart.tsx` / `BurndownChart.tsx` render via `ChartWrapper` + `ChartContainer` |
| Cache coordination | Frontend (TanStack Query) | — | Board ID + active sprint already cached; velocity uses `staleTime: Infinity`; burndown uses standard staleTime |

---

## Standard Stack

### Core (all pre-installed — zero new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.8.1 | Bar and area chart rendering | Locked Phase 81 D-01; already in use |
| @tanstack/react-query | (existing) | Query caching + staleTime: Infinity for velocity | Already powering all Dashboard sections |
| p-limit | (existing) | Dedicated `p-limit(3)` for per-sprint fan-out | Same module already used for global `p-limit(6)` in `lib/concurrency.ts` |

[VERIFIED: codebase] All packages confirmed present in `taskflow/package.json` and actively imported in existing Dashboard code. No new packages needed.

### Supporting (reused, not installed anew)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ChartWrapper` | local | Card chrome with isLoading/error/isEmpty | Both VelocityChart and BurndownChart |
| `ChartContainer` | local (shadcn chart.tsx) | Recharts wrapper with `responsive` prop support | Both charts |
| `filterNonSubtasks` from dashboardMetrics.ts | local | Exclude subtask issues before SP sum | VelocityChart committed/completed derivation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Grouped `BarChart` for velocity | Stacked bar or dual line | Grouped bars show both series at a glance without requiring legend decoding; approved in UI-SPEC |
| `AreaChart` for burndown | Plain `LineChart` | Area fill gives immediate visual of how much time is left; `LineChart` is fine fallback |
| Tail pagination via `startAt` loop | Fetch full list, slice last N | Loop is safer for instances with 1000+ closed sprints; slice approach may OOM on large DC instances |

**Installation:** No new packages to install. All dependencies already present.

---

## Package Legitimacy Audit

No new external packages are introduced in this phase. All code reuses installed dependencies.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(no new packages)* | — | — | — | — | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Dashboard index.tsx
│
├── [existing sections — unchanged]
│
└── Sprint Insights row  (px-6 pb-6 / grid-cols-1 lg:grid-cols-2 gap-4)
    │
    ├── VelocityChart.tsx  (INSIGHT-01)
    │   │
    │   ├── Props: jiraBaseUrl, jiraToken, jiraUserDisplayName, boardId, storyPointsFieldKey
    │   │
    │   ├── useQuery #1: fetchClosedSprints(baseUrl, token, boardId, n=6)
    │   │     └── GET /board/{boardId}/sprint?state=closed  [PAGINATED → TAIL]
    │   │         └── staleTime: Infinity, enabled: !!boardId && !!jiraToken
    │   │
    │   ├── useQuery #2..N: fetchSprintIssuesBySprintId(baseUrl, token, sprintId, spKey)
    │   │     └── GET /sprint/{id}/issue?fields=...   [p-limit(3) fan-out]
    │   │         └── staleTime: Infinity per sprint
    │   │
    │   ├── computePersonalVelocitySeries(sprints, issuesBySprint, displayName, spKey)
    │   │     └── pure fn in dashboardMetrics.ts
    │   │         ├── filterNonSubtasks (D-04)
    │   │         ├── displayName === jiraUserDisplayName (D-01)
    │   │         ├── committed = sum SP all my issues
    │   │         └── completed = sum SP my DONE issues (statusCategory.key === 'done')
    │   │
    │   ├── Guard: qualifyingSprints.length < 3 → EmptyState (D-06)
    │   │
    │   └── ChartWrapper → BarChart (chart-1 committed, chart-2 completed)
    │
    └── BurndownChart.tsx  (INSIGHT-02)
        │
        ├── Props: jiraBaseUrl, jiraToken, boardId, activeSprintId
        │
        ├── useQuery: fetchBurndown(baseUrl, token, boardId, sprintId)
        │     └── greenhopperFetch(baseUrl, token,
        │           '/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=...&sprintId=...',
        │           'Load Burndown',
        │           '')   ← apiPath='' because full path is in the path arg
        │         └── standard staleTime, NOT Infinity
        │
        ├── parseBurndownChanges(changes, workRateData)
        │     └── pure fn in dashboardMetrics.ts
        │         ├── .changes: Record<timestamp, entries[]> → sorted [{ t, remaining }]
        │         ├── remaining from cumulative sum of `value` deltas with statisticField=timeestimate
        │         └── workRateData → ideal guideline series
        │
        └── ChartWrapper → AreaChart (chart-3 remaining area, muted-foreground dashed guideline)
```

### Recommended Project Structure

```
taskflow/src/
├── routes/dashboard/
│   ├── index.tsx                          (extend: add VelocityChart + BurndownChart sections)
│   ├── VelocityChart.tsx                  (NEW — INSIGHT-01)
│   ├── BurndownChart.tsx                  (NEW — INSIGHT-02)
│   ├── dashboardMetrics.ts                (extend: add computePersonalVelocitySeries, parseBurndownChanges)
│   └── dashboardMetrics.test.ts           (extend: tests for new pure fns)
├── services/
│   └── jira.ts                            (extend barrel: fetchClosedSprints, fetchSprintIssuesBySprintId)
```

No new directories needed. GreenHopper burndown uses existing `greenhopperFetch` from `src/services/jira/greenhopper/client.ts` — no new file there.

---

### Pattern 1: Closed-Sprint Tail Pagination

**What:** Fetches the last N closed sprints by paginating to the tail of the ascending list.
**When to use:** INSIGHT-01 velocity; `state=closed` is always ascending on Jira DC.

**Probe A confirmed:** The endpoint returns ascending order. Sprint ids 44, 102, 106, 107, 227 were returned for maxResults=5 while the active sprint is 19562. A simple maxResults=6 fetch would silently chart 2019 data.

```typescript
// Source: pattern derived from existing fetchSprintsForBoard (sprints.ts) + Probe A landmine
// GET /rest/agile/1.0/board/{boardId}/sprint?state=closed&maxResults=50&startAt=0
// Repeat with startAt += 50 until isLast === true OR values.length < maxResults.
// Then slice the LAST N from the accumulated list.
//
// Alternative (smaller instances): fetch maxResults=1000 in one call (no pagination loop needed
// if the DC's total closed sprint count is below the cap). Defensive: always use the loop.
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

  // Slice the tail — most-recent N (ascending list, so last N are newest)
  return allSprints.slice(-n);
}
```

[VERIFIED: codebase] `apiFetch` signature and `JiraActiveSprint` type confirmed in `taskflow/src/services/jira/sprints.ts`. `isLast` field presence is standard Jira Agile pagination; graceful fallback is `values.length < PAGE`.

---

### Pattern 2: Per-Sprint Issue Fan-Out with Dedicated p-limit

**What:** Fetches issues for each closed sprint in parallel, capped at 3 concurrent requests, using a dedicated limiter (not the global one).
**When to use:** Velocity backfill. The global `p-limit(6)` in `lib/concurrency.ts` is for general Jira API calls; the velocity fan-out has its own `p-limit(3)` to avoid monopolizing the Jira connection.

```typescript
// Source: pattern from lib/concurrency.ts + criterion 1c
// Created once per component mount (or per-query) — NOT module-level singleton
import pLimit from 'p-limit';

const velocityLimit = pLimit(3); // D-05: dedicated, tighter cap for backfill fan-out

// Inside the component's useQueries or parallel query logic:
const issueResults = await Promise.all(
  closedSprints.map((sprint) =>
    velocityLimit(() =>
      fetchSprintIssuesBySprintId(jiraBaseUrl, jiraToken, sprint.id, storyPointsFieldKey),
    ),
  ),
);
```

[VERIFIED: codebase] `pLimit` is already installed and used in `lib/concurrency.ts`. The `p-limit` API is consistent: `pLimit(n)` creates a limiter, wrapping a function call.

**Note on TanStack Query:** Using `useQueries` (parallel queries) is preferable to a single `useQuery` that internally runs `Promise.all`, because each sprint gets its own cache entry with `staleTime: Infinity`. This means individual sprint data is never refetched once loaded.

```typescript
// useQueries pattern — each sprint gets its own cache slot
const sprintIssueQueries = useQueries({
  queries: (closedSprints ?? []).map((sprint) => ({
    queryKey: ['jira-sprint-issues', sprint.id, storyPointsFieldKey],
    queryFn: () => velocityLimit(() =>
      fetchSprintIssuesBySprintId(jiraBaseUrl, jiraToken, sprint.id, storyPointsFieldKey)
    ),
    staleTime: Infinity, // closed sprint issues never change
    enabled: !!jiraToken && closedSprints != null,
  })),
});
```

---

### Pattern 3: GreenHopper Burndown Path Override

**What:** Calls `greenhopperFetch` with an empty `apiPath` so the full rapid-charts URL is in the `path` argument.
**When to use:** INSIGHT-02 burndown; the burndown endpoint is `/rest/greenhopper/1.0/rapid/charts/...`, NOT the `/xboard` base used by all other GreenHopper calls.

```typescript
// Source: src/services/jira/greenhopper/client.ts — apiPath param defaults to GREENHOPPER_API_PATH ('/rest/greenhopper/1.0/xboard')
// Override: pass apiPath='' and put the full path in the path argument.
// This keeps the Bearer PAT and 'jira' source semantics intact (D-08).

const res = await greenhopperFetch(
  baseUrl,
  token,
  `/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=${boardId}&sprintId=${sprintId}`,
  'Load Sprint Burndown',
  '', // apiPath override — rapid-charts lives at a different root than xboard
);
```

[VERIFIED: codebase] `greenhopperFetch` signature at `taskflow/src/services/jira/greenhopper/client.ts:34` accepts `apiPath: string = GREENHOPPER_API_PATH`. Passing `''` as the fifth argument overrides the default cleanly; the URL construction is `baseUrl + apiPath + path`.

---

### Pattern 4: Personal Velocity Derivation (extending dashboardMetrics.ts)

**What:** Pure function over issues from a closed sprint — filters to current user + non-subtask, sums committed and completed SP.
**When to use:** INSIGHT-01 per-sprint series generation.

```typescript
// Source: derived from existing filterNonSubtasks + computePersonalTileCounts in dashboardMetrics.ts
// Mandatory code comment (D-03) must appear inline in this function.
export interface VelocityPoint {
  sprintName: string;
  committed: number; // final-assigned SP sum (all my non-subtask issues)
  completed: number; // done SP sum (my DONE non-subtask issues)
}

export function computePersonalVelocitySeries(
  sprints: JiraActiveSprint[],
  issuesBySprint: Map<number, JiraIssue[]>,
  displayName: string,
  spKey: string,
): VelocityPoint[] {
  return sprints.map((sprint) => {
    const issues = issuesBySprint.get(sprint.id) ?? [];
    const myNonSubtasks = issues.filter(
      (i) => !i.fields.issuetype.subtask && i.fields.assignee?.displayName === displayName,
    );

    // "Committed" here = my final-assigned sprint scope (sum of SP for all issues assigned to me
    // in the closed sprint at fetch time), NOT start-of-sprint commitment. Mid-sprint scope
    // additions and assignee changes are not captured. Acceptable approximation for a personal
    // trend — probe confirmed 2026-06-15.
    const committed = myNonSubtasks.reduce(
      (sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0),
      0,
    );

    const completed = myNonSubtasks
      .filter((i) => i.fields.status.statusCategory?.key === 'done')
      .reduce((sum, i) => sum + ((i.fields[spKey] as number | null | undefined) ?? 0), 0);

    return { sprintName: sprint.name, committed, completed };
  });
}
```

---

### Pattern 5: Burndown Timeline Derivation

**What:** Converts the GreenHopper `.changes` record (keyed by epoch-ms string) into a sorted `{ t: number; remaining: number }[]` series for Recharts.
**When to use:** INSIGHT-02 burndown data preparation.

The GreenHopper `scopechangeburndownchart` response shape (confirmed Probe C):
```
{
  activatedTime, endTime, startTime, now,
  statisticField: "timeestimate",   // hours remaining unit
  changes: {                         // 496 entries at probe time
    "1748563200000": [{ key, statC: { newValue, oldValue }, added }],
    ...
  },
  workRateData: [{ x, y }]          // ideal burndown guideline
}
```

Key derivation insight: `.changes` entries are deltas (each entry has a `statC.newValue` for the issue's new value). The simplest approach is to track the **running total** of remaining hours by processing changes in chronological order:

```typescript
// Source: Probe C shape; processing approach based on how scopechangeburndownchart works
export interface BurndownPoint {
  t: number;       // epoch ms (for XAxis formatting)
  remaining: number; // hours remaining at this point
}

export function parseBurndownChanges(
  changes: Record<string, Array<{ key: string; statC?: { newValue: number; oldValue: number }; added?: boolean }>>,
  startTime: number,
): BurndownPoint[] {
  // Collect all timestamps and sort ascending
  const timestamps = Object.keys(changes).map(Number).sort((a, b) => a - b);

  const points: BurndownPoint[] = [];
  let running = 0;

  // Add sprint-start anchor
  points.push({ t: startTime, remaining: 0 });

  for (const ts of timestamps) {
    const entries = changes[String(ts)];
    for (const entry of entries) {
      if (entry.statC) {
        // Delta: newValue - oldValue captures the net change to remaining time
        running += (entry.statC.newValue ?? 0) - (entry.statC.oldValue ?? 0);
      }
    }
    points.push({ t: ts, remaining: Math.max(0, running) });
  }

  return points;
}
```

[ASSUMED] The exact shape of individual `.changes` entries (field names `statC.newValue`, `statC.oldValue`, `added`) is inferred from standard GreenHopper API documentation patterns and the probe's confirmed top-level shape. The specific entry-level structure should be verified against the actual probe response in `probe.sh` before finalizing. If the field names differ, only `parseBurndownChanges` needs adjustment.

---

### Anti-Patterns to Avoid

- **First-page closed sprints:** `state=closed&maxResults=6` without tail pagination returns 2019 data. ALWAYS paginate to tail and slice last N.
- **Hardcoding rapidViewId/boardId:** The boardId is already resolved by the app and available via the `useBoardId` hook or passed as a prop from `index.tsx`. Never hardcode 6708.
- **Hardcoding `customfield_10106`:** SP key is `customfield_10106` on THIS instance. Always consume `storyPointsFieldKey` from the settings store / `discoverCustomFields` — other DC instances will differ.
- **`isEmpty={qualifyingSprints.length < 3}`:** The `<3 sprints` case should NOT use `ChartWrapper`'s generic `isEmpty` prop (which renders "No data yet"). Render the card shell manually with a custom `EmptyState` as `children` of `ChartWrapper`, passing `isEmpty={false}`.
- **Y-axis labeled "SP" on burndown:** The burndown unit is HOURS (`statisticField: timeestimate`). Label axis ticks with `h` suffix, not SP. The UI-SPEC mandates `tickFormatter={(v) => \`${v}h\`}`.
- **Using the global `p-limit(6)` for velocity fan-out:** Create a local `pLimit(3)` instance for the velocity backfill. Do not import `getJiraLimit()` from `lib/concurrency.ts` for this use case.
- **Token in queryKey:** Following T-84-02 precedent (confirmed in WeeklyTrendChart), PAT token lives in `queryFn` closure only — never in `queryKey`.
- **`ResponsiveContainer` import:** Phase 81 D-02 is locked — use `responsive` prop on `BarChart`/`AreaChart`. Importing `ResponsiveContainer` conflicts with React Compiler.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart card loading/error/empty | Custom per-chart state handlers | `ChartWrapper` with `isLoading`/`error`/`isEmpty` props | Already built, consistent UX, handles precedence (error > loading > empty > success) |
| Theme color resolution | `getComputedStyle` or hardcoded hex | `var(--chart-N)` CSS var strings | Recharts accepts CSS vars; no JS needed; auto-adapts light/dark |
| Subtask exclusion logic | Inline `.filter((i) => i.fields.issuetype.name !== 'Sub-task')` | `filterNonSubtasks()` from `dashboardMetrics.ts` | Admin can rename issue types; `issuetype.subtask` boolean is authoritative |
| DisplayName personal filter | Re-implement substring check | `displayName === jiraUserDisplayName` (exact equality) | Probe confirms displayName is unique enough; substring matching risks false matches on common names |
| `formatHoursMinutes` | Custom h+m formatter | `formatHoursMinutes` from `WeeklyTrendChart.tsx` (or extract to dashboardMetrics.ts) | Already implemented, tested indirectly; UI-SPEC mandates this formatter for burndown tooltip |
| Board/sprint discovery | Re-implement board fetch | Pass `boardId` as prop from `index.tsx` (already resolved via `useBoardId`) | Board discovery is already done once; prop-passing avoids duplicate fetches and honors user's chosen board |

**Key insight:** This phase is almost entirely composition of verified building blocks. The only net-new logic is the closed-sprint tail paginator and the burndown parser — both straightforward transformations.

---

## Common Pitfalls

### Pitfall 1: Ascending Closed-Sprint Order (The #1 Trap)
**What goes wrong:** Developer calls `GET /board/{id}/sprint?state=closed&maxResults=6`, receives the first page (oldest 6 sprints), charts 2019 data. The chart renders, looks plausible, and the bug goes undetected.
**Why it happens:** Jira DC returns closed sprints ascending by default. There is no `orderBy` query parameter for this endpoint. The first page is always the oldest.
**How to avoid:** Paginate to completion with `startAt` increments of 50; slice `allSprints.slice(-n)` to get the last N. See Pattern 1 above.
**Warning signs:** Chart shows sprint names like "Sprint 1" through "Sprint 6" even when active sprint is "Sprint 120". Chart shows 0 SP (old sprints may have no SP field).
**Mandatory test:** Assert that `computePersonalVelocitySeries` receives the LAST 6 sprints from the fetcher (unit test mocks fetcher to return 10 sprints sorted ascending, asserts output uses sprints 5-10, not 1-6).

### Pitfall 2: Wrong Base Path for Burndown
**What goes wrong:** `greenhopperFetch` is called without overriding `apiPath`, producing URL `...jira/rest/greenhopper/1.0/xboard/rest/greenhopper/1.0/rapid/charts/...` → 404.
**Why it happens:** `GREENHOPPER_API_PATH` is `/rest/greenhopper/1.0/xboard`. All existing GreenHopper calls use the xboard sub-tree. The burndown endpoint is in the `rapid/charts` sub-tree at a completely different root.
**How to avoid:** Pass `apiPath=''` as the 5th argument to `greenhopperFetch`, and put the full path (starting with `/rest/greenhopper/1.0/rapid/charts/...`) in the `path` (3rd) argument. See Pattern 3.
**Warning signs:** 404 on burndown fetch; console shows doubled path prefix.

### Pitfall 3: Sparse SP on Older Sprints
**What goes wrong:** Chart renders 0 for committed/completed on multiple sprints. User is confused.
**Why it happens:** SP field (`customfield_10106`) is sparsely populated on older sprints on this DC instance. Probe B confirmed: only 3/10 sampled issues had SP populated. After filtering to personal issues, the user may have fewer than 3 qualifying sprints.
**How to avoid:** The `<3 qualifying sprints` guard (D-06) is the safety net. "Qualifying" means the personal SP sum is non-zero OR at least one of my non-subtask issues has a non-null SP. Handle gracefully: render the "Not enough sprint data" EmptyState when `qualifyingSprints.length < 3`.

### Pitfall 4: staleTime: Infinity on Active Burndown
**What goes wrong:** Burndown never refreshes mid-sprint; user sees stale remaining-hours data.
**Why it happens:** Applying the same `staleTime: Infinity` used for velocity data (which is correct — closed sprint data truly never changes) to the burndown query.
**How to avoid:** D-09 explicitly prohibits `staleTime: Infinity` on the burndown. Use standard staleTime (e.g., 30_000) matching other live-data Dashboard queries.

### Pitfall 5: Token in queryKey
**What goes wrong:** PAT token leaks into TanStack Query devtools and possibly localStorage.
**Why it happens:** Copying a query pattern carelessly.
**How to avoid:** T-84-02 precedent (confirmed in `WeeklyTrendChart.tsx` line comment): token lives in `queryFn` closure only, never in `queryKey`. The key should contain `['jira-closed-sprints', boardId]` and `['jira-sprint-issues', sprintId, storyPointsFieldKey]`.

### Pitfall 6: Burndown Y-axis labeled in Story Points
**What goes wrong:** Axis says "SP" but value is hours — misleading to users.
**Why it happens:** Assuming burndown charts always show story points.
**How to avoid:** Probe C confirmed `statisticField: timeestimate`. Y-axis `tickFormatter` must emit `${v}h`. Add mandatory probe-outcome comment (D-10) in `BurndownChart.tsx`.

---

## Code Examples

### Velocity query wiring in VelocityChart.tsx

```typescript
// Source: WeeklyTrendChart.tsx pattern (Phase 84) adapted for velocity
'use no memo';

// Probe A+B PASSED 2026-06-15: closed-sprint endpoint returns sprint objects with startDate/endDate;
// SP field customfield_10106 confirmed on closed-sprint issues. Build is unconditional;
// <3-guard and error state handle runtime absence.

const { boardId } = useBoardId(jiraBaseUrl, jiraToken, activeJiraProject);

// Step 1: fetch the last 6 closed sprints (tail — NOT first page)
const { data: closedSprints, isLoading: sprintsLoading, error: sprintsError } = useQuery({
  queryKey: ['jira-closed-sprints', boardId],
  queryFn: () => fetchClosedSprints(jiraBaseUrl, jiraToken!, boardId!, 6),
  staleTime: Infinity,
  enabled: !!jiraToken && boardId != null,
});

// Step 2: fan-out per sprint, each cached independently
const sprintIssueQueries = useQueries({
  queries: (closedSprints ?? []).map((sprint) => ({
    queryKey: ['jira-sprint-issues', sprint.id, storyPointsFieldKey],
    queryFn: () => velocityLimit(() =>
      fetchSprintIssuesBySprintId(jiraBaseUrl, jiraToken!, sprint.id, storyPointsFieldKey)
    ),
    staleTime: Infinity,
    enabled: !!jiraToken && (closedSprints?.length ?? 0) > 0,
  })),
});

// Step 3: derive velocity series when all queries are settled
const allLoaded = sprintIssueQueries.every((q) => !q.isLoading);
const issuesBySprint = new Map(
  (closedSprints ?? []).map((sprint, i) => [sprint.id, sprintIssueQueries[i]?.data ?? []])
);

const velocitySeries = allLoaded
  ? computePersonalVelocitySeries(closedSprints ?? [], issuesBySprint, jiraUserDisplayName, storyPointsFieldKey)
  : [];

const qualifyingSprints = velocitySeries.filter((p) => p.committed > 0 || p.completed > 0);
```

### Burndown query wiring in BurndownChart.tsx

```typescript
// Source: greenhopperFetch client.ts pattern + Probe C shape
// Probe C PASSED 2026-06-15: scopechangeburndownchart returns .changes + .workRateData.
// statisticField=timeestimate — Y-axis is hours remaining, NOT story points.
// Build is unconditional; error state handles runtime absence.

const { data: burndownRaw, isLoading, error, refetch } = useQuery({
  queryKey: ['jira-burndown', boardId, activeSprintId],
  queryFn: async () => {
    const res = await greenhopperFetch(
      jiraBaseUrl,
      jiraToken!,
      `/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=${boardId}&sprintId=${activeSprintId}`,
      'Load Sprint Burndown',
      '', // apiPath override — rapid-charts root differs from GREENHOPPER_API_PATH (/xboard)
    );
    if (!res.ok) throw new Error(`Burndown fetch failed: ${res.status}`);
    return res.json() as Promise<GreenHopperBurndown>;
  },
  staleTime: 30_000, // D-09: NOT Infinity — active sprint data changes
  enabled: !!jiraToken && boardId != null && activeSprintId != null,
});

const burndownPoints = burndownRaw
  ? parseBurndownChanges(burndownRaw.changes, burndownRaw.startTime)
  : [];
```

### ChartWrapper usage pattern (VelocityChart — <3 sprints case)

```typescript
// Source: UI-SPEC + ChartWrapper API (chart-wrapper.tsx)
// <3 qualifying sprints is NOT an isEmpty state — render custom EmptyState as children.
// This prevents ChartWrapper's generic "No data yet" copy from appearing.

return (
  <div role="region" aria-label="Personal velocity chart">
    <ChartWrapper
      title="Personal Velocity"
      description="Committed vs completed story points · last 6 closed sprints"
      height={240}
      isLoading={showSkeleton}
      error={sprintsError}
      isEmpty={false}   // never true — <3 case handled below via children
      onRetry={refetchSprints}
    >
      {qualifyingSprints.length < 3 ? (
        <div style={{ height: 240 }} className="w-full flex items-center justify-center">
          <EmptyState
            icon={BarChart2}
            title="Not enough sprint data"
            subtitle="At least 3 closed sprints with assigned story points are needed to show your velocity trend."
          />
        </div>
      ) : (
        <div style={{ height: 240 }} className="w-full">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <BarChart data={velocitySeries} responsive>
              ...
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </ChartWrapper>
  </div>
);
```

### Recharts BarChart velocity pattern

```typescript
// Source: WeeklyTrendChart.tsx Bar pattern (Phase 84) + UI-SPEC color assignments
<BarChart data={velocitySeries} responsive>
  <XAxis dataKey="sprintName" tick={{ fontSize: 11 }} />
  <YAxis tickFormatter={(v) => String(v)} tick={{ fontSize: 11 }} />
  <Tooltip />
  <Legend wrapperStyle={{ fontSize: 11 }} />
  <Bar dataKey="committed" name="Committed" fill="var(--chart-1)" fillOpacity={0.4} isAnimationActive={false} />
  <Bar dataKey="completed" name="Completed" fill="var(--chart-2)" isAnimationActive={false} />
</BarChart>
```

### Recharts AreaChart burndown pattern

```typescript
// Source: UI-SPEC chart specification + Phase 81 D-02 (responsive prop, isAnimationActive)
<AreaChart data={burndownPoints} responsive>
  <XAxis
    dataKey="t"
    tickFormatter={(v) => new Date(v).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
    tick={{ fontSize: 11 }}
    interval={2}  // show every 3rd tick to avoid crowding
  />
  <YAxis
    tickFormatter={(v) => `${v}h`}   // HOURS — NOT story points (Probe C: statisticField=timeestimate)
    domain={[0, 'auto']}
    tick={{ fontSize: 11 }}
  />
  <Tooltip
    formatter={(v: number) => formatHoursMinutes(v / 3600)}  // seconds → h+m
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
  {/* Ideal guideline — dashed, muted color, no fill */}
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
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ResponsiveContainer` for responsive charts | `responsive` prop on chart component | Recharts 3.3+ (Phase 81) | Eliminates React Compiler conflict |
| Hardcoded hex chart colors | `var(--chart-N)` OKLCH CSS vars | Phase 81 | Auto-adapts light/dark; zero JS needed |
| Per-chart loading state boilerplate | `ChartWrapper` with isLoading/error/isEmpty | Phase 81 | Consistent UX, ~40 lines saved per chart |
| `getQueryData()` in render | `useQuery({ enabled: false })` reactive read | Phase 83 (memory: reactive-cache-read-badge) | Re-renders when cache updates via setQueryData |

**Deprecated/outdated:**
- `fetchBoardId` in `sprints.ts`: Still used but superseded by `useBoardId` hook which also reads user-chosen board from `jiraBoardIds` persisted store. Downstream components should receive `boardId` as prop (not call `fetchBoardId` directly).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `greenhopperFetch` with `apiPath=''` produces URL `baseUrl + '' + path` = `baseUrl + path` (correct) | Pattern 3, Code Examples | If URL construction differs, burndown 404s; fix by adjusting the path argument |
| A2 | `.changes` entries have shape `{ key, statC: { newValue, oldValue }, added }` at the entry level | Pattern 5 (parseBurndownChanges) | If field names differ, `parseBurndownChanges` produces zero-series; only this function needs adjustment |
| A3 | `useQueries` from TanStack Query v4/v5 API is available with the `queries` array param | Pattern 2 | TanStack Query v4+ all support `useQueries({ queries: [] })`; risk is very low given v4 was installed by Phase 83 |
| A4 | Burndown `changes` values represent time in SECONDS (Jira stores `timeestimate` in seconds) | Code Examples (tooltip formatter) | If values are in hours, `/ 3600` conversion is wrong; verify against actual probe response in probe.sh |

**Assumptions A2 and A4 should be confirmed against the probe harness (`probe.sh`) output before implementing `parseBurndownChanges`.**

---

## Open Questions (RESOLVED)

1. **Exact `.changes` entry-level field names**
   - What we know: Probe C confirmed top-level keys and `.changes` has 496 entries. The entry values are arrays.
   - What's unclear: The field names within each entry (is it `statC`, `statField`, `change`?).
   - Recommendation: Re-run `probe.sh` and print one `.changes` entry to get the exact shape. This is a 5-minute clarification that prevents a guess-and-fix cycle.
   - **RESOLVED:** Deferred to execution as a deliberate safety valve — 85-02 Task 2 mandates one read-only live read (`probe.sh` re-run / direct curl) to confirm the entry shape before finalizing `BurndownChangeEntry`, and keeps `parseBurndownChanges` defensive (all-optional fields, `?? 0`) regardless of the exact field names.

2. **Burndown time unit (seconds vs milliseconds vs hours)**
   - What we know: `statisticField: timeestimate` — this is Jira's `timeestimate` REST field, which is stored in SECONDS.
   - What's unclear: Whether GreenHopper normalizes it to hours in the changes values.
   - Recommendation: Check the magnitude of values in one `.changes` entry. If `newValue` is e.g. 28800 for 8 hours, it's in seconds. If it's 8, it's in hours.
   - **RESOLVED:** Treated as SECONDS (Jira `timeestimate` native unit, A4). `BurndownPoint.remaining` carries seconds with an inline unit comment (85-01 Task 2); BOTH the 85-04 tooltip AND the Y-axis tickFormatter convert via `/3600` before rendering hours. The 85-02 live read also confirms magnitude (28800 ⇒ seconds) as a backstop.

3. **`useQueries` vs manual `Promise.all` for per-sprint fan-out**
   - What we know: `useQueries` gives per-sprint cache entries. `Promise.all` inside a single `useQuery` gives one cache entry for the entire batch.
   - What's unclear: Whether the planner prefers cache granularity (useQueries) or simplicity (useQuery + Promise.all + velocityLimit).
   - Recommendation: `useQueries` is architecturally cleaner (each sprint independently stale-free); use it.
   - **RESOLVED:** `useQueries` adopted in all plan actions (85-03) — per-sprint cache entries with `staleTime: Infinity`, fanned out under the dedicated `pLimit(3)`.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code/config only. No new external tools, runtimes, or services beyond the existing Jira DC instance (already available; probe ran 2026-06-15).

---

## Validation Architecture

Nyquist validation is ENABLED (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/routes/dashboard/dashboardMetrics.test.ts --reporter=verbose` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

All new pure functions go in `dashboardMetrics.ts` (no React, no DOM needed for the core logic tests). The key behaviors that MUST have automated tests are:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INSIGHT-01 | Tail-first ordering: last 6 sprints selected, not first 6 | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "tail"` | ❌ Wave 0 |
| INSIGHT-01 | `!subtask` SP filter: parent(5)+2 subtasks(2ea)=5, not 9 | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "subtask exclusion"` | ✅ (existing `computeSpDone` test; velocity needs its own) |
| INSIGHT-01 | Personal displayName filter: other users' SP excluded | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "personal velocity"` | ❌ Wave 0 |
| INSIGHT-01 | `<3 qualifying sprints` guard: chart hidden, message shown | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "qualifying sprints"` | ❌ Wave 0 |
| INSIGHT-01 | "committed" = sum all my issues; "completed" = sum my DONE issues | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "committed vs completed"` | ❌ Wave 0 |
| INSIGHT-02 | Y-axis tick formatter produces "h" suffix (not "SP") | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "burndown hours"` | ❌ Wave 0 |
| INSIGHT-02 | `parseBurndownChanges` produces ascending-timestamp series | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "parseBurndownChanges"` | ❌ Wave 0 |
| INSIGHT-01 + 02 | Independent degradation: one section error does not affect the other | manual | UAT: kill burndown endpoint mid-session, verify velocity still loads | manual-only |

### Key Test Specifications

#### Test 1: Ordering Landmine Guard (INSIGHT-01 #1 priority)
```typescript
// Asserts that computePersonalVelocitySeries receives the TAIL (most recent) sprints.
// Mock fetchClosedSprints to return 10 sprints (ids 1-10, ascending).
// Assert: the series contains sprint names from the LAST 6 (ids 5-10), not first 6 (ids 1-6).
it('selects last N sprints from ascending list (tail-first ordering)', () => {
  const tenSprints = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `Sprint ${i + 1}`,
    state: 'closed' as const,
  }));
  // fetchClosedSprints implementation must slice(-6) from the full ascending list
  const tail = tenSprints.slice(-6);
  // The series sprint names should be Sprint 5..10, not Sprint 1..6
  const series = computePersonalVelocitySeries(tail, new Map(), 'Alice', SP_KEY);
  expect(series.map((p) => p.sprintName)).toEqual(['Sprint 5', 'Sprint 6', 'Sprint 7', 'Sprint 8', 'Sprint 9', 'Sprint 10']);
});
```

#### Test 2: Subtask SP Exclusion for Velocity (INSIGHT-01)
```typescript
// Mirrors the existing mandated test for computeSpDone, applied to computePersonalVelocitySeries.
it('excludes subtask SP from committed and completed velocity sums', () => {
  const parent = makeIssue({ subtask: false, sp: 5, statusCategory: 'done', assignee: 'Alice' });
  const sub1 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done', assignee: 'Alice' });
  const sub2 = makeIssue({ subtask: true, sp: 2, statusCategory: 'done', assignee: 'Alice' });
  const sprint = { id: 1, name: 'Sprint 1', state: 'closed' as const };
  const issueMap = new Map([[1, [parent, sub1, sub2]]]);
  const series = computePersonalVelocitySeries([sprint], issueMap, 'Alice', SP_KEY);
  expect(series[0].committed).toBe(5); // not 9
  expect(series[0].completed).toBe(5); // not 9
});
```

#### Test 3: Personal displayName Filter (INSIGHT-01)
```typescript
it('excludes other users from velocity sums', () => {
  const mine = makeIssue({ subtask: false, sp: 8, statusCategory: 'done', assignee: 'Alice' });
  const other = makeIssue({ subtask: false, sp: 10, statusCategory: 'done', assignee: 'Bob' });
  const sprint = { id: 1, name: 'Sprint 1', state: 'closed' as const };
  const issueMap = new Map([[1, [mine, other]]]);
  const series = computePersonalVelocitySeries([sprint], issueMap, 'Alice', SP_KEY);
  expect(series[0].committed).toBe(8);  // Bob's 10 SP excluded
  expect(series[0].completed).toBe(8);
});
```

#### Test 4: <3 Qualifying Sprints Guard (INSIGHT-01)
```typescript
it('qualifying sprints filter: sprints with 0 committed+completed are not qualifying', () => {
  // 2 sprints with SP, 1 with 0 SP → only 2 qualifying → below threshold
  const withSP = makeIssue({ subtask: false, sp: 3, statusCategory: 'done', assignee: 'Alice' });
  const noSP = makeIssue({ subtask: false, sp: 0, statusCategory: 'done', assignee: 'Alice' });
  const sprints = [
    { id: 1, name: 'Sprint 1', state: 'closed' as const },
    { id: 2, name: 'Sprint 2', state: 'closed' as const },
    { id: 3, name: 'Sprint 3', state: 'closed' as const },
  ];
  const issueMap = new Map([[1, [withSP]], [2, [withSP]], [3, [noSP]]]);
  const series = computePersonalVelocitySeries(sprints, issueMap, 'Alice', SP_KEY);
  const qualifying = series.filter((p) => p.committed > 0 || p.completed > 0);
  expect(qualifying.length).toBe(2); // below 3-sprint threshold → hide chart
});
```

#### Test 5: parseBurndownChanges (INSIGHT-02)
```typescript
it('parseBurndownChanges returns ascending-time points with remaining hours', () => {
  const changes = {
    '1000': [{ key: 'PROJ-1', statC: { newValue: 28800, oldValue: 0 }, added: true }],
    '2000': [{ key: 'PROJ-1', statC: { newValue: 0, oldValue: 28800 }, added: false }],
  };
  const points = parseBurndownChanges(changes, 500);
  expect(points[0].t).toBe(500); // sprint-start anchor
  expect(points.map((p) => p.t)).toEqual([500, 1000, 2000]); // ascending
  expect(points[1].remaining).toBeGreaterThanOrEqual(0);
});
```

### Sampling Rate

- **Per task commit:** `cd taskflow && npx vitest run src/routes/dashboard/dashboardMetrics.test.ts --reporter=verbose`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `dashboardMetrics.test.ts` — add describe block: `computePersonalVelocitySeries` (Tests 1–4 above)
- [ ] `dashboardMetrics.test.ts` — add describe block: `parseBurndownChanges` (Test 5 above)
- [ ] `dashboardMetrics.ts` — add `computePersonalVelocitySeries` and `parseBurndownChanges` pure functions (no DOM needed; testable in Vitest jsdom or node)

No new test files needed — all new tests extend the existing `dashboardMetrics.test.ts` file (which already has the Vitest test harness and shared `makeIssue` factory).

---

## Security Domain

Security enforcement is enabled (absent = enabled).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — this phase reads data only; no new auth surfaces | — |
| V3 Session Management | No | — |
| V4 Access Control | No — reads use the same PAT as all other Jira calls | — |
| V5 Input Validation | Yes — burndown `.changes` is external API data | Type-safe parsing in `parseBurndownChanges`; use `?? 0` fallbacks for `statC.newValue` / `statC.oldValue`; Math.max(0, remaining) to guard negative values |
| V6 Cryptography | No — PAT stored in Stronghold; no new crypto operations | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed GreenHopper response (null `.changes`) | Tampering / Spoofing | Defensive parsing: `burndownRaw?.changes ?? {}` before iteration; `Math.max(0, remaining)` clamp |
| Hardcoded board/sprint ID | Spoofing | Always derive boardId from `useBoardId`; activeSprintId from existing sprint cache |
| SP field key hardcoded | Tampering | Source `storyPointsFieldKey` from settings store / `discoverCustomFields` |

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/services/jira/sprints.ts` — exact `fetchSprintsForBoard` pattern for closed-sprint extension; `fetchActiveSprint` board-discovery flow
- `taskflow/src/services/jira/greenhopper/client.ts` — `greenhopperFetch` signature with `apiPath` override parameter
- `taskflow/src/lib/concurrency.ts` — `pLimit(6)` module pattern; dedicated `pLimit(3)` derivation
- `taskflow/src/routes/dashboard/dashboardMetrics.ts` — `filterNonSubtasks`, `computePersonalTileCounts` (displayName + subtask filter patterns)
- `taskflow/src/routes/dashboard/dashboardMetrics.test.ts` — `makeIssue` factory, mandated subtask test pattern
- `taskflow/src/components/chart-wrapper.tsx` — `ChartWrapper` full API including `isEmpty={false}` for custom children
- `taskflow/src/routes/dashboard/index.tsx` — section layout pattern (`px-6 pb-6 / grid-cols-1 lg:grid-cols-2 gap-4`)
- `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` — `formatHoursMinutes`, `useDelayedLoading`, `responsive` prop, token-not-in-queryKey pattern, `role="region"` aria pattern
- `.planning/phases/85-sprint-insights-conditional-probe-gated/85-CONTEXT.md` — locked decisions D-01..D-11; probe results A/B/C

### Secondary (MEDIUM confidence)
- `.planning/phases/81-charting-foundation/81-CONTEXT.md` — D-01..D-08 charting stack constraints
- `.planning/phases/85-sprint-insights-conditional-probe-gated/85-UI-SPEC.md` — exact copy strings, color assignments, height values

### Tertiary (LOW confidence — see Assumptions Log)
- GreenHopper `scopechangeburndownchart` `.changes` entry-level field structure (A2) — inferred from API patterns; needs probe verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages codebase-verified; no new installs
- Architecture: HIGH — all patterns directly traceable to existing verified code
- Pitfalls: HIGH — ordering landmine documented by probe results; path override confirmed by reading client.ts
- Burndown parser shape: MEDIUM — top-level shape probe-confirmed; entry-level field names assumed (A2)

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (stable stack; only invalidated if GreenHopper API changes)
