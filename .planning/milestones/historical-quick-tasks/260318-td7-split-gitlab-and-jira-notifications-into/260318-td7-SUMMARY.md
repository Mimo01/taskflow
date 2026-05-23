---
phase: quick-260318-td7
plan: 01
subsystem: ui
tags: [notifications, zustand, popover, topbar]

requires:
  - phase: 22-polish-empty-states-error-recovery
    provides: notification store with error/retry propagation
provides:
  - Source-specific unread count selectors (useJiraUnreadCount, useGitlabUnreadCount)
  - Source-filtered NotificationPopover via source prop
  - Two independent notification icons in TopBar with colored indicators
  - markAllReadBySource store action
affects: [notifications, topbar]

tech-stack:
  added: []
  patterns: [source-specific notification filtering, dual-popover pattern]

key-files:
  created: []
  modified:
    - taskflow/src/stores/notifications.store.ts
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/components/app/TopBar.tsx
    - taskflow/src/main.tsx
    - taskflow/src/routes/notifications/NotificationPopover.test.tsx
    - taskflow/src/components/app/TopBar.test.tsx

key-decisions:
  - "Orange dot indicator for Jira bell, purple dot for GitLab bell -- matches source branding colors"
  - "Cmd+Shift+N toggles Jira popover by default (primary notification source)"
  - "markAllReadBySource uses Set deduplication to avoid duplicate readIds"

requirements-completed: [QUICK-TD7]

duration: 3min
completed: 2026-03-18
---

# Quick Task 260318-td7: Split Notifications Summary

**Two separate notification bells in TopBar with orange (Jira) and purple (GitLab) indicators, each showing source-filtered popover with independent unread badges**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T20:12:39Z
- **Completed:** 2026-03-18T20:15:21Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Split single notification bell into two source-specific bells with colored dot indicators
- Each popover shows only its source's notifications with source-specific header
- Independent unread count badges per source
- Mark all read operates per-source, not globally
- Cmd+Shift+N toggles Jira notifications popover

## Task Commits

Each task was committed atomically:

1. **Task 1: Add source-specific selectors and split NotificationPopover by source** - `dceea4e` (feat)
2. **Task 2: Split TopBar bell into two source-specific notification icons** - `a7ba1b5` (feat)

## Files Created/Modified
- `taskflow/src/stores/notifications.store.ts` - Added useJiraUnreadCount, useGitlabUnreadCount selectors and markAllReadBySource action
- `taskflow/src/routes/notifications/NotificationPopover.tsx` - Added source prop, removed dual-source grouping logic, source-specific header
- `taskflow/src/components/app/TopBar.tsx` - Two bell icons with orange/purple indicators and independent popovers
- `taskflow/src/main.tsx` - Dual popover state (jiraNotifOpen, gitlabNotifOpen) replacing single notifPopoverOpen
- `taskflow/src/routes/notifications/NotificationPopover.test.tsx` - Updated tests with source prop
- `taskflow/src/components/app/TopBar.test.tsx` - Updated test props for dual-popover API

## Decisions Made
- Orange dot indicator for Jira bell, purple dot for GitLab bell -- matches source branding colors
- Cmd+Shift+N toggles Jira popover by default (primary notification source)
- markAllReadBySource uses Set deduplication to avoid duplicate readIds
- Kept existing useUnreadCount and markAllRead for backward compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated test files for new props**
- **Found during:** Task 1 and Task 2
- **Issue:** NotificationPopover.test.tsx and TopBar.test.tsx used old prop signatures
- **Fix:** Added source prop to NotificationPopover test renders, updated TopBar test defaultProps
- **Files modified:** NotificationPopover.test.tsx, TopBar.test.tsx
- **Verification:** TypeScript compiles cleanly (no new errors)
- **Committed in:** dceea4e (Task 1), a7ba1b5 (Task 2)

---

**Total deviations:** 1 auto-fixed (blocking - test compilation)
**Impact on plan:** Necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Phase: quick-260318-td7*
*Completed: 2026-03-18*
