---
phase: 03-notifications-hub
plan: 01
subsystem: api
tags: [notifications, tauri, zustand, typescript, vitest, tdd, jira, gitlab, tauri-plugin-notification]

# Dependency graph
requires:
  - phase: 02-developer-dashboard
    provides: "GitLabMR type from gitlab.ts (for mrList parameter), LazyStore + createJSONStorage persist pattern from settings.store.ts, @tauri-apps/plugin-http fetch pattern for Tauri webview"
  - phase: 01-foundation
    provides: "auth.store.ts base, settings.store.ts base, Zustand store patterns"
provides:
  - "notifications.ts: fetchNewNotifications (Jira JQL + GitLab per-MR notes, parallel fetch, dedup, newest-first sort), tryDispatchOsNotification (full permission flow)"
  - "NotificationItem interface exported from both service and store"
  - "notifications.store.ts: useNotificationsStore with prependItems (cap 200), markAsRead (idempotent), markAllRead, setLastSeenCursor, setPermissionDenied; useUnreadCount selector"
  - "settings.store.ts extended: notificationPollIntervalSecs (default 60, clamp [30,300]), osNotifJiraEnabled (default true), osNotifGitlabEnabled (default true)"
  - "auth.store.ts extended: jiraUserDisplayName, jiraUsername, gitlabUserId; setJiraUser, setGitlabUserId"
  - "Wave 0 test scaffolds: NotificationRow.test.tsx, NotificationPopover.test.tsx, TopBar.test.tsx (intentionally RED — implementations in Plan 03-02)"
  - "tauri-plugin-notification registered in Cargo.toml, lib.rs, capabilities/default.json, package.json"
affects:
  - 03-02

# Tech tracking
tech-stack:
  added:
    - "@tauri-apps/plugin-notification ^2 (npm)"
    - "tauri-plugin-notification = \"2\" (Cargo)"
  patterns:
    - "Notification service uses @tauri-apps/plugin-http fetch (not global fetch) — same as established Phase 2 pattern"
    - "readIds stored as string[] not Set — Zustand JSON persist does not serialize Set correctly (serializes as {})"
    - "LazyStore class mock in test: `vi.mock('@tauri-apps/plugin-store', () => { class LazyStore {...} return { LazyStore } })` — vi.fn().mockImplementation fails because new LazyStore() requires constructor"
    - "Promise.allSettled for parallel Jira + GitLab fetch — partial failures don't block the other source"
    - "Client-side cursor filtering for both Jira (comment.updated > cursor) and GitLab (note.created_at > cursor, sort desc break) — neither API has native since filter"

key-files:
  created:
    - taskflow/src/services/notifications.ts
    - taskflow/src/services/notifications.test.ts
    - taskflow/src/stores/notifications.store.ts
    - taskflow/src/stores/notifications.store.test.ts
    - taskflow/src/routes/notifications/NotificationRow.test.tsx
    - taskflow/src/routes/notifications/NotificationPopover.test.tsx
    - taskflow/src/components/app/TopBar.test.tsx
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/auth.store.ts
    - taskflow/src-tauri/Cargo.toml
    - taskflow/src-tauri/src/lib.rs
    - taskflow/src-tauri/capabilities/default.json
    - taskflow/package.json

key-decisions:
  - "readIds is string[] not Set in NotificationsState — Zustand JSON persist serializes Set as {} (empty object), losing all read state on app restart"
  - "LazyStore mock requires class syntax in vi.mock factory — vi.fn().mockImplementation(() => ({...})) is not a constructor and throws when used with new"
  - "Jira bodyPreview test requires mention text in body — client-side filter checks comment.body includes [~username] or @displayName, pure A-repeat body was filtered out"
  - "Wave 0 UI test scaffolds (NotificationRow, NotificationPopover, TopBar) left as intentionally failing RED — these are Plan 03-02 UI implementations"
  - "tauri_plugin_notification::init() added before tauri_plugin_http::init() in lib.rs — order follows plugin registration convention"

