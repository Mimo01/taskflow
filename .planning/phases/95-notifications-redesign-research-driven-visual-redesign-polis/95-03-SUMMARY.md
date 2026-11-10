---
phase: 95-notifications-redesign-research-driven-visual-redesign-polis
plan: 03
subsystem: notifications
tags: [react, a11y, overlay-button, tooltip]
requires: [95-02]
provides:
  - "NotificationRow one-line neutral event row, NotificationTrayButton, NotificationTypeGlyph"
  - "NotificationGroupHeader one-line entity group header with group tray"
affects: [95-04, 95-05]
key-files:
  created:
    - taskflow/src/routes/notifications/NotificationGroupHeader.tsx
    - taskflow/src/routes/notifications/NotificationGroupHeader.test.tsx
  modified:
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/notifications/NotificationRow.test.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/routes/notifications/NotificationPopover.test.tsx
requirements-completed: [NOTIF-01, NOTIF-03, NOTIF-04]
completed: 2026-11-10
---

# Phase 95 Plan 03: Notification row and group header Summary

One-line neutral event row and entity group header built on the overlay-button pattern (absolute inset-0 primary button with `data-entry-primary`, sibling z-10 key/tray buttons), with 600ms tooltips and hover/focus trays showing U/E shortcut hints.

## Commits
- 58d09cc: NotificationRow rewrite + popover bridge
- 6e29978c: NotificationGroupHeader

## Popover bridge edits (Task 1)
- NotificationPopover.tsx: calls `useNow(60_000)` and passes `now`; maps old handlers onto `onOpen` (handleRowClick), `onToggleRead` (handleMarkRead), `onDone` (handleDismiss), `onOpenInBrowser`; removed the now-unused `onIssueKeyClick` plumbing and `handleIssueKeyClick` (key click now routes to onOpen). Biome import-order fix.
- NotificationPopover.test.tsx: three assertions that used `getByTestId('notification-row')` now click `getByRole('button', { name: /Fix login bug/ })` (the overlay button). No "Dismiss" assertions existed in that file.

## Deviations from Plan
- Worktree base was reset to 6e59bc73 at start (it was behind).
- Pre-commit hook failed twice on load-induced flaky IssueDetailSheet/EpicDetailSheet tests; a full standalone run passed, then retry committed unchanged.
- Group header ref is a non-interactive span (the overlay handles open); only the chevron and tray are sibling buttons.
- Group state pill category mapping: opened->indeterminate, merged->done, closed->new (all exist in statusStyles).

## Known Stubs
None.

## Self-Check: PASSED
