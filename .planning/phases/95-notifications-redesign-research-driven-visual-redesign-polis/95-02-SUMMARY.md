---
phase: 95-notifications-redesign-research-driven-visual-redesign-polis
plan: 02
subsystem: notifications
tags: [view-model, grouping, tdd, hooks]
requires: []
provides:
  - "notification-view.ts pure view-model (getEntityKey, buildEntries, bucketOf, relTime, filterItems, isSafeHttpUrl, describeEvent, ...)"
  - "useNow(intervalMs) ticking clock hook"
affects: [95-03, 95-04, 95-05]
tech-stack:
  added: []
  patterns: ["pure view-model with injected now", "clock read only in state init / interval callback"]
key-files:
  created:
    - taskflow/src/routes/notifications/notification-view.ts
    - taskflow/src/routes/notifications/notification-view.test.ts
    - taskflow/src/hooks/useNow.ts
    - taskflow/src/hooks/useNow.test.ts
  modified: []
key-decisions:
  - "Groups form across the whole filtered list and sit in the bucket of their newest event"
  - "This week = 2-6 calendar days back (rolling 7 calendar days); DST-safe via rounding"
requirements-completed: [NOTIF-02, NOTIF-06]
duration: 15min
completed: 2026-11-10
---

# Phase 95 Plan 02: Notification view-model and useNow Summary

Pure notification view-model (entity keys incl. AB2-5 style Jira keys, Today/Yesterday/This week/Older bucketing, entity grouping with unread-driven expansion, safe URL check, single-line event descriptions) plus a ticking `useNow` hook.

## Commits
- fc442f9f: notification-view.ts + tests (21 exports per the interface contract)
- 3cc17ded: useNow.ts + tests

## Deviations from Plan
- Tests and implementation were written in the same step, so the local "confirm tests fail first" RED check was not run separately (pre-commit blocks RED commits anyway; tests all pass and cover each behavior bullet).
- The first useNow commit attempt failed the pre-commit hook on unrelated, load-induced timeouts in EpicDetailSheet/IssueDetailSheet tests (pre-existing, flaky under load); a retry passed without changes. Out of scope.
- Worktree base was reset to f242c0bb per the startup check; inner `node_modules` symlinked to the main checkout (untracked/ignored).

## Known Stubs
None.

## Self-Check: PASSED