patterns-established:
  - "Notification service: fetchNewJiraComments uses JQL updatedDate filter + client-side cursor + mention check ([~username] or @displayName); fetchNewGitlabNotes iterates mrList per-MR, skips system notes and own notes, breaks on cursor"
  - "Store persist partialize: permissionDenied excluded from persistence (transient UI state); items/readIds/lastSeenCursor persisted to notifications.json"
  - "useUnreadCount selector: derives count from Set(readIds) for O(1) lookup per item — exposed as hook, not stored value"

requirements-completed: [NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, NOTF-06]

# Metrics
duration: 8min
completed: 2026-03-11
---

# Phase 3 Plan 01: Notification Engine Summary

**Delta polling service (Jira mentions + GitLab MR notes via @tauri-apps/plugin-http), OS notification dispatch with full permission flow, persisted notifications store with readIds as string[], and Wave 0 test scaffolds — 18 tests passing GREEN**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-11T15:00:37Z
- **Completed:** 2026-03-11T16:06:57Z
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 13 (7 created, 6 modified)

## Accomplishments

- Installed `@tauri-apps/plugin-notification` and registered it in all four required locations (Cargo.toml, lib.rs, capabilities/default.json, package.json)
- Created notifications.ts service with parallel Jira + GitLab fetching via Promise.allSettled, client-side cursor filtering, dedup by stable event IDs (jira-comment-{id}/gitlab-note-{id}), newest-first sort, and full OS notification permission flow
- Created notifications.store.ts with LazyStore persistence pattern, correct string[] readIds (not Set), prependItems cap at 200, idempotent markAsRead, useUnreadCount hook
- Extended settings.store.ts with 3 notification fields (pollIntervalSecs with clamp, osNotifJiraEnabled, osNotifGitlabEnabled) and auth.store.ts with jiraUserDisplayName, jiraUsername, gitlabUserId for notification filtering
- Created 5 Wave 0 test scaffold files covering all 6 NOTF requirements

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Wave 0 test scaffolds + Tauri plugin install** - `c964eeb` (test)
2. **Task 2 GREEN: Notification engine — service, stores, plugin registration** - `b8a59d5` (feat)

_Note: TDD tasks have separate test (RED) and feat (GREEN) commits per task_

## Files Created/Modified

- `/Users/mimo/Desktop/Tasker/taskflow/src/services/notifications.ts` - fetchNewNotifications, tryDispatchOsNotification, NotificationItem type
- `/Users/mimo/Desktop/Tasker/taskflow/src/services/notifications.test.ts` - 9 tests: NOTF-01/02/03, all GREEN
- `/Users/mimo/Desktop/Tasker/taskflow/src/stores/notifications.store.ts` - useNotificationsStore, useUnreadCount, persisted via LazyStore('notifications.json')
- `/Users/mimo/Desktop/Tasker/taskflow/src/stores/notifications.store.test.ts` - 9 tests: NOTF-04/05/06, all GREEN
- `/Users/mimo/Desktop/Tasker/taskflow/src/routes/notifications/NotificationRow.test.tsx` - Wave 0 scaffold (RED — awaits 03-02)
- `/Users/mimo/Desktop/Tasker/taskflow/src/routes/notifications/NotificationPopover.test.tsx` - Wave 0 scaffold (RED — awaits 03-02)
- `/Users/mimo/Desktop/Tasker/taskflow/src/components/app/TopBar.test.tsx` - Wave 0 scaffold (RED — awaits 03-02)
- `/Users/mimo/Desktop/Tasker/taskflow/src/stores/settings.store.ts` - Added notificationPollIntervalSecs, osNotifJiraEnabled, osNotifGitlabEnabled
- `/Users/mimo/Desktop/Tasker/taskflow/src/stores/auth.store.ts` - Added jiraUserDisplayName, jiraUsername, gitlabUserId + setters
- `/Users/mimo/Desktop/Tasker/taskflow/src-tauri/Cargo.toml` - Added tauri-plugin-notification = "2"
- `/Users/mimo/Desktop/Tasker/taskflow/src-tauri/src/lib.rs` - Added tauri_plugin_notification::init()
- `/Users/mimo/Desktop/Tasker/taskflow/src-tauri/capabilities/default.json` - Added 4 notification/window permissions
- `/Users/mimo/Desktop/Tasker/taskflow/package.json` - Added @tauri-apps/plugin-notification

