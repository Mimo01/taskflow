---
phase: quick
plan: 260319-0yd
subsystem: notifications
tags: [bugfix, notification-toggle, store-action]
dependency_graph:
  requires: []
  provides: [markAsUnread-store-action]
  affects: [notification-popover, notification-row]
tech_stack:
  added: []
  patterns: [toggle-aware-callback]
key_files:
  created: []
  modified:
    - taskflow/src/stores/notifications.store.ts
    - taskflow/src/routes/notifications/NotificationPopover.tsx
decisions:
  - markAsUnread implemented as simple readIds.filter (inverse of markAsRead) for symmetry
metrics:
  duration: 1m
  completed: "2026-03-19"
---

# Quick Task 260319-0yd: Fix Unread Notification Toggle + Button Padding

markAsUnread store action added; popover onMarkRead callback now toggles based on read state; header button padding made consistent.

## What Was Done

### Task 1: Add markAsUnread store action and wire toggle in popover

**Store changes (notifications.store.ts):**
- Added `markAsUnread: (id: string) => void` to the `NotificationsState` interface
- Implemented as `readIds.filter((rid) => rid !== id)` -- removes the ID from readIds, making the notification unread again

**Popover changes (NotificationPopover.tsx):**
- Destructured `markAsUnread` from store alongside `markAsRead`
- Changed `onMarkRead` callback from always calling `markAsRead` to a toggle: `readSet.has(item.id) ? markAsUnread(item.id) : markAsRead(item.id)`
- Added `px-2` to "Mark all read" button className to match the All/Unread toggle button padding

**Commit:** 25efc51

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compiles cleanly (pre-existing errors in unrelated test files only)
- markAsUnread action exists in store interface and implementation
- Toggle-aware callback wired in popover renderGroupedRows
- Button padding consistent between All/Unread toggle and Mark all read
