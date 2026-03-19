---
phase: 22-polish-empty-states-error-recovery
plan: 03
subsystem: ui
tags: [empty-state, error-state, stale-data-banner, notifications, command-palette, lucide-react]

# Dependency graph
requires:
  - phase: 22-polish-empty-states-error-recovery
    plan: 01
    provides: EmptyState, ErrorState, StaleDataBanner shared components and ApiError class
provides:
  - WorkloadTab, ReleasesTab, EpicsPage retrofitted with shared empty/error/stale components
  - NotificationPopover error propagation via store (fetchError + retryFetch)
  - CommandPalette SearchX empty state for no-results
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [store-level error propagation for polling hooks, bannerDismissed state pattern for StaleDataBanner reset]

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/routes/dashboard/EpicsPage.tsx
    - taskflow/src/stores/notifications.store.ts
    - taskflow/src/hooks/useNotificationPolling.ts
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/components/app/CommandPalette.tsx

key-decisions:
  - "EpicsPage Create Epic CTA reuses existing setCreateOpen(true) handler rather than adding new function"
  - "NotificationPopover error propagation via store (not prop threading) since polling hook is separate from popover"
  - "CommandPalette uses inline SearchX JSX (not EmptyState component) because CommandEmpty is a cmdk primitive with its own visibility logic"
  - "StaleDataBanner shown only when isError && data exists (cached data still useful); full ErrorState when isError && no data"

patterns-established:
  - "bannerDismissed pattern: useState(false) + useEffect reset on isError change for StaleDataBanner"
  - "Store error propagation: polling hook writes fetchError/retryFetch to store, consumer reads from store"

requirements-completed: [POLISH-01, POLISH-02, POLISH-03]

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 22 Plan 03: Remaining Views Retrofit Summary

**Replaced inline empty/error JSX in WorkloadTab, ReleasesTab, EpicsPage, NotificationPopover, and CommandPalette with shared EmptyState/ErrorState/StaleDataBanner components, completing the full 10-view sweep**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-16T17:29:36Z
- **Completed:** 2026-03-16T17:36:07Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- WorkloadTab, ReleasesTab, EpicsPage now use shared EmptyState (with per-view icons: Users, Package, Layers) and ErrorState with StaleDataBanner
- EpicsPage isError/error/refetch properly destructured from useQuery (was previously missing)
- NotificationPopover reads fetchError from store for error display with retry capability
- CommandPalette search uses SearchX icon in CommandEmpty for polished no-results state
- All 10 data views in the app now have consistent empty/error/stale states

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace empty/error states in WorkloadTab, ReleasesTab, EpicsPage** - `b1adb8a` (feat)
2. **Task 2: NotificationPopover error propagation + CommandPalette search empty state** - `25e8e96` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/WorkloadTab.tsx` - EmptyState(Users) + ErrorState + StaleDataBanner integration
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` - EmptyState(Package) + ErrorState + StaleDataBanner integration
- `taskflow/src/routes/dashboard/EpicsPage.tsx` - Added isError/error/refetch to useQuery, EmptyState(Layers) with Create Epic CTA
- `taskflow/src/stores/notifications.store.ts` - Added fetchError/retryFetch transient fields and actions
- `taskflow/src/hooks/useNotificationPolling.ts` - Captures query result, propagates error/refetch to store
- `taskflow/src/routes/notifications/NotificationPopover.tsx` - EmptyState(Bell) + ErrorState via store fetchError
- `taskflow/src/components/app/CommandPalette.tsx` - SearchX icon in CommandEmpty for no-results state

## Decisions Made
- EpicsPage Create Epic CTA reuses existing setCreateOpen(true) handler
- NotificationPopover uses store-level error propagation (not prop threading) since polling hook and popover are decoupled
- CommandPalette uses inline SearchX JSX instead of EmptyState component to avoid breaking cmdk visibility logic
- StaleDataBanner only shown when error + cached data exists; full ErrorState when error + no cached data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test assertions for new empty state text**
- **Found during:** Task 1 (WorkloadTab + ReleasesTab retrofit)
- **Issue:** WorkloadTab.test.tsx expected "No sprint data available", ReleasesTab.test.tsx expected "No fix versions configured"
- **Fix:** Updated to "No workload data" and "No releases found" respectively
- **Files modified:** taskflow/src/routes/dashboard/WorkloadTab.test.tsx, taskflow/src/routes/dashboard/ReleasesTab.test.tsx
- **Verification:** All 40 tests pass across 3 test files
- **Committed in:** b1adb8a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug - test assertion text mismatch)
**Impact on plan:** Necessary test update for new component text. No scope creep.

## Issues Encountered
- SprintProgressTab.test.tsx has 1-2 flaky tests in full suite run (pre-existing, unrelated to plan scope -- intermittent timing issue)
- notifications.test.ts shows "Unhandled Rejection" from Tauri LazyStore hydration in jsdom (pre-existing, all 15 tests pass)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 10 data views now use shared EmptyState/ErrorState/StaleDataBanner
- POLISH-01 (empty states), POLISH-02 (error states), POLISH-03 (auth error Reconnect CTA) are complete
- Phase 22 is fully complete (Plans 01, 02, 03)

---
*Phase: 22-polish-empty-states-error-recovery*
*Completed: 2026-03-16*