## Decisions Made

- **readIds as string[] not Set**: Zustand's JSON persist middleware serializes `Set<string>` as `{}` (empty object). After app restart all read state would be lost. Storing as `string[]` with `.includes()` or `new Set(readIds)` for membership checks is the correct approach.
- **LazyStore class mock**: `vi.fn().mockImplementation(() => ({...}))` is not a constructor — using `new LazyStore()` throws "is not a constructor". Fixed by using `class LazyStore { ... }` syntax in the `vi.mock` factory.
- **Jira mention filter in tests**: Test body must include `[~username]` or `@displayName` because the service applies client-side mention filtering. Pure `'A'.repeat(120)` body was filtered out.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LazyStore mock required class constructor syntax**
- **Found during:** Task 2 (notifications.store.test.ts failing with "is not a constructor")
- **Issue:** `vi.fn().mockImplementation(() => ({...}))` doesn't create a proper ES6 class constructor; `new LazyStore()` throws TypeError
- **Fix:** Changed mock to `class LazyStore { get = vi.fn()... }` syntax inside `vi.mock` factory
- **Files modified:** `taskflow/src/stores/notifications.store.test.ts`
- **Verification:** All 9 store tests pass GREEN
- **Committed in:** `b8a59d5` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] bodyPreview test required mention text in comment body**
- **Found during:** Task 2 (bodyPreview test returning empty result[])
- **Issue:** Client-side Jira mention filter checks `body.includes('[~username]')` — `'A'.repeat(120)` contains no mention so comment was filtered out, returning empty array; `result[0].bodyPreview` undefined
- **Fix:** Changed test body to `'[~auser] ' + 'A'.repeat(120)` so client-side filter passes
- **Files modified:** `taskflow/src/services/notifications.test.ts`
- **Verification:** bodyPreview test passes, result[0].bodyPreview has exactly 80 chars
- **Committed in:** `b8a59d5` (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs found during test execution)
**Impact on plan:** Both fixes essential for test correctness. No scope creep. All must-have truths and artifacts satisfied.

## Issues Encountered

- Pre-existing TypeScript errors in `OnboardingWizard.tsx`, `GitLabStep.tsx`, `JiraStep.tsx`, `TokenSection.tsx`, `stronghold.ts` — all pre-existing, out of scope for this plan, not caused by our changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All data and logic contracts for Plan 03-02 are in place: NotificationItem type exported from both service and store, useNotificationsStore with all actions, useUnreadCount hook
- settings.store.ts has notificationPollIntervalSecs (clamped [30,300]), osNotifJiraEnabled, osNotifGitlabEnabled
- auth.store.ts has jiraUserDisplayName, jiraUsername, gitlabUserId for notification filtering
- Wave 0 test scaffolds written — NotificationRow, NotificationPopover, TopBar tests will go GREEN when 03-02 creates the UI components
- tauri-plugin-notification fully registered — OS notification dispatch ready to use from any component

## Self-Check: PASSED

All created files verified present on disk. All task commits verified in git log.

- FOUND: taskflow/src/services/notifications.ts
- FOUND: taskflow/src/stores/notifications.store.ts
- FOUND: taskflow/src/services/notifications.test.ts
- FOUND: taskflow/src/stores/notifications.store.test.ts
- FOUND: taskflow/src/routes/notifications/NotificationRow.test.tsx
- FOUND: taskflow/src/routes/notifications/NotificationPopover.test.tsx
- FOUND: taskflow/src/components/app/TopBar.test.tsx
- FOUND commit: c964eeb (Task 1 RED)
- FOUND commit: b8a59d5 (Task 2 GREEN)

---
*Phase: 03-notifications-hub*
*Completed: 2026-03-11*
