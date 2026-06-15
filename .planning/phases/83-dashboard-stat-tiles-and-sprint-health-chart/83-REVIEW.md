---
phase: 83-dashboard-stat-tiles-and-sprint-health-chart
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/routes/dashboard/SprintHealthSection.tsx
  - taskflow/src/routes/dashboard/SprintHealthSection.test.tsx
  - taskflow/src/routes/dashboard/StatTile.tsx
  - taskflow/src/routes/dashboard/StatTile.test.tsx
  - taskflow/src/routes/dashboard/dashboardMetrics.ts
  - taskflow/src/routes/dashboard/dashboardMetrics.test.ts
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/routes/dashboard/index.test.tsx
  - taskflow/src/routes/dashboard/widget-removal.guard.test.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 83: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the Phase 83 dashboard stat-tiles and sprint-health-chart implementation: the
pure derivation module (`dashboardMetrics.ts`), two display components (`StatTile`,
`SprintHealthSection`), the dashboard container (`index.tsx`), the Sidebar prefetch
wiring, and four test files.

The derivation layer is clean, well-tested, and correctly excludes subtasks via the
boolean `issuetype.subtask` field (mandated criterion-2 gate passes). Components follow
the project's props-only / no-`useAuthStore`-in-children convention (D-16) and the
reactive-cache-read memory rule.

No BLOCKER-class defects (security, data loss, crash) were found. However there are
several correctness WARNINGS: a false "No active sprint" empty-state flash on cold load,
a UTC-vs-local timezone mismatch in the overdue calculation that produces an off-by-one
near midnight, and a cold-start cache-key divergence between the Sidebar prefetch and
the live SprintHealthSection query that defeats the zero-network-call design goal.

## Warnings

### WR-01: "No active sprint" empty state flashes before data resolves on cold load

**File:** `taskflow/src/routes/dashboard/SprintHealthSection.tsx:93,114`
**Issue:** `showSkeleton = useDelayedLoading(isLoading)` returns `false` for the first
200ms of loading (by design — it suppresses skeleton flash on fast loads). The empty
state is gated only on `!showSkeleton && !activeSprint`. On a genuine cold load where
the active-sprint query is still in flight (`sprintLoading === true`, `activeSprint ===
undefined`), the first 200ms window satisfies `!showSkeleton && !activeSprint`, so the
component renders the "No active sprint" EmptyState before the real data arrives — a
visible wrong-state flash. The skeleton-suppression delay was meant to hide the loading
indicator, not to expose the empty state during loading.
**Fix:** Gate the empty state on the raw loading flag, not the delayed one:
```tsx
{!isLoading && !activeSprint && (
  <EmptyState ... />
)}
```
Keep `showSkeleton` for the skeleton-vs-content decision, but the "no data" branch must
never render while a query is still pending.

### WR-02: Overdue count uses UTC `today` against local Jira `duedate` — off-by-one near midnight

**File:** `taskflow/src/routes/dashboard/index.tsx:106`, `dashboardMetrics.ts:76-79`
**Issue:** `index.tsx` passes `new Date().toISOString().slice(0, 10)` as `today` — this
is the **UTC** calendar date. `duedate` from Jira is a floating local calendar date
(`YYYY-MM-DD`). The string comparison `duedate < today` therefore compares a local date
against a UTC date. For any user west of UTC during the local-evening window (e.g.
21:00 PST = 05:00 UTC next day), `today` rolls to tomorrow before the user's local day
ends, so an issue due "today" (local) is incorrectly counted as overdue. The
`dashboardMetrics.ts` docstring even claims "timezone-safe ISO slice", which is
inaccurate — `toISOString()` is explicitly UTC.
**Fix:** Compute the local calendar date instead of the UTC one:
```ts
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```
(or use `toLocaleDateString('en-CA')` which yields `YYYY-MM-DD` in local time). Then
correct the docstring at `dashboardMetrics.ts:59`.

### WR-03: Cold-start boardId divergence defeats the zero-network-call prefetch design

**File:** `taskflow/src/components/app/Sidebar.tsx:128-156`, `SprintHealthSection.tsx:80-90`
**Issue:** The active-sprint cache key includes `boardId`
(`['jira-active-sprint', project, baseUrl, boardId]`). When NO board id is stored for
the project, the Sidebar prefetch resolves it via `fetchBoardId` discovery
(`queryKey: ['jira-board-id', ...]`), while `SprintHealthSection` receives its `boardId`
from `useBoardId`, which runs its own `['jira-board-id', ...]` query. If the dashboard
mounts before the Sidebar's discovery `fetchQuery` resolves (or the user navigates
directly to `/dashboard` without hovering the nav link), `useBoardId` may still return
`null` at first render, so SprintHealthSection's active-sprint query is `enabled: false`
(guarded on `boardId != null`) and later fires with the resolved id under a *different*
key than the one Sidebar prefetched — or the prefetch keyed on a `boardId` that arrives
later. The net effect is the design goal ("zero new API calls on Dashboard load",
SprintHealthSection.tsx:73-78) is not guaranteed on a cold load: the active-sprint fetch
can fire fresh. This is a correctness/perf-contract gap, not a crash.
**Fix:** Ensure both paths key the prefetch and the live query on the same resolved
board id. Either have the Sidebar prefetch reuse the exact `useBoardId` resolution, or
have SprintHealthSection prefetch-on-its-own-boardId only once `boardId` is non-null and
accept that the warm-cache guarantee only holds when the stored board id exists. At
minimum, soften the docstring claim of "ZERO new network calls" since it only holds in
the stored-board-id path.

