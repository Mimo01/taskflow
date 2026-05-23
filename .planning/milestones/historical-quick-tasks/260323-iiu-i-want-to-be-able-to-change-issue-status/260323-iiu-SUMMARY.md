---
phase: quick-260323-iiu
plan: 01
subsystem: ui
tags: [react, jira, transitions, popover, optimistic-update, react-query]

requires:
  - phase: jira-transitions-service
    provides: fetchTransitions and postTransition API functions
provides:
  - Interactive status change from issue detail sidebar via Jira transitions API
affects: [issue-detail, sprint-board, my-tasks]

tech-stack:
  added: []
  patterns: [lazy-fetch-on-popover-open, dedicated-mutation-for-different-endpoint]

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx

key-decisions:
  - "Used dedicated useMutation for transitions instead of shared useFieldMutation (different API endpoint: POST /transitions vs PUT /issue)"
  - "Lazy-load transitions only when popover opens (enabled: statusOpen) with 30s staleTime"

patterns-established:
  - "Transition popover pattern: useQuery enabled on open + dedicated useMutation with optimistic update"

requirements-completed: [STATUS-CHANGE]

duration: 2min
completed: 2026-03-23
---

# Quick Task 260323-iiu: Change Issue Status Summary

**Clickable status badge in issue detail sidebar with Jira transition popover and optimistic updates**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T12:23:29Z
- **Completed:** 2026-03-23T12:25:07Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Status badge in issue detail sidebar is now clickable, opening a popover with available Jira transitions
- Transitions are lazy-fetched from Jira API when popover opens (30s stale time)
- Selecting a transition fires POST to Jira transitions API with optimistic UI update
- On failure, status reverts to previous value with inline error message
- Invalidates sprint-board, my-tasks, and transitions queries on settle

## Task Commits

Each task was committed atomically:

1. **Task 1: Add status transition popover to FieldsSection** - `f6661f8` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` - Added status transition popover with useQuery for fetching transitions, dedicated useMutation with optimistic update/rollback, and Popover UI replacing static Badge

## Decisions Made
- Used dedicated useMutation for transitions instead of shared useFieldMutation hook (transitions use POST /transitions endpoint, not PUT /issue)
- Lazy-load transitions only when popover opens to avoid unnecessary API calls
- 30s staleTime on transitions query to avoid refetching on rapid open/close

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all data is wired to live Jira API calls.

---
*Quick task: 260323-iiu*
*Completed: 2026-03-23*
