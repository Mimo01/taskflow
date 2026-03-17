---
phase: quick
plan: 260317-uo1
subsystem: ui
tags: [notifications, navigation, popover, react]

requires:
  - phase: 22-polish-empty-states-error-recovery
    provides: NotificationPopover with error/empty states
provides:
  - Simplified notification popover with direct navigation only (no inline detail)
  - onClose prop for closing popover after navigation clicks
affects: [notifications, topbar]

tech-stack:
  added: []
  patterns: [direct-navigation-on-click, popover-close-on-navigate]

key-files:
  created: []
  modified:
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/components/app/TopBar.tsx
    - taskflow/src/routes/notifications/NotificationPopover.test.tsx
  deleted:
    - taskflow/src/routes/notifications/NotificationDetail.tsx

key-decisions:
  - "Removed inline NotificationDetail expand -- all clicks navigate directly to detail pages"
  - "Added onClose prop to NotificationPopover for popover dismissal after navigation"

patterns-established:
  - "Notification click = navigate + close popover (no inline detail panels)"

requirements-completed: []

duration: 3min
completed: 2026-03-17
---

# Quick Task 260317-uo1: Notification Popover Simplification Summary

**Removed inline NotificationDetail panel; all notification clicks now navigate directly to Jira issue or GitLab MR detail pages and close the popover**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T22:00:24Z
- **Completed:** 2026-03-17T22:02:55Z
- **Tasks:** 2
- **Files modified:** 3 (+ 1 deleted)

## Accomplishments
- Deleted NotificationDetail.tsx entirely -- no more inline detail expansion below notification rows
- All Jira notification clicks call onIssueClick and close the popover
- All GitLab notification clicks call onMRClick and close the popover
- Added onClose prop to NotificationPopover, wired through TopBar
- Updated tests to verify onClose is called on both Jira and GitLab notification clicks

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove inline NotificationDetail and simplify click handling** - `fb0531c` (feat)
2. **Task 2: Update notification tests for simplified behavior** - `6bc2a0a` (test)

## Files Created/Modified
- `taskflow/src/routes/notifications/NotificationPopover.tsx` - Removed useState/selectedItem, NotificationDetail import; added onClose prop; simplified handleRowClick
- `taskflow/src/components/app/TopBar.tsx` - Pass onClose={() => onNotifPopoverChange(false)} to NotificationPopover
- `taskflow/src/routes/notifications/NotificationPopover.test.tsx` - Added tests for onClose on Jira/GitLab clicks
- `taskflow/src/routes/notifications/NotificationDetail.tsx` - DELETED

## Decisions Made
- Removed inline NotificationDetail expand behavior entirely rather than keeping it as fallback
- onClose is optional prop (backward compatible) -- only fires when provided

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260317-uo1*
*Completed: 2026-03-17*