### WR-04: Progress bar / caption renders misleading 0% when sprint-issues query errors

**File:** `taskflow/src/routes/dashboard/SprintHealthSection.tsx:99-105,138-144`
**Issue:** When the `sprint-board` issues query errors, `sprintIssues` falls back to
`[]`, so `totalSP = 0` and `donePct = 0`. If `activeSprint` is present (warm from a
separate cache key), the active-sprint body still renders `<Progress value={0} />` and
"0% complete". The donut's `ChartWrapper` correctly surfaces the `error` via its
error>loading>empty precedence, but the progress bar directly above it shows a confident
"0% complete" that looks like real data rather than a failure. Mixed states (chart says
"error", bar says "0%") are misleading.
**Fix:** When `error` is truthy, suppress the progress bar/caption (or render an inline
error/placeholder) so the section does not present fabricated 0% progress alongside the
chart's error state. E.g. wrap the progress block in `{!error && ...}`.

### WR-05: Donut center always shows total points even while the chart wrapper shows error/empty

**File:** `taskflow/src/routes/dashboard/SprintHealthSection.tsx:148-182`
**Issue:** The donut center label (`totalSP` + "pts", lines 176-181) is rendered as an
absolute overlay *inside* `ChartWrapper`'s children. But `ChartWrapper` swaps its
children out for the Skeleton / ErrorState / EmptyState (it only renders `children` in
the success branch — see `chart-wrapper.tsx:35-44`). So the center label correctly
disappears on loading/error/empty. However, the `aria-label` on `ChartContainer`
(line 162) is computed from `donutData` regardless; with `isEmpty={totalSP === 0}` the
chart is replaced by EmptyState so the chart aria-label is also dropped — acceptable.
The real smell: the center-overlay markup and its `data-testid` live unconditionally in
the children tree and rely entirely on ChartWrapper's internal branch to hide them. If
ChartWrapper's precedence ever changes (it documents "callers should pass
mutually-exclusive flags"), the overlay would leak over an error/empty panel. This is
fragile coupling.
**Fix:** Make the center label's visibility explicit rather than implicit — render it
only when the chart body itself is shown:
```tsx
{!showSkeleton && !error && totalSP > 0 && (
  <div className="absolute inset-0 ...">...</div>
)}
```
so the overlay does not depend on ChartWrapper's internal branch order.

## Info

### IN-01: `computeDonutData` unknown-category fallback is silent and untested

**File:** `taskflow/src/routes/dashboard/dashboardMetrics.ts:96-102`
**Issue:** Issues with an unrecognized `statusCategory.key` (or a missing one, defaulted
to `'new'` at line 96) are silently bucketed into `new` / "todo". This is a reasonable
fallback but is undocumented in user-facing terms and has no test covering a genuinely
unknown key. A status mapped to an unexpected category would quietly inflate the "To Do"
slice.
**Fix:** Add a unit test asserting an issue with an unknown `statusCategory.key` lands in
the `todo` segment, to lock the documented fallback behavior.

### IN-02: `onIssueClick` destructured then discarded via `void`

**File:** `taskflow/src/routes/dashboard/index.tsx:43-46,110-111`
**Issue:** `onIssueClick` is pulled from `useOutletContext` and then explicitly discarded
with `void onIssueClick;` "for potential future drill-down". Dead wiring — the outlet
context type also declares `onOpenIssue` which is never read. Carrying unused context
couples the dashboard to a contract it does not use.
**Fix:** Drop the `onIssueClick`/`onOpenIssue` destructure until drill-down is actually
implemented, or add a TODO referencing the tracking item. Removing reduces the surface
that must stay in sync with the outlet provider.

### IN-03: Hardcoded hex stroke colors in ambient SVG bypass the CSS-var theme contract

**File:** `taskflow/src/routes/dashboard/index.tsx:130`
**Issue:** `stroke={c.color === 'orange' ? '#f97316' : '#06b6d4'}` hardcodes hex colors,
while the rest of Phase 83 deliberately uses CSS-var fills (`var(--chart-N)`) and the
donut test asserts "no hardcoded hex". The ambient curves are decorative, but the
hardcoded values won't adapt to theme changes and are inconsistent with the stated color
discipline. Note `#f97316` is also hardcoded in `Sidebar.tsx:299` for the brand "flow".
**Fix:** Promote these to CSS custom properties (e.g. `var(--ambient-orange)` /
`var(--ambient-blue)`) for theme consistency, or document that decorative ambient art is
intentionally exempt.

### IN-04: Weak test assertions in SprintHealthSection donut and StatTile onClick checks

**File:** `taskflow/src/routes/dashboard/SprintHealthSection.test.tsx:217-224`, `StatTile.test.tsx:62-68`
**Issue:** Two tests assert weakly. (1) The subtask-exclusion donut test wraps its real
assertion (`textContent === '5'`) in `if (donutCenter)` with a fallback that only checks
the chart rendered — if the testid element is ever removed or renamed, the test silently
passes without verifying the 5-not-9 invariant it claims to guard. (2) The
"no onClick handler" test queries `[onclick]` (an inline HTML attribute React never
emits), so it can never fail — it does not actually prove the absence of a click
handler. These give false confidence.
**Fix:** Make the donut test assert unconditionally on `donut-center-value` textContent
(the element is always rendered in the success path). For StatTile, the meaningful guard
is already covered by the `role="button"` / `cursor-pointer` assertions — drop the
no-op `[onclick]` check or replace it with a fireEvent-click-has-no-effect assertion.

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
