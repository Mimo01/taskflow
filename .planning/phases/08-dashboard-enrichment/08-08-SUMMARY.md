---
phase: 08-dashboard-enrichment
plan: "08"
subsystem: ui
tags: [react, react-router, zustand, notifications, sidebar]

# Dependency graph
requires:
  - phase: 08-dashboard-enrichment
    provides: NotificationRow, NotificationDetail, and useNotificationsStore (Plans 01, 06)
provides:
  - Full-page /notifications route with accordion row expand and mark-all-read action
  - NotificationsPage default export at taskflow/src/routes/notifications/index.tsx
  - /notifications route registered in createHashRouter (main.tsx)
  - Bell NavLink in Sidebar bottom utility section visible to all roles
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Accordion expand/collapse via useState<string | null> expandedId — same pattern as NotificationsPanel
    - Full-page route reuses sub-components (NotificationRow, NotificationDetail) from same directory

key-files:
  created:
    - taskflow/src/routes/notifications/index.tsx
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/components/app/Sidebar.tsx

key-decisions:
  - "NotificationsPage reuses existing NotificationRow and NotificationDetail sub-components — no new UI primitives needed"
  - "Bell sidebar link placed above Debug Logs in bottom utility section, no role-gating"

patterns-established:
  - "Full-page list routes can reuse panel sub-components directly from same directory"

requirements-completed: [DASH-04]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 08 Plan 08: Notifications Full-Page Route Summary

**Full-page /notifications route with accordion row expand, mark-all-read, and Bell sidebar NavLink — fixes UAT 404 on "View all notifications"**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-13T12:00:01Z
- **Completed:** 2026-03-13T12:01:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created NotificationsPage component listing all store notifications with accordion detail expand
- Registered /notifications route in createHashRouter so the page is reachable without 404
- Added Bell NavLink to Sidebar bottom section, visible to all roles (developer, pm, tech-lead)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NotificationsPage component** - `2af194c` (feat)
2. **Task 2: Register /notifications route and add Bell sidebar link** - `4bb565d` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `taskflow/src/routes/notifications/index.tsx` - Full-page notifications list page component
- `taskflow/src/main.tsx` - Added NotificationsPage import + /notifications route entry
- `taskflow/src/components/app/Sidebar.tsx` - Added Bell import + NavLink to /notifications

## Decisions Made
- NotificationsPage reuses existing NotificationRow and NotificationDetail sub-components — consistent UI and no duplication
- Bell sidebar link placed above Debug Logs in bottom utility section without role-gating (notifications are universal)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /notifications route is now fully functional; UAT test 14 (404 on "View all notifications") is resolved
- NotificationsPanel "View all notifications" link navigates to the new page correctly

---
*Phase: 08-dashboard-enrichment*
*Completed: 2026-03-13*
