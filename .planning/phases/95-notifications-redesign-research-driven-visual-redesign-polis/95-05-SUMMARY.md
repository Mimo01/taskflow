---
phase: 95-notifications-redesign-research-driven-visual-redesign-polis
plan: 05
subsystem: notifications
tags: [popover, zustand-selectors, empty-states, stale-banner]
requires: [95-01, 95-02, 95-03, 95-04]
provides:
  - "Rewritten NotificationPopover shell: header, segmented filter, source tabs, banners, states"
  - "TopBar/main.tsx onOpenSettings passthrough (navigate('/settings'))"
affects: [95-06]
key-files:
  modified:
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/routes/notifications/NotificationPopover.test.tsx
    - taskflow/src/components/app/TopBar.tsx
    - taskflow/src/components/app/TopBar.test.tsx
    - taskflow/src/main.tsx
key-decisions:
  - "Source-tab unread chips are computed from items/readIds in the popover (not the store's cached counters), so they stay correct when state is set directly; bell badge in TopBar is untouched (D-16)"
  - "Item-targeting handlers are local functions over per-field store selectors; expandOverrides and dismissedError live in component state"
requirements-completed: [NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08, NOTIF-10]
completed: 2026-11-10
---

# Phase 95 Plan 05: Popover shell Summary

Popover now builds entries with `buildEntries`, renders them through `NotificationList` with `NotificationRow`/`NotificationGroupHeader`, and adds the D-12 header (Mark all read, overflow with Clear read / Notification settings), segmented Unread | All, source tabs with neutral chips, D-15 empty/error states, and a StaleDataBanner for fetch errors with cached items.

## Commits
- c0b3d319: popover rewrite, tests, TopBar and main.tsx settings link (Tasks 1 and 2 combined)

## Deviations from Plan
- Tasks 1 and 2 landed in a single commit: both rewrite the same two files and the pre-commit hook runs the full suite, so a split would have needed an intermediate half-built popover.
- Worktree base was reset to 11845f33 at start (it was behind); inner `node_modules` symlinked (ignored, not committed).
- Rows have no `data-testid`, so tests count `[data-entry-primary]` elements (group header + children) instead of `notification-row`.
- With an empty list and `onOpenSettings` present, "Notification settings" appears both as an empty-state button and a menu item; tests target the menu item by role `menuitem` (TopBar test too).
- Full suite passed in the pre-commit hook (4608 tests); tsc and biome clean on touched files.

## Known Stubs
None.

## Threat Flags
None. Popover has no dangerouslySetInnerHTML; Open in browser is gated by `isSafeHttpUrl` (tested with a javascript: URL); MR param built from numeric ids only.

## Self-Check: PASSED
