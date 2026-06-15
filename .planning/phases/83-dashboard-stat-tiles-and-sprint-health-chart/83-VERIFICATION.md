---
phase: 83-dashboard-stat-tiles-and-sprint-health-chart
verified: 2026-06-15T13:24:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 83: Dashboard Stat Tiles and Sprint Health Chart — Verification Report

**Phase Goal:** The Dashboard replaces its previous 3-card grid with personal stat tiles and a sprint health chart — both derived from the already-warm sprint board cache with zero new API calls — while retaining the gradient hero greeting and the next-release countdown.
**Verified:** 2026-06-15T13:24:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dashboard no longer shows DashboardSprintCard, DashboardInProgressCard, or SmokeTestChart; gradient hero greeting + en-GB date and next-release countdown are retained | VERIFIED | Files confirmed absent on disk; `index.tsx` imports `DashboardReleaseCard`, retains `AMBIENT_CURVES`, `getTimeGreeting`, `en-GB` locale date; zero imports of deleted components |
| 2 | Personal stat tiles display Open / In Progress / Overdue / SP Done — all figures exclude subtasks from SP sums (unit-tested: parent 5 SP + 2 subtasks 2 SP each = 5, not 9) | VERIFIED | `dashboardMetrics.ts` uses `i.fields.issuetype.subtask` boolean; `dashboardMetrics.test.ts` line 72 asserts `computeSpDone([parent, sub1, sub2], SP_KEY).toBe(5)`; 22/22 tests green |
| 3 | Sprint health section shows days remaining + progress bar + points-by-status donut via ChartWrapper, CSS-var colors (not hardcoded hex), drawn from the warm `['jira-issues','sprint-board',...]` cache — no new network request fires on Dashboard load when cache is warm | VERIFIED | `SprintHealthSection.tsx` uses exact cache key `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` with `staleTime:30_000`; donut fills are `var(--chart-1..3)` only (no hex); active-sprint query enabled with `boardId != null` guard, deduplicating against Sidebar prefetch when warm; Sidebar `prefetchForPath` fires active-sprint for both `/sprint-board` and `/dashboard` via the shared `resolveBoardId` chain (Sidebar.tsx line 124) |
| 4 | Every Dashboard section has its own loading skeleton and error state; a slow/failed section does not blank adjacent sections (DASH-07) | VERIFIED | `index.tsx` tile row: `showTileSkeleton`→4 Skeleton tiles, `tileError`→`ErrorState`, data→4 `StatTile` (independent branches); `SprintHealthSection` passes `isLoading`/`error`/`isEmpty` to `ChartWrapper` independently; human UAT approved by user |

**Score:** 4/4 truths verified

### Note on active-sprint query change (UAT fix)

