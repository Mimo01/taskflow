---
phase: 260615-smu-modernize-dashboard
plan: 01
subsystem: ui
tags: [react, tailwind, dashboard, card, chart-wrapper, visual-polish]

# Dependency graph
requires:
  - phase: 83-85 (Dashboard build-out)
    provides: Dashboard sections (StatTile, SprintHealthSection, ActivityStrip, DashboardReleaseCard, ChartWrapper, index shell)
provides:
  - Dashboard restyled onto the shared <Card> primitive (rounded-xl + ring)
  - ChartWrapper modernized to the Card surface + a bare variant for in-Card charts
  - MyTasksPage-style bold-title + date-subtitle header (ambient SVG removed)
  - Unified single-gutter page shell (px-6 py-4 gap-4) replacing per-row gutters
affects: [dashboard, ui-consistency, future-card-adopters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ChartWrapper bare variant: drop container chrome when nested inside a <Card> to avoid double border/padding"
    - "Forward role/aria-label through <Card> via ...props (a11y region preserved without a wrapper div)"
    - "Skeleton geometry mirrors the loaded Card surface (rounded-xl + ring) to prevent layout jump"

key-files:
  created: []
  modified:
    - taskflow/src/components/chart-wrapper.tsx
    - taskflow/src/routes/dashboard/StatTile.tsx
    - taskflow/src/routes/dashboard/SprintHealthSection.tsx
    - taskflow/src/routes/dashboard/ActivityStrip.tsx
    - taskflow/src/routes/dashboard/DashboardReleaseCard.tsx
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/routes/dashboard/index.test.tsx

key-decisions:
  - "Modernize ChartWrapper's own container to the Card look + add a bare variant, instead of nesting ChartWrapper inside a Card (avoids double border/padding)"
  - "Forward role/aria-label straight to <Card> via ...props so StatTile/SprintHealthSection a11y regions survive the wrapper-div removal"
  - "Pre-existing aria-label-on-<p> biome warning in StatTile left as-is — plan mandated preserving the value <p aria-label> verbatim; npm run check still GREEN"

patterns-established:
  - "ChartWrapper bare prop: container-less rendering for charts living inside a Card"
  - "Dashboard sections compose Card + CardHeader/CardTitle/CardContent rather than raw rounded-lg border divs"

requirements-completed: [QUICK-260615-smu]

# Metrics
duration: ~12min
completed: 2026-06-15
---

# Phase 260615-smu Plan 01: Modernize Dashboard Summary

**Dashboard restyled onto the shared `<Card>` primitive (rounded-xl + ring), ChartWrapper modernized with a `bare` variant for in-Card charts, and the ambient-SVG hero replaced by the MyTasksPage bold-title + date header — all visual polish, zero behavior change.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-15T20:50Z (approx)
- **Completed:** 2026-06-15T20:56Z (approx)
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- ChartWrapper now uses the Card surface (`rounded-xl ring-1 ring-foreground/10`) for standalone chart sections (Velocity/Burndown/WeeklyTrend inherit it), plus a `bare` prop that drops all container chrome for in-Card use.
- All four non-chart sections (StatTile, SprintHealthSection, ActivityStrip, DashboardReleaseCard) render via the shared `<Card>` primitive; raw `rounded-lg border border-border` containers eliminated. Padding is now token-driven via `--card-spacing`.
- The SprintHealthSection donut ChartWrapper is `bare` inside its Card — fixing the pre-existing double-border that existed before this pass.
- Header replaced: ambient orange/blue SVG hero + `AMBIENT_CURVES` removed; new header mirrors MyTasksPage (`text-3xl font-semibold` greeting title, `text-xs text-muted-foreground` date, `border-b border-border/50`).
- Page shell consolidated to one `px-6 py-4 gap-4` content container; the four per-row `relative px-6 pb-6` gutters (and their no-op `relative`) are gone. Stat-tile loading skeleton geometry matches the new Card so there is no load-jump.

## Task Commits

Each task was committed atomically:

1. **Task 1: Modernize ChartWrapper container + add bare variant** - `537d048a` (feat)
2. **Task 2: Adopt Card for StatTile, SprintHealthSection, ActivityStrip, DashboardReleaseCard** - `cf2611b3` (feat)
3. **Task 3: Replace hero header, consolidate page shell, update SVG test** - `ee768fd9` (feat)

**Plan metadata:** handled by orchestrator (docs commit)

## Files Created/Modified
- `taskflow/src/components/chart-wrapper.tsx` - Card-surface container + `bare` prop for in-Card charts
- `taskflow/src/routes/dashboard/StatTile.tsx` - `<Card size="sm">` + CardContent; role/aria-label forwarded via props
- `taskflow/src/routes/dashboard/SprintHealthSection.tsx` - outer `<Card>` + CardContent; donut ChartWrapper now `bare`
- `taskflow/src/routes/dashboard/ActivityStrip.tsx` - `<Card>` with CardHeader/CardTitle + CardContent
- `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx` - `<Card>` with CardHeader/CardTitle (icon + label) + CardContent
- `taskflow/src/routes/dashboard/index.tsx` - MyTasksPage-style header, unified page shell, skeleton geometry match, AMBIENT_CURVES removed
- `taskflow/src/routes/dashboard/index.test.tsx` - Test 6 updated to assert the modern header (text-3xl) and no ambient `section svg`

## Decisions Made
- Modernize ChartWrapper's own container and add a `bare` variant rather than nesting ChartWrapper in a Card — keeps the three standalone chart sections on the Card look while letting the in-Card donut render chrome-less (no double border/ring/padding).
- Pass `role`/`aria-label` straight to `<Card>` (which spreads `...props`) so the StatTile and SprintHealthSection accessibility regions survive removing the bespoke wrapper div. Tests confirm `getByRole('region', { name })` still resolves.

## Deviations from Plan

None - plan executed exactly as written. All three tasks implemented per the locked CONTEXT.md decisions and the per-task action specs; no auto-fixes, no architectural changes, no behavior or interaction changes.

## Issues Encountered
- **Worktree base drift:** the worktree HEAD was created at an older commit (`c4e6d754`) than the expected base (`22179057`), so the target files were initially absent. `c4e6d754` is an ancestor of the base, so a forward `git reset --hard` to `22179057` (per the branch-check Step 2 intent) restored the correct tree. Resolved cleanly.
- **Missing worktree deps:** `taskflow/node_modules` did not exist in the worktree, breaking vitest config load. Symlinked the worktree's `taskflow/node_modules` to the main checkout's installed deps (node_modules is gitignored, so no tracked change). Tests then ran normally.

## Known Stubs
None - no placeholder/empty-data stubs introduced; this was a styling/layout pass over existing wired sections.

## Verification
- `cd taskflow && npm run check` (biome check + `tsc --noEmit`): exit 0 / GREEN. The 25 warnings are pre-existing, out-of-scope `noNonNullAssertion`/`useSemanticElements`/`useAriaPropsSupportedByRole` lint advisories (including the StatTile value `<p aria-label>` the plan required preserving verbatim). No new errors, no type errors.
- `cd taskflow && npx vitest run src/routes/dashboard/`: 625 passed, 2 skipped, 13 todo (39 test files passed). Includes StatTile, SprintHealthSection, index, DashboardReleaseCard, ActivityStrip, WeeklyTrendChart.
- Grep sanity: no `rounded-lg border border-border` remains in the five target files; all five `'use no memo';` directives intact.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dashboard now shares the app's visual language; `<Card>` has its first real adopters and ChartWrapper's `bare` variant is available for any future in-Card chart.
- No blockers. Suggest a human visual pass (light + dark mode) to confirm the ring-based Card look reads as intended versus the old border look.

## Self-Check: PASSED

All 7 modified source/test files exist and all 3 task commits (`537d048a`, `cf2611b3`, `ee768fd9`) are present in git history.

---
*Phase: 260615-smu-modernize-dashboard*
*Completed: 2026-06-15*
