---
phase: quick-261112-dai
plan: 01
subsystem: notifications
tags: [desktop-notifications, os-banner, dev-tools]
requires: []
provides:
  - item-led OS notification formatter (formatOsNotification with ctx)
  - toPlainNotificationText OS-only cleaner
  - planOsDispatch burst folding (OS_BURST_THRESHOLD = 3)
  - dev-tools summary and Grouped rows
affects: [useNotificationPolling, NotificationsTab, notification-dispatch-log store]
tech-stack:
  added: []
  patterns: [discriminated union log entries, pure dispatch planner]
key-files:
  created: []
  modified:
    - taskflow/src/lib/notification-dispatch-log.ts
    - taskflow/src/lib/notification-dispatch-log.test.ts
    - taskflow/src/stores/notification-dispatch-log.store.ts
    - taskflow/src/hooks/useNotificationPolling.ts
    - taskflow/src/hooks/useNotificationPolling.test.tsx
    - taskflow/src/routes/dev-tools/NotificationsTab.tsx
    - taskflow/src/routes/dev-tools/NotificationsTab.test.tsx
    - taskflow/src/routes/notifications/notification-view.ts
key-decisions:
  - "OsFormatContext accepts null for jiraUsername/jiraDisplayName because the auth store holds string | null"
  - "System MR note 'State: opened -> merged' reads 'Alex: Merged' (phrase-only ChangeLine), pinned in test"
  - "Skipped (already known) rows are now pushed before fresh dispatches in a poll; relative display order is unchanged"
duration: ~20min
completed: 2026-11-12
---

# Phase quick-261112-dai Plan 01: Condense desktop notification content Summary

Desktop banners are now item-led ("PROJ-1 · Title", "!482 · MR title") with a one-line "Alex: what happened" body, and bursts of more than 3 fresh items fold into a single summary banner, with the Developer Tools log recording the summary plus one Grouped row per folded item.

## What was built

- `formatOsNotification(item, ctx?)`: title from `getEntityRef` (GitLab falls back to the `/merge_requests/N` in the url), body is `<first name>: <what>` or just `<what>` for empty authors, whitespace-collapsed so it is always one line and never starts with ": ".
  - Updates and system MR notes show the top-priority change (status > assignee > rest) as "Field → value", plus " (+N more)".
  - Assignment is "Assigned you", approval is "Approved", due-date reminders use the precomputed preview, and pipeline failures read "Pipeline failed on <branch>".
  - Comments and mentions go through `toPlainNotificationText`.
- `toPlainNotificationText`: strips Jira wiki and Markdown (images, links, teletype, headings, list markers, table rows, code fences, word-boundary-anchored emphasis), maps the current user's `[~username]` to `@Display Name`, caps at 140 chars with an ellipsis. It reuses the in-app `cleanCommentText` unchanged.
- `planOsDispatch`: up to 3 per-item banners; more produces one summary ("<n> new notifications" / "<j> Jira · <g> GitLab", zero side omitted).
- Poller: known items logged as skipped; fresh items planned and sent once; summary row followed by `grouped` rows; denied/error flags still set from the summary send.
- Dev tools tab: "summary" badge for summary rows (raw JSON is the items array), "Grouped" outcome with the note "Not sent individually: folded into a summary banner."
- In-app output untouched: the only change in `notification-view.ts` is `export` on `actorName`.

## Verification

- Full vitest suite: 308 files passed, 4909 tests passed. `tsc --noEmit` clean. Biome check clean on the 8 touched files.
- The existing notification-view tests pass unmodified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Single commit instead of three per-task commits**
- **Issue:** The pre-commit hook runs tsc and the full suite. Widening `OsDispatchLogEntry` into a union (Task 2) and the `'grouped'` outcome break the dev-tools tab and the polling test typing, so Tasks 1-3 cannot each be committed green on their own.
- **Fix:** All three tasks landed in one commit, fc3e2505, with RED/GREEN tests included.

**2. [Rule 1 - Bug] Table-pipe stripping broke Jira `[text|url]` links**
- **Found during:** Task 1 test run
- **Issue:** The first draft replaced every `|` with a space before `cleanCommentText`, turning `[docs|https://x]` into `[docs https://x]`.
- **Fix:** Pipes are now replaced only on lines that start with `|` (table rows).

**3. [Rule 3 - Blocking] `OsFormatContext` allows null**
- **Issue:** The auth store values are `string | null`, which failed tsc against `string | undefined`.
- **Fix:** Context fields typed `string | null`.

### Other notes

- The worktree had no `node_modules`, so I symlinked the main checkout's `taskflow/node_modules` into the worktree (gitignored, not committed).
- The first reset: the worktree was based on e7e50155 rather than the required base, so I hard-reset to a3a736db per the branch check, which brought in the plan files.

## Known Stubs

None.

## Threat Flags

None. The regexes are anchored and non-nested, covered by a pathological-input timing test.

## Commits

- fc3e2505: feat(261112-dai): condense desktop notifications with burst summary

## Self-Check: PASSED

All 8 modified files exist and are in commit fc3e2505.
