---
phase: quick-261112-cmy
plan: 01
subsystem: notifications
tags: [dev-tooling, notifications, devtools]
key-files:
  created:
    - taskflow/src/lib/notification-dispatch-log.ts
    - taskflow/src/lib/notification-dispatch-log.test.ts
  modified:
    - taskflow/src/hooks/useNotificationPolling.ts
    - taskflow/src/hooks/useNotificationPolling.test.tsx
decisions:
  - Helpers live in src/lib (not services/notifications) so the hook test's partial mock of the service keeps working
metrics:
  tasks: 1
  completed: 2026-11-12
---

# Quick 261112-cmy: Dev-mode devtools log of desktop notifications

In dev (`import.meta.env.DEV`) with Desktop notifications ON, each poll with new items logs one collapsed console group `[notifications] N dispatched, M skipped` showing the exact OS title/body, result (sent/denied/error) and full item; already-known items appear as "skipped (already known)".

## What changed
- `formatOsNotification` is now the single title/body source for both the real `tryDispatchOsNotification` call and the log.
- `logOsDispatches` is DEV-gated inside the helper and at the call site (tree-shaking); logged once after the dispatch loop.
- Toggle OFF or DEV false: nothing logged; real dispatch unchanged.
- Tests: 5 unit tests for the module, 4 new hook tests (on, off, DEV false, skipped).

## Commits
- 86c11a8a: feat(261112-cmy): log would-be OS notifications to devtools in dev

## Deviations from Plan
None. (Worktree base was reset to dd9eb57c as instructed; node_modules symlinked, untracked/not committed.)

## Self-Check: PASSED
Full vitest suite, biome and the pre-commit hook passed; 4 files in the commit.

## Follow-up (2026-11-12): moved into in-app Developer Tools
User wanted the log in the app's own Developer Tools page, not the browser console.
- New **Notifications** tab (`routes/dev-tools/NotificationsTab.tsx`), backed by transient `stores/notification-dispatch-log.store.ts` (newest first, retention limit, cleared by Clear Logs).
- Rows: outcome (Sent/Denied/Error/Skipped), source badge, exact title + body, time; expand for the full item JSON.
- Gating changed from `import.meta.env.DEV` to the Developer Tools master switch (same as Logs/Operations/Waterfall); still only recorded while Desktop notifications is on. Console group removed.
- Commits: 37de5963 (sent/failed/skipped title, review WR-02 — superseded), 1254b818 (Developer Tools tab).
