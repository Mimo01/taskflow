---
phase: 08-dashboard-enrichment
plan: "07"
subsystem: ui
tags: [react, tanstack-query, defensive-guards, array-isarray]

# Dependency graph
requires:
  - phase: 08-dashboard-enrichment
    provides: MyTasksTab with project MR fetching via fetchProjectMRs
provides:
  - MyTasksTab hardened against non-array data from Jira and GitLab APIs
affects: [my-tasks route, SubtasksPanel "View all in My Tasks" link, UAT test 6]

# Tech tracking
tech-stack:
  added: []
  patterns: [Array.isArray guard over ?? [] for API response spread/iteration]

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/MyTasksTab.tsx

key-decisions:
  - "Array.isArray(data) ? data : [] preferred over data ?? [] — rejects non-array objects like {} that pass null check but throw when iterated"
  - "Array.isArray(projectMrs) guard on spread — fetchProjectMRs may return {} on network/parse failure causing spread throw"

patterns-established:
  - "Pattern: Use Array.isArray() not ?? [] when spreading/iterating values that come from async API responses — defends against object-shaped error returns"

requirements-completed: [DASH-01]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 08 Plan 07: MyTasksTab Non-Array Guard Summary

**Two surgical Array.isArray guards preventing `{} is not iterable` crashes in MyTasksTab when Jira or GitLab APIs return non-array objects**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T11:59:54Z
- **Completed:** 2026-03-13T12:02:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed `sprintIssueKeySet` useMemo to use `Array.isArray(data)` guard — prevents crash when Jira sprint issues query returns `{}` instead of array
- Fixed `projectMrs` spread to use `Array.isArray(projectMrs)` guard — prevents crash when `fetchProjectMRs` returns `{}` on network/parse failure
- Confirmed pre-existing test failure ("renders skeleton when isLoading") was unrelated to these changes and present before this fix

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden MyTasksTab against non-array data shapes** - `baf680a` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` - Two targeted line edits: Array.isArray guards on sprintIssueKeySet and projectMrs

## Decisions Made
- `Array.isArray(data) ? data : []` over `data ?? []` — the null-coalescing operator only guards null/undefined; non-array objects like `{}` still pass and cause `new Set({})` to throw "is not iterable"
- `Array.isArray(projectMrs) ? projectMrs : []` on spread — spreading a non-iterable object throws; guard ensures spread always receives an array even on API failure

## Deviations from Plan

None - plan executed exactly as written. Pre-existing failing test ("renders skeleton when isLoading") confirmed out-of-scope via git stash verification — it fails identically before and after this fix.

## Issues Encountered
- One pre-existing test failure in MyTasksTab.test.tsx: "renders skeleton when isLoading" — this test checks synchronously for skeleton divs, but the query only enables after the async `readSecret` effect resolves, so skeletons don't render synchronously. Confirmed pre-existing via git stash. Not introduced by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MyTasksTab crash fixed — UAT test 6 ("View all in My Tasks" navigation) should no longer throw
- Dashboard enrichment phase 08 complete through plan 07

---
*Phase: 08-dashboard-enrichment*
*Completed: 2026-03-13*
