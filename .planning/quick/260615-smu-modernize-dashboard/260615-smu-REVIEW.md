---
phase: 260615-smu-modernize-dashboard
reviewed: 2026-06-15T00:00:00Z
depth: quick
files_reviewed: 7
files_reviewed_list:
  - taskflow/src/components/chart-wrapper.tsx
  - taskflow/src/routes/dashboard/ActivityStrip.tsx
  - taskflow/src/routes/dashboard/DashboardReleaseCard.tsx
  - taskflow/src/routes/dashboard/SprintHealthSection.tsx
  - taskflow/src/routes/dashboard/StatTile.tsx
  - taskflow/src/routes/dashboard/index.test.tsx
  - taskflow/src/routes/dashboard/index.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 260615-smu: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** quick
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This was a visual-polish + light-restructure pass: adopt the `<Card>` primitive across non-chart dashboard sections, modernize the page header (drop the ambient-SVG hero for a MyTasksPage-style bold title), and add a `bare` variant to `ChartWrapper` so the donut chart can nest inside a `<Card>` without double chrome.

I verified the stated invariant first: **no behavior/logic changed.** All query keys (`['jira-issues','sprint-board',...]`, `['jira-active-sprint',...]`, `['standup','jira'/'commits'/'schedule',...]`, `['jira-fix-versions',...]`, `['jira-release-issues',...]`), `queryFn` bodies, `enabled` guards, `staleTime`s, and all metric calcs (`computePersonalTileCounts`, `computeSpDone`, `computeDonutData`, `getReleaseTimingLabel`, `donePct` guards) are byte-identical to the pre-pass versions. The diffs are JSX-container swaps only. The `'use no memo'` React Compiler opt-out is preserved on every file that had it (chart-wrapper, ActivityStrip, SprintHealthSection, StatTile, index.tsx); DashboardReleaseCard never carried it and still doesn't — consistent.

The real findings are a11y regressions introduced by the `<section>`/`<h2>` → `<Card>`/`CardTitle` swap, and a loading-skeleton geometry drift. No security issues; no logic defects.

## Warnings

### WR-01: ActivityStrip lost both its landmark role and its heading — `aria-label` is now orphaned

**File:** `taskflow/src/routes/dashboard/ActivityStrip.tsx:223-225`
**Issue:** The old markup was a `<section aria-label="Recent activity">` containing an `<h2>Recent activity</h2>`. The pass replaced this with `<Card aria-label="Recent activity">` + `<CardTitle>Recent activity</CardTitle>`. Two regressions stack here:

1. `Card` renders a plain `<div>` with **no implicit `role`** (verified in `card.tsx:5-21` — no `role` is set). An `aria-label` on a generic `<div>` with no role is non-conforming and is dropped by most screen readers, so the accessible name "Recent activity" no longer attaches to any landmark/region. By contrast, `StatTile` (`StatTile.tsx:34`) and `SprintHealthSection` (`SprintHealthSection.tsx:109`) correctly pass `role="region"` alongside the Card `aria-label` — so the `aria-label` there still works. ActivityStrip is the only one that dropped the role.
2. `CardTitle` is a `<div>` (`card.tsx:36`), not a heading. The `<h2>` was a real document-outline entry; it is now invisible to heading navigation.

**Fix:** Add `role="region"` to match the sibling sections, and restore heading semantics on the title:
```tsx
<Card role="region" aria-label="Recent activity">
  <CardHeader>
    <CardTitle asChild>
      {/* or render as a heading element */}
      <h2>Recent activity</h2>
    </CardTitle>
  </CardHeader>
```
If `CardTitle` does not support `asChild`, at minimum add `role="region"` to the `Card` so the existing `aria-label` is honored. (Note: `DashboardReleaseCard` never had a heading or region role pre-pass, so its lack of one is not a regression — but its `<Card>` likewise has no region role, so it is also an unnamed generic container; lower priority since it had no name before.)

### WR-02: StatTile loaded-vs-skeleton geometry drift can cause a layout jump (skeleton geometry mismatch)

