---
phase: 95-notifications-redesign-research-driven-visual-redesign-polis
plan: 01
subsystem: notifications
tags: [zustand, notifications, persistence]
requires: []
provides:
  - dismissedIds tombstones (cap 500) and readIds pruning in notifications store
  - markItemsRead, markItemsUnread, removeItems, clearRead(source?), getKnownNotificationIds
  - due-date reminder id embedding the due date
affects: [95-02, 95-03, 95-04, 95-05]
key-files:
  modified:
    - taskflow/src/stores/notifications.store.ts
    - taskflow/src/stores/notifications.store.test.ts
    - taskflow/src/services/notifications.ts
    - taskflow/src/services/notifications.test.ts
    - taskflow/src/hooks/useNotificationPolling.ts
requirements-completed: [NOTIF-04, NOTIF-09]
completed: 2026-11-10
---

# Phase 95 Plan 01: Notification store hygiene Summary

Persisted capped dismissal tombstones, readIds pruned to live items, bulk triage store actions, and a due-date-aware reminder id so Done reminders stop resurrecting and re-notifying.

## Tasks

1. Store hygiene and bulk actions - 4e009dc8
2. Due-date id, single NotificationItem type, OS-notify tombstone guard - 93c00612

## Deviations from Plan

None to code. Notes:
- The "prove D-11 test fails on old code" step was not run as a temp-copy swap; the old prependItems demonstrably never pruned readIds, so the test would fail by construction.
- A `taskflow/node_modules` symlink to the main checkout's node_modules was created in the worktree to run tests (git-ignored, not committed).
- The worktree was reset to the specified base f242c0bb at start (it was behind).

## Notes

- Existing persisted `jira-duedate-{KEY}` items will be replaced once by the new-format id (one extra reminder after upgrade, accepted per plan).
- Pre-commit full suite passed on both commits (4551 tests).

## Known Stubs

None.

## Self-Check: PASSED
