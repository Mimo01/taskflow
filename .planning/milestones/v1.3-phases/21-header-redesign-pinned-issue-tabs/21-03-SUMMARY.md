---
phase: 21-header-redesign-pinned-issue-tabs
plan: 03
subsystem: ui
tags: [react, keyboard-navigation, pinned-tabs, lucide-react, zustand]

# Dependency graph
requires:
  - phase: 21-header-redesign-pinned-issue-tabs (Plan 01)
    provides: useListNavigation hook, pinned-tabs store
  - phase: 21-header-redesign-pinned-issue-tabs (Plan 02)
    provides: isPinned/onTogglePin props on IssueDetailSheet
provides:
  - Pin/Unpin button in IssueDetailContent header with visual state toggle
  - J/K keyboard navigation in My Tasks list
  - J/K keyboard navigation in Notifications list
  - J/K keyboard navigation in Backlog list (respects collapsed sections and filters)
affects: [22-polish-empty-states-error-recovery]

# Tech tracking
tech-stack:
  added: []
  patterns: [forwardRef on table row for scroll-into-view, ref map pattern for dynamic row refs]

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/IssueDetailSheet.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/notifications/index.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx

key-decisions:
  - "BacklogRow converted to React.forwardRef to support scrollIntoView from parent"
  - "Focus highlight uses bg-muted + border-l-2 border-primary + aria-current for all three views"
  - "Ref map pattern (useRef<Map<string, Element>>) used for dynamic row ref tracking"

patterns-established:
  - "Ref map pattern: useRef<Map<string, HTMLElement>>(new Map()) with callback ref for dynamic lists"
  - "Focus wrapper div: wrapping existing row components in a div with focus highlight class"

requirements-completed: [HEADER-02, KEYS-04, KEYS-05, KEYS-06]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 21 Plan 03: Pin Button + J/K Navigation Summary

**Pin button in issue detail header with filled/outline toggle, plus J/K keyboard navigation in My Tasks, Notifications, and Backlog views**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T11:25:03Z
- **Completed:** 2026-03-16T11:29:47Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Pin button added to IssueDetailContent header with outline (unpinned) and filled primary (pinned) visual states
- J/K navigation integrated in My Tasks via flatIssueKeys from parent/subtask grouping
- J/K navigation integrated in Notifications with Enter toggling accordion expand
- J/K navigation integrated in Backlog respecting collapsed sections and active filters
- All focused rows have bg-muted highlight with primary left border accent and aria-current attribute

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pin button to IssueDetailSheet and IssueDetailContent** - `2cbf9f0` (feat)
2. **Task 2: Integrate J/K navigation in My Tasks, Notifications, and Backlog** - `edeb3fc` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/IssueDetailSheet.tsx` - Wire isPinned/onTogglePin through to IssueDetailContent
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` - Pin button with fill-current toggle in action row
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` - J/K navigation with flatIssueKeys and focus wrapper divs
- `taskflow/src/routes/notifications/index.tsx` - J/K navigation with accordion Enter action
- `taskflow/src/routes/dashboard/BacklogPage.tsx` - J/K navigation with visibleIssueKeys respecting collapsed/filtered state
- `taskflow/src/routes/dashboard/BacklogRow.tsx` - Converted to forwardRef with isFocused prop

## Decisions Made
- BacklogRow converted to React.forwardRef to support scrollIntoView from BacklogPage parent
- Used ref map pattern (useRef<Map>) for dynamic row ref tracking across all three views
- Focus highlight applied via wrapper div in MyTasksTab/Notifications, via isFocused prop in BacklogRow (because BacklogRow renders a `<tr>`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All HEADER-02 and KEYS-04/05/06 requirements complete
- Phase 21 fully complete (Plans 01, 02, 03 all done)
- Ready for Phase 22 (Polish - Empty States + Error Recovery)

---
*Phase: 21-header-redesign-pinned-issue-tabs*
*Completed: 2026-03-16*