**File:** `taskflow/src/routes/dashboard/index.tsx:166` vs `taskflow/src/routes/dashboard/StatTile.tsx:34-35`
**Issue:** The focus area explicitly called out skeleton-vs-loaded jump. The loading placeholder tile is hand-rolled in index.tsx as `rounded-xl ring-1 ring-foreground/10 bg-card p-3 min-h-[80px] flex flex-col gap-3`. The loaded tile is now `<Card size="sm" className="min-h-[80px] gap-2">` whose internal padding comes from the Card's CSS var (`--card-spacing: spacing(3)` for `size="sm"`, applied as `py-(--card-spacing)` on the Card plus `px-(--card-spacing)` on `CardContent`) and an **outer gap of `gap-2`** while `CardContent` adds `gap-3`. The skeleton uses a single flat `gap-3` and uniform `p-3`. The vertical rhythm therefore differs: the loaded Card has a `gap-2` between (nonexistent extra) children plus content `gap-3`, vs the skeleton's flat `gap-3`. In practice the loaded tile has only one CardContent child, so the outer `gap-2` is inert — but the padding model (`py`+`px` via Card/CardContent vs uniform `p-3` on the skeleton) is not guaranteed pixel-identical, and `rounded-xl` on the skeleton vs Card's `rounded-xl` matches, but ring vs Card ring matches. The likely-visible drift is the internal content padding: skeleton `p-3` on the outer box vs Card splitting padding between Card (`py`) and CardContent (`px`), which is equivalent only if both equal `spacing(3)`.
**Fix:** Render the skeleton through the same `<Card size="sm">`/`<CardContent>` shell (or a shared `StatTileSkeleton` that wraps the same Card) so geometry is structurally identical by construction rather than by hand-matched utility classes:
```tsx
<Card size="sm" className="min-h-[80px] gap-2" aria-busy="true">
  <CardContent className="flex flex-col gap-3">
    <Skeleton className="h-3 w-1/2" />
    <Skeleton className="h-7 w-1/3" />
  </CardContent>
</Card>
```
This also fixes WR-03's missing `aria-busy` on the tile skeleton.

### WR-03: Tile loading skeleton has no `aria-busy` / status semantics

**File:** `taskflow/src/routes/dashboard/index.tsx:161-173`
**Issue:** The stat-tile skeleton grid renders no `aria-busy` or live-region hint, so AT users get a silent empty grid during load. ActivityStrip's skeleton correctly sets `aria-busy="true"` (`ActivityStrip.tsx:230`); the tile skeleton and DashboardReleaseCard skeleton (`DashboardReleaseCard.tsx:86-92`) do not. This is pre-existing for the release card but the tile skeleton container was re-touched in this pass (class changed `rounded-lg border` → `rounded-xl ring-1`), so it is in scope.
**Fix:** Add `aria-busy="true"` to the skeleton grid container (folded into the WR-02 fix above).

## Info

### IN-01: `ChartWrapper` default container changed from `border` to `ring` — verify standalone charts still visually match

**File:** `taskflow/src/components/chart-wrapper.tsx:63`
**Issue:** The non-`bare` branch changed from `rounded-[var(--radius)] border border-border` to `rounded-xl ring-1 ring-foreground/10` to match the `<Card>` surface. This is intentional (the comment says so) and the donut uses `bare` so no double border occurs. But every *other* `ChartWrapper` consumer that does NOT pass `bare` (e.g. `WeeklyTrendChart`, `VelocityChart`, `BurndownChart` rendered as siblings of `<Card>`s in `index.tsx:208-267`) now has a `ring` instead of a `border` and `rounded-xl` instead of `var(--radius)`. Those files are out of this review's scope but share the surface; confirm the radius/edge now matches the adjacent `<Card>`s rather than diverging.
**Fix:** No change required if the visual intent was to unify on the Card surface (it was). Just confirm the non-bare consumers were visually re-checked, since this is a behavioral-CSS change to a shared primitive touched outside the listed files' render paths.

### IN-02: Donut center-label `pts` count and `aria-label` may briefly show stale `0` during the delayed-skeleton window

**File:** `taskflow/src/routes/dashboard/SprintHealthSection.tsx:154-183`
**Issue:** Not a regression (logic unchanged), but worth noting under the `bare` nesting: `isLoading={showSkeleton}` drives the ChartWrapper skeleton, yet the absolute-overlay center label (`{totalSP}` / `pts`) and the `ChartContainer` `aria-label` render unconditionally inside the children — they are not gated by `showSkeleton`. During the 200ms delayed-loading window before `showSkeleton` flips true, or when `showSkeleton` is true, the ChartWrapper body shows a `<Skeleton>` for the chart, but the overlaid `{totalSP}` text and the verbose `aria-label` still render on top with the pre-data value `0`. Visually the skeleton sits behind a "0 pts" label. This pre-dates the pass; the `bare` change did not alter it.
**Fix:** Optionally gate the center-label overlay on `!showSkeleton && !error` so the skeleton state reads cleanly. Cosmetic only.

### IN-03: `void onIssueClick` dead retention

**File:** `taskflow/src/routes/dashboard/index.tsx:143-144`
**Issue:** `onIssueClick` is pulled from outlet context and immediately discarded via `void onIssueClick` with a "retained for potential future drill-down" comment. This is pre-existing dead wiring (not introduced by this pass) but remains a code smell — the outlet context type also declares `onOpenIssue` which is never destructured. No action needed for this visual pass.
**Fix:** When a future phase adds drill-down, wire it; otherwise drop the unused destructure to reduce noise. Out of scope to change now.

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
