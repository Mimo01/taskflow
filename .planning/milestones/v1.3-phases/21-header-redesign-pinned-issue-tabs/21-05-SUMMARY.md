---
phase: 21-header-redesign-pinned-issue-tabs
plan: 05
subsystem: ui
tags: [keyboard-navigation, react-router, outlet-context, j-k-navigation]

# Dependency graph
requires:
  - phase: 21-header-redesign-pinned-issue-tabs
    provides: "useListNavigation hook, IssueDetailSheet with selectedIssueKey state"
provides:
  - "selectedIssueKey available to all child routes via outlet context"
  - "J/K navigation disabled when IssueDetailSheet is open in all list views"
  - "/notifications route in router config"
affects: [22-polish-empty-states-error-recovery]

# Tech tracking
tech-stack:
  added: []
  patterns: ["outlet context for global state sharing to child routes"]

key-files:
  created: []
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/notifications/index.tsx

key-decisions:
  - "selectedIssueKey passed via outlet context (not React context) to stay consistent with existing prop-threading pattern"

patterns-established:
  - "Outlet context guard pattern: useListNavigation enabled condition includes !selectedIssueKey to suppress keyboard nav when detail sheet is open"

requirements-completed: [KEYS-04, KEYS-05, KEYS-06]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 21 Plan 05: J/K Navigation Fix + Notifications Route Summary

**J/K keyboard navigation disabled when IssueDetailSheet is open across all list views, /notifications route added to router**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T12:16:01Z
- **Completed:** 2026-03-16T12:18:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- selectedIssueKey exposed via outlet context so all child routes can detect when detail sheet is open
- J/K navigation guards added to MyTasksTab, BacklogPage, and NotificationsPage (UAT Test 7 fix)
- /notifications route added to router config with NotificationsPage component (UAT Test 8 fix)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add selectedIssueKey to outlet context + /notifications route** - `2b00e70` (feat)
2. **Task 2: Disable J/K navigation when detail sheet is open in all list views** - `dc1f293` (fix)

## Files Created/Modified
- `taskflow/src/main.tsx` - Added selectedIssueKey to Outlet context, NotificationsPage import, /notifications route
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` - Consume selectedIssueKey, guard useListNavigation enabled
- `taskflow/src/routes/dashboard/BacklogPage.tsx` - Consume selectedIssueKey, guard useListNavigation enabled
- `taskflow/src/routes/notifications/index.tsx` - Add useOutletContext, consume selectedIssueKey, guard useListNavigation enabled

## Decisions Made
- selectedIssueKey passed via outlet context (consistent with existing prop-threading pattern, no createContext)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All UAT gap closure plans (04, 05, 06) can be verified
- Phase 22 (Polish - Empty States + Error Recovery) ready to begin

## Self-Check: PASSED

- All 4 modified files exist on disk
- Commit 2b00e70 (Task 1) verified in git log
- Commit dc1f293 (Task 2) verified in git log

---
*Phase: 21-header-redesign-pinned-issue-tabs*
*Completed: 2026-03-16*