The plan specified `enabled:false` for the active-sprint `useQuery` in `SprintHealthSection`. During human UAT, this caused a false "No active sprint" empty state on cold load (Sidebar prefetch hadn't yet resolved `boardId`, so the cache entry was absent). The fix (commit `ca98232d`) changed `enabled` to `!!jiraBaseUrl && !!jiraToken && !!activeJiraProject && boardId != null`. This preserves DASH-03 (zero new API calls when cache is warm, because the key + staleTime deduplicate against the Sidebar prefetch), while self-healing on cold load. This is the correct behavior — the plan's `enabled:false` was a design decision that was superseded by the UAT finding. The DASH-03 "zero new API calls when warm" criterion is still met.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/routes/dashboard/dashboardMetrics.ts` | Pure derivation functions: 6 named exports, no React, CSS-var donut fills | VERIFIED | Exists, 122 lines, exports `filterNonSubtasks`, `computeSpDone`, `computeSpTotal`, `computePersonalTileCounts`, `computeDonutData`, `getDaysRemaining`, `DonutSegment`; no React import; fills are `var(--chart-1..3)` |
| `taskflow/src/routes/dashboard/dashboardMetrics.test.ts` | Unit tests including mandated subtask-exclusion fixture asserting 5 not 9 | VERIFIED | Line 72: `expect(computeSpDone([parent, sub1, sub2], SP_KEY)).toBe(5)`; 22/22 tests passing |
| `taskflow/src/routes/dashboard/StatTile.tsx` | Static display tile with `role="region"` | VERIFIED | Exists; `role="region"` and `aria-label={label}` on root; value `aria-label="${value} ${label}"`; no `role="button"`, no `cursor-pointer`, no `onClick` |
| `taskflow/src/routes/dashboard/SprintHealthSection.tsx` | Sprint days-remaining + progress + donut, warm-cache sourced | VERIFIED | Exists; sacred cache key present; `isAnimationActive={false}`; `<PieChart responsive>`; no `ResponsiveContainer`; no `queryClient.getQueryData` in render |
| `taskflow/src/routes/dashboard/index.tsx` | Rewritten Dashboard: hero + stat tiles + sprint health + release countdown | VERIFIED | Exists; imports `StatTile`, `SprintHealthSection`, `DashboardReleaseCard`, `computePersonalTileCounts`, `computeSpDone`; renders all four sections; grid `grid-cols-2 sm:grid-cols-4 gap-4` |
| `DashboardSprintCard.tsx` (deleted) | File does not exist | VERIFIED | Confirmed absent: `ls: No such file or directory` |
| `DashboardInProgressCard.tsx` (deleted) | File does not exist | VERIFIED | Confirmed absent: `ls: No such file or directory` |
| `SmokeTestChart.tsx` (deleted) | File does not exist | VERIFIED | Confirmed absent: `ls: No such file or directory` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Sidebar.tsx` | `['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId]` | `prefetchForPath('/dashboard')` shared `resolveBoardId` chain | VERIFIED | Line 124: `if (path === '/sprint-board' \|\| path === '/dashboard')`; line 147–156: `resolveBoardId.then(boardId => queryClient.prefetchQuery({queryKey:['jira-active-sprint',...],...}))` fires for both paths |
| `SprintHealthSection.tsx` | `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` | `useQuery staleTime:30_000` | VERIFIED | Exact cache key at line 66; `staleTime: 30_000` at line 69 |
| `SprintHealthSection.tsx` | `dashboardMetrics (computeDonutData/computeSpTotal/computeSpDone/getDaysRemaining)` | `import from './dashboardMetrics'` | VERIFIED | Lines 30–35 import all four functions; all are consumed in the render body |
| `index.tsx` | `computePersonalTileCounts / computeSpDone` | `import from './dashboardMetrics'` | VERIFIED | Line 16: `import { computePersonalTileCounts, computeSpDone } from './dashboardMetrics'`; consumed at lines 103, 111 |
| `index.tsx` | `StatTile / SprintHealthSection / DashboardReleaseCard` | component composition in route body | VERIFIED | Lines 15–18 imports; rendered at lines 167–213 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `index.tsx` stat tiles | `sprintIssues` | `useQuery` → `fetchSprintIssues` | Yes — live Jira API; derives `tileCounts` + `spDone` via `dashboardMetrics` | FLOWING |
| `SprintHealthSection.tsx` donut | `donutData` | `computeDonutData(sprintIssues, storyPointsFieldKey)` from warm cache | Yes — derived from live sprint-board cache | FLOWING |
| `SprintHealthSection.tsx` days remaining | `daysLeft` | `getDaysRemaining(activeSprint?.endDate)` from active-sprint cache/fetch | Yes — `fetchActiveSprint` query result | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| dashboardMetrics 22 tests pass | `npm run test -- dashboardMetrics --run` | 22/22 passed | PASS |
| StatTile 11 tests pass | `npm run test -- StatTile --run` | 11/11 passed | PASS |
| SprintHealthSection 10 tests pass | `npm run test -- SprintHealthSection --run` | 10/10 passed | PASS |
| dashboard/index 12 tests pass | `npm run test -- "dashboard/index" --run` | 12/12 passed | PASS |
| widget-removal guard 10/10 (Phase 83 block GREEN) | `npm run test -- widget-removal --run` | 10/10 passed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DASH-01 | 83-01, 83-03 | Dashboard keeps hero greeting + en-GB date, removes previous 3 cards | SATISFIED | Hero, `AMBIENT_CURVES`, en-GB locale confirmed in `index.tsx`; 3 card files deleted and absent on disk |
| DASH-02 | 83-01, 83-02, 83-03 | Personal stat tiles — open, in progress, overdue, SP Done | SATISFIED | 4 `StatTile` renders in `index.tsx`; metrics via `dashboardMetrics`; subtask exclusion unit-tested (5 not 9) |
| DASH-03 | 83-01, 83-02, 83-03 | Sprint health section with progress, days remaining, points-by-status chart | SATISFIED | `SprintHealthSection` renders days remaining + `Progress` + `PieChart` donut via `ChartWrapper`; warm-cache zero-new-calls preserved when Sidebar prefetch warmed the key |
| DASH-07 | 83-02, 83-03 | Each dashboard section degrades independently | SATISFIED | Tile row: own skeleton/`ErrorState` gates; `SprintHealthSection`: `ChartWrapper` handles `isLoading`/`error`/`isEmpty`; `EmptyState` for no active sprint; human UAT approved |

**Note on DASH-02 scope gap:** REQUIREMENTS.md DASH-02 mentions "MRs awaiting my review" and "hours logged this week vs schedule" tiles. The phase plan narrowed the scope to 4 tiles (Open/InProgress/Overdue/SP Done) and this is consistent with the phase goal statement and all PLAN must_haves. MR review queue (DASH-06) and hours trend (DASH-04) are deferred to Phase 84. This is not a gap for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

Scanned: `dashboardMetrics.ts`, `StatTile.tsx`, `SprintHealthSection.tsx`, `index.tsx`, `Sidebar.tsx`. No TBD/FIXME/XXX markers, no stub returns, no hardcoded empty arrays, no `queryClient.getQueryData` in render.

### Human Verification

Human UAT in a real Tauri WebKit build was performed and approved by the user (as noted in the phase context). One defect was found and fixed during UAT (SprintHealthSection false "No active sprint" on cold load — fixed in commit `ca98232d`). Two advisory warnings (WR-01 empty-state flash, WR-02 UTC-vs-local overdue date) were also addressed (commit `6e255d43`). Post-fix UAT confirmed:

1. Gradient hero greeting + en-GB date renders; next-release countdown is present.
2. Four stat tiles render (Open/In Progress/Overdue/SP Done); Overdue turns red when > 0; tiles are static (no hover/cursor/click).
3. Sprint Health section shows days-remaining copy, progress bar, and points-by-status donut in both light and dark themes; donut center shows total sprint SP.
4. No new `/sprint` or `/search` network request fires on Dashboard load when cache is warm.
5. Sections degrade independently.

### Gaps Summary

No gaps. All 4 must-have truths are VERIFIED, all required artifacts exist and are substantive and wired, all key links are confirmed, all test suites are green, and human UAT was approved by the user. The phase goal is achieved.

---

_Verified: 2026-06-15T13:24:00Z_
_Verifier: Claude (gsd-verifier)_
