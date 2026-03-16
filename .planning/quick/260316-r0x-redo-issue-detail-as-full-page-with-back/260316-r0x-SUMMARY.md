---
phase: quick-260316-r0x
plan: 01
subsystem: ui
tags: [react-router, navigation, breadcrumb, issue-detail]

requires:
  - phase: 21-header-redesign-pinned-issue-tabs
    provides: PinnedTabStrip, IssueDetailSheet, outlet context pattern
provides:
  - Full-page issue detail route at /issue/:key
  - Back arrow + breadcrumb navigation from any entry point
  - Route-based active issue tracking for PinnedTabStrip
affects: [issue-detail, navigation, pinned-tabs]

tech-stack:
  added: []
  patterns: [location-state-based breadcrumb navigation, URL-derived active state]

key-files:
  created:
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx

key-decisions:
  - "Navigate with location.state.from for breadcrumb origin tracking"
  - "Derive activeIssueKey from URL pathname instead of React state"
  - "IssueDetailSheet file left on disk but removed from render tree"

requirements-completed: [QUICK-R0X]

duration: 3min
completed: 2026-03-16
---

# Quick Task 260316-r0x: Redo Issue Detail as Full Page Summary

**Full-page /issue/:key route with back arrow and breadcrumb navigation replacing 75vw slide-out sheet**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T18:34:25Z
- **Completed:** 2026-03-16T18:37:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created IssueDetailPage.tsx route component with back/breadcrumb header, full issue detail body, skeleton loading
- Rewired all issue click handlers to navigate to /issue/:key with location state carrying origin page info
- Removed IssueDetailSheet from AppLayout render tree; PinnedTabStrip now derives active key from URL
- Removed selectedIssueKey from outlet context and all consuming components (MyTasksTab, BacklogPage)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create IssueDetailPage route component** - `94687d6` (feat)
2. **Task 2: Rewire router and all entry points** - `6333799` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` - Full-page issue detail route with back arrow, breadcrumb, content + sidebar layout
- `taskflow/src/main.tsx` - Added /issue/:key route, converted handleIssueClick to navigate, removed IssueDetailSheet, added routeLabel helper
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` - Removed selectedIssueKey from outlet context destructuring
- `taskflow/src/routes/dashboard/BacklogPage.tsx` - Removed selectedIssueKey from outlet context destructuring

## Decisions Made
- Used location.state.from pattern for breadcrumb: handleIssueClick passes { path, label } via navigate state, IssueDetailPage reads it for back nav
- Derive activeIssueKey from location.pathname.startsWith('/issue/') instead of maintaining separate React state
- Left IssueDetailSheet.tsx file on disk (not deleted) since the plan said to consider deletion but not require it
- J/K list navigation enabled guard simplified: no longer needs selectedIssueKey check since navigating away unmounts the list component

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260316-r0x*
*Completed: 2026-03-16*
