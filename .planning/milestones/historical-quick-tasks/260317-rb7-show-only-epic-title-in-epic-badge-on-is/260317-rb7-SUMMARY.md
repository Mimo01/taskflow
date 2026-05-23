---
phase: quick
plan: 260317-rb7
subsystem: ui
tags: [epic-badge, issue-detail, sidebar]

provides:
  - "Epic badge shows only title, no key/ID prefix"
affects: [issue-detail-sidebar]

key-files:
  modified:
    - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx

key-decisions:
  - "Display epicName with fallback to epicLink (key) -- single expression replaces two-span layout"

requirements-completed: []

duration: 1min
completed: 2026-03-17
---

# Quick 260317-rb7: Show Only Epic Title in Epic Badge Summary

**Epic badge on issue detail sidebar simplified to show only epic title, falling back to epic key when no name available**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-17T18:42:06Z
- **Completed:** 2026-03-17T18:43:03Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Removed epic key/ID span from epic badge rendering
- Epic badge now shows only the epic title for cleaner display
- Falls back to epic key if no epic name is available

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove epic ID from epic badge, show title only** - `7010b71` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/IssueDetailSidebar.tsx` - Simplified epic badge to show only title text

## Decisions Made
- Single `{epicName || epicLink}` expression replaces the two-span layout (opacity-70 key span + conditional name span) for cleaner code and UI

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Plan: quick/260317-rb7*
*Completed: 2026-03-17*
