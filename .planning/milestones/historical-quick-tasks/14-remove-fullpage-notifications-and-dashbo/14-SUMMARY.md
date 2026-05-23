---
phase: quick-14
plan: 14
subsystem: dashboard, routing, sidebar
tags: [cleanup, notifications, ui]
dependency_graph:
  requires: []
  provides: [dashboard-without-notifications-panel, sidebar-without-notifications-link, router-without-notifications-route]
  affects: [taskflow/src/routes/dashboard/index.tsx, taskflow/src/components/app/Sidebar.tsx, taskflow/src/main.tsx]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/main.tsx
  deleted:
    - taskflow/src/routes/dashboard/NotificationsPanel.tsx
    - taskflow/src/routes/dashboard/NotificationsPanel.test.tsx
decisions:
  - "NotificationsPage file (routes/notifications/index.tsx) left on disk — only import and route entry removed; the sub-components (NotificationRow, NotificationDetail, NotificationPopover) are still used by TopBar"
  - "PM dashboard grid changed to grid-cols-1 (single SprintHealthPanel); developer grid remains lg:grid-cols-2 with 3 panels (asymmetric layout)"
metrics:
  duration: ~4 min
  completed_date: "2026-03-13"
  tasks: 2
  files_changed: 5
---

# Quick Task 14: Remove Fullpage Notifications Route and Dashboard NotificationsPanel — Summary

**One-liner:** Removed NotificationsPanel dashboard card and /notifications sidebar link + route, leaving bell popover as the sole notifications surface.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Remove NotificationsPanel from dashboard and delete its files | 6787b01 | dashboard/index.tsx (modified), NotificationsPanel.tsx (deleted), NotificationsPanel.test.tsx (deleted) |
| 2 | Remove /notifications route from router and Bell NavLink from sidebar | ec6d662 | main.tsx, Sidebar.tsx |

## What Was Done

**Task 1 — Dashboard cleanup:**
- Removed `import NotificationsPanel from './NotificationsPanel'` from `dashboard/index.tsx`
- Removed `<NotificationsPanel />` from both the PM branch and developer/tech-lead branch
- Changed PM grid from `grid-cols-1 lg:grid-cols-2` to `grid-cols-1` (single SprintHealthPanel)
- Developer/tech-lead grid remains `grid-cols-1 lg:grid-cols-2` with 3 panels
- Deleted `NotificationsPanel.tsx` (168 lines) and `NotificationsPanel.test.tsx` (59 lines)

**Task 2 — Router and sidebar cleanup:**
- Removed `import NotificationsPage` from `main.tsx`
- Removed `{ path: '/notifications', element: <NotificationsPage /> }` route entry
- Removed `Bell` from lucide-react imports in `Sidebar.tsx`
- Removed the `<NavLink to="/notifications">` block from the sidebar bottom utility section

## Verification

- `grep -r "NotificationsPanel" taskflow/src` — one result (a comment in `routes/notifications/index.tsx`, not an import)
- `grep -r "NotificationsPage" taskflow/src` (excluding its own file) — no results
- `grep -r 'to="/notifications"' taskflow/src` — no results
- TopBar bell + NotificationPopover + useNotificationPolling + notifications.store — all intact
- TypeScript: no errors in any of the modified files; pre-existing errors in unrelated test files are out of scope

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- dashboard/index.tsx: FOUND
- Sidebar.tsx: FOUND
- main.tsx: FOUND
- NotificationsPanel.tsx: CONFIRMED DELETED
- NotificationsPanel.test.tsx: CONFIRMED DELETED
- Commit 6787b01: FOUND
- Commit ec6d662: FOUND
