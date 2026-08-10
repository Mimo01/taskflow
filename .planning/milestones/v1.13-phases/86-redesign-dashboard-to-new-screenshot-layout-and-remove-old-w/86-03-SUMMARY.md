---
phase: 86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w
plan: "03"
subsystem: ui
tags: [react, tanstack-query, dashboard, vitest, biome]

# Dependency graph
requires:
  - phase: 86-01
    provides: MyIssuesCard component with TanStack Query cache integration
  - phase: 86-02
    provides: UpcomingReleasesTimeline + HoursCommitsChart components
provides:
  - index.tsx rewritten to 3-region layout composing the 3 new Phase 86 components
  - D-13 sprint-day subline (Day X of N) in dashboard hero, hidden when no active sprint
  - 12 old Phase 83-85 widget files deleted from the dashboard subtree
  - 4 orphaned service helpers removed (fetchClosedSprints, fetchSprintIssuesBySprintId, fetchBurndown, getVelocityLimit)
  - dashboardMetrics.ts slimmed to 2 survivors (filterNonSubtasks, formatHoursMinutes)
  - widget-removal.guard.test.ts extended with Phase 86 block (12 fs-absence + 1 import-absence)
affects: [87-dashboard-uat, future-dashboard-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - D-01 clean-slate: delete all Phase 83-85 widgets atomically; no incremental deprecation
    - D-13: Sprint-day subline via Date.UTC arithmetic on activeSprint.startDate/endDate; hidden when null
    - D-16: auth values loaded once in index.tsx (userAccountId, currentUser), passed as props to child cards
    - widget-removal.guard.test.ts: fs.existsSync absence assertions per phase, pattern for permanent ratchet

key-files:
  created: []
  modified:
    - src/routes/dashboard/index.tsx
    - src/routes/dashboard/index.test.tsx
    - src/routes/dashboard/dashboardMetrics.ts
    - src/routes/dashboard/dashboardMetrics.test.ts
    - src/routes/dashboard/widget-removal.guard.test.ts
    - src/services/jira.ts
    - src/services/jira/greenhopper/burndown.ts
    - src/services/jira/greenhopper/index.ts
    - src/lib/concurrency.ts
    - src/components/app/Sidebar.tsx

key-decisions:
  - "D-01 clean slate: deleted 12 files atomically (7 widget .tsx + 5 test files); no coexistence period"
  - "burndown.ts emptied to a comment (not deleted) to preserve type exports in types.ts; barrel export in greenhopper/index.ts removed"
  - "D-13 uses inline Date.UTC arithmetic in index.tsx to avoid adding a new dashboardMetrics export"
  - "Sidebar.tsx comment updated to name HoursCommitsChart and sprint-day subline as beneficiaries of the D-10 cache warm-up"

patterns-established:
  - "widget-removal.guard pattern: add a new describe block per phase rather than modifying existing blocks — permanent ratchet against resurrection"

requirements-completed: []

# Metrics
duration: 90min
completed: 2026-06-15
---

# Phase 86 Plan 03: Integration Wave Summary

**Dashboard index.tsx fully rewritten to 3-region layout composing MyIssuesCard, UpcomingReleasesTimeline, HoursCommitsChart; all 12 Phase 83-85 widget files deleted and orphaned service helpers removed**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-06-15
- **Completed:** 2026-06-15
- **Tasks:** 3
- **Files modified:** 10 (+ 12 deleted)

## Accomplishments

- Rewrote `index.tsx` to compose only the 3 new Phase 86 components in a `grid grid-cols-1 lg:grid-cols-2 gap-4` top row + full-width chart row, with D-13 sprint-day subline in the hero (`· Sprint day X of N`, hidden when `activeSprint` is null)
- Deleted all 12 old widget files (StatTile, SprintHealthSection, WeeklyTrendChart, ActivityStrip, DashboardReleaseCard, VelocityChart, BurndownChart + their test files) and removed 4 orphaned service helpers; slimmed `dashboardMetrics.ts` to 2 survivors
- Extended `widget-removal.guard.test.ts` with a Phase 86 block (13 assertions: 12 fs-absence + 1 import-absence); all 2006 suite tests pass

## Task Commits

1. **Task 1: Rewrite index.tsx + index.test.tsx** - `c6ff6b33` (feat)
2. **Task 2: Delete 12 widgets + slim dashboardMetrics** - `16dd5f68` (feat)
3. **Task 3: Extend widget-removal.guard** - `35bbc4e0` (test)

## Files Created/Modified

- `src/routes/dashboard/index.tsx` — fully rewritten: 3-region layout, D-13 subline, `'use no memo'`, no old widget imports
- `src/routes/dashboard/index.test.tsx` — fully rewritten: 8 Phase 86 tests (3-region presence, D-13 with/without sprint, hero greeting, text-4xl class)
- `src/routes/dashboard/dashboardMetrics.ts` — slimmed to 2 exports: `filterNonSubtasks`, `formatHoursMinutes`
- `src/routes/dashboard/dashboardMetrics.test.ts` — slimmed to match survivors only
- `src/routes/dashboard/widget-removal.guard.test.ts` — Phase 86 describe block added (13 new assertions)
- `src/services/jira.ts` — removed `fetchBurndown` re-export, removed `fetchClosedSprints` + `fetchSprintIssuesBySprintId` definitions
- `src/services/jira/greenhopper/burndown.ts` — emptied to a comment (function body removed)
- `src/services/jira/greenhopper/index.ts` — removed `export * from './burndown'` barrel line
- `src/lib/concurrency.ts` — removed `getVelocityLimit` + `velocityLimit` constant
- `src/components/app/Sidebar.tsx` — updated active-sprint prefetch comment to name Phase 86 beneficiaries

**Deleted files (12 total):**
- `src/routes/dashboard/StatTile.tsx`, `StatTile.test.tsx`
- `src/routes/dashboard/SprintHealthSection.tsx`, `SprintHealthSection.test.tsx`
- `src/routes/dashboard/WeeklyTrendChart.tsx`, `WeeklyTrendChart.test.tsx`
- `src/routes/dashboard/ActivityStrip.tsx`, `ActivityStrip.test.tsx`
- `src/routes/dashboard/DashboardReleaseCard.tsx`, `DashboardReleaseCard.test.tsx`
- `src/routes/dashboard/VelocityChart.tsx`
- `src/routes/dashboard/BurndownChart.tsx`

## Decisions Made

- `burndown.ts` was emptied to a comment rather than deleted. The `GreenHopperBurndown` and `BurndownChangeEntry` types used by other modules live in `types.ts`, not `burndown.ts`. Emptying + removing its barrel export was the minimal correct change.
- D-13 sprint-day arithmetic is inline in `index.tsx` (not a helper function) to avoid adding a third export to the already-slimmed `dashboardMetrics.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed burndown.ts barrel export after emptying the file**
- **Found during:** Task 2 (delete orphaned helpers)
- **Issue:** After removing `fetchBurndown` from `burndown.ts`, the file became an empty comment — not a module. The barrel `export * from './burndown'` in `greenhopper/index.ts` caused `TS2306: File is not a module`.
- **Fix:** Removed `export * from './burndown'` from `greenhopper/index.ts`; replaced with a comment explaining the removal.
- **Files modified:** `src/services/jira/greenhopper/index.ts`
- **Verification:** `npm run check` passed with 0 errors.
- **Committed in:** `16dd5f68` (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed Biome formatting error in index.test.tsx**
- **Found during:** Task 1 (after writing index.test.tsx)
- **Issue:** Trailing spaces on the `endDate` comment line triggered Biome formatter (`x Formatter would have printed the following content`). The Edit tool couldn't match the string due to special whitespace characters.
- **Fix:** Used Python string replacement to normalize the trailing spaces to a single space.
- **Files modified:** `src/routes/dashboard/index.test.tsx`
- **Verification:** `npm run check` passed with 0 errors/warnings (excluding 17 pre-existing `noNonNullAssertion` warnings in `MyTasksPage.tsx`).
- **Committed in:** `c6ff6b33` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

- **No node_modules in worktree:** Running `npm run test` from the worktree directory failed with vitest not found. Resolved by symlinking from the main project: `ln -s /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules .../taskflow/node_modules`. This is the documented pattern from 86-01-SUMMARY.md.
- **First test run hit old test file:** Running tests from main project dir picked up the old `index.test.tsx` (12 tests). After the symlink, tests ran from the worktree correctly (8 new tests).

## Known Stubs

None — all 3 new Phase 86 components (MyIssuesCard, UpcomingReleasesTimeline, HoursCommitsChart) are fully implemented with real data sources in Plans 86-01 and 86-02.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

All task commits verified:
- `c6ff6b33` (Task 1) — confirmed in git log
- `16dd5f68` (Task 2) — confirmed in git log
- `35bbc4e0` (Task 3) — confirmed in git log

Key files confirmed present on filesystem:
- `src/routes/dashboard/index.tsx` — exists
- `src/routes/dashboard/widget-removal.guard.test.ts` — exists
- `src/routes/dashboard/dashboardMetrics.ts` — exists (2 exports only)

Key files confirmed absent (deletions verified):
- StatTile.tsx, SprintHealthSection.tsx, WeeklyTrendChart.tsx, ActivityStrip.tsx, DashboardReleaseCard.tsx, VelocityChart.tsx, BurndownChart.tsx — all deleted in `16dd5f68`

## Next Phase Readiness

- Dashboard integration wave complete: index.tsx, all 3 cards, and 12 widget deletions committed
- Full test suite: 2006 passed / 2 skipped / 0 failures
- Ready for Phase 86 UAT checkpoint (visual + functional verification against new screenshot layout)

---
*Phase: 86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w*
*Completed: 2026-06-15*
