---
phase: 03-notifications-hub
plan: 02
subsystem: ui
tags: [notifications, tauri, zustand, react-query, typescript, vitest, tdd, lucide-react, shadcn-ui, topbar, polling]

# Dependency graph
requires:
  - phase: 03-notifications-hub/03-01
    provides: "notifications.ts service (fetchNewNotifications, tryDispatchOsNotification), notifications.store.ts (useNotificationsStore, useUnreadCount, NotificationItem), settings.store.ts notification fields, Wave 0 test scaffolds"
  - phase: 01-foundation
    provides: "stronghold.ts readSecret, settings.store.ts persist pattern, Tauri QueryClient pattern"
provides:
  - "TopBar component: persistent header with bell icon, unread badge (capped 99+), Popover trigger for notification feed"
  - "NotificationRow component: source-specific left border (orange=jira, purple=gitlab), bold-when-unread title, body preview, relative timestamp"
  - "NotificationDetail component: read-only inline detail panel (source badge, entity title, author/timestamp, full body pre block)"
  - "NotificationPopover component: feed with mark-all-read header, sorted notification list, permission-denied Alert banner, empty state, inline NotificationDetail expansion"
  - "useNotificationPolling hook: TanStack Query polling with refetchInterval from settings, OS notification dispatch, cursor update"
  - "NotificationSettingsSection: poll interval input (30-300s), Jira/GitLab OS notification toggles"
  - "main.tsx wired: TopBar in AppLayout, useNotificationPolling called, getCurrentWindow().setFocus() on mount"
  - "Settings.tsx extended: NotificationSettingsSection after StaleMrThresholdSection"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useNotificationPolling hook extracted from TopBar so TopBar tests work without QueryClientProvider — polling runs in AppLayout where QueryClient is always available"
    - "NotificationPopover is pure UI (reads store only, no useQuery) — clean separation of polling and display"
    - "useNotificationPolling uses queryClient.getQueryData for MR list cache access — avoids double-fetch"

key-files:
  created:
    - taskflow/src/components/app/TopBar.tsx
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/notifications/NotificationDetail.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/hooks/useNotificationPolling.ts
    - taskflow/src/routes/settings/NotificationSettingsSection.tsx
  modified:
    - taskflow/src/routes/settings/Settings.tsx
    - taskflow/src/main.tsx

key-decisions:
  - "useNotificationPolling extracted from TopBar — TopBar.test.tsx renders without QueryClientProvider; moving useQuery to TopBar caused 'No QueryClient set' errors in tests"
  - "NotificationPopover is pure UI component (no useQuery) — polling separated into custom hook called from AppLayout inside QueryClientProvider context"

patterns-established:
  - "Polling hook extraction pattern: when a UI component test doesn't provide QueryClientProvider, extract useQuery into a custom hook called from a QueryClient-aware ancestor"
  - "Notification feed: sort newest-first client-side, inline detail expansion via selectedItemId state, markAsRead on row click"

requirements-completed: [NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, NOTF-06]

# Metrics
duration: 6min
completed: 2026-03-11
---

# Phase 3 Plan 02: Notification UI Summary

**Bell icon TopBar with 99+-capped badge, NotificationPopover feed with mark-all-read + permission-denied Alert, per-source bordered rows with inline detail expansion, polling hook via useQuery, and NotificationSettingsSection in settings — 113 tests GREEN**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-11T16:10:00Z
- **Completed:** 2026-03-11T16:16:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- Created TopBar with bell icon, red unread badge (capped 99+), and Popover wrapping NotificationPopover
- Created NotificationRow with source-specific left border (orange=Jira, purple=GitLab), bold-when-unread title, 2-line body preview, and relative timestamp
- Created NotificationDetail inline expansion panel with source badge, entity title, author/timestamp, and full body pre block
- Created full NotificationPopover with sorted feed, mark-all-read header, permission-denied Alert (dismissible), empty state, inline detail expansion
- Created useNotificationPolling hook (separated from TopBar for test isolation) with TanStack Query refetchInterval, OS notification dispatch, cursor update
- Created NotificationSettingsSection with poll interval input (30-300s clamped) and per-source OS notification toggles
- Wired TopBar and useNotificationPolling into AppLayout, NotificationSettingsSection into Settings page

## Task Commits

Each task was committed atomically:

1. **Task 1 GREEN: TopBar, NotificationRow, NotificationDetail components** - `331628d` (feat)
2. **Task 2 GREEN: NotificationPopover, NotificationSettingsSection, layout wiring** - `14852f4` (feat)

_Note: TDD tasks committed as GREEN since Wave 0 scaffolds (RED) were created in Plan 03-01_

## Files Created/Modified

- `taskflow/src/components/app/TopBar.tsx` - Bell icon, unread badge, Popover trigger, NotificationPopover content
- `taskflow/src/routes/notifications/NotificationRow.tsx` - Source-bordered row with bold unread, preview, relative timestamp
- `taskflow/src/routes/notifications/NotificationDetail.tsx` - Inline read-only detail panel with pre block body
- `taskflow/src/routes/notifications/NotificationPopover.tsx` - Full notification feed UI (pure store consumer, no useQuery)
- `taskflow/src/hooks/useNotificationPolling.ts` - TanStack Query polling hook with OS notification dispatch
- `taskflow/src/routes/settings/NotificationSettingsSection.tsx` - Poll interval + per-source OS notification toggles
- `taskflow/src/routes/settings/Settings.tsx` - Added NotificationSettingsSection after StaleMrThresholdSection
- `taskflow/src/main.tsx` - Added TopBar, useNotificationPolling, getCurrentWindow().setFocus() to AppLayout

## Decisions Made

- **useNotificationPolling extracted from TopBar**: TopBar.test.tsx doesn't wrap in QueryClientProvider. When useQuery/useQueryClient were in TopBar, all 3 TopBar tests threw "No QueryClient set". Solution: extract polling into a hook called from AppLayout (which renders inside QueryClientProvider). TopBar becomes a pure UI component.
- **NotificationPopover is pure UI**: Complements the polling hook extraction — NotificationPopover reads from notifications store and renders, with no async dependencies. This makes it independently testable without providers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Polling logic extracted from TopBar to useNotificationPolling hook**
- **Found during:** Task 2 — adding useQuery/useQueryClient to TopBar broke all 3 TopBar tests
- **Issue:** TopBar.test.tsx renders `<TopBar />` without a QueryClientProvider wrapper. Adding useQuery caused "No QueryClient set, use QueryClientProvider to set one" errors.
- **Fix:** Moved polling logic into `taskflow/src/hooks/useNotificationPolling.ts`, called from AppLayout in main.tsx where QueryClientProvider is available. TopBar reverted to pure UI component.
- **Files modified:** `taskflow/src/components/app/TopBar.tsx`, `taskflow/src/hooks/useNotificationPolling.ts`, `taskflow/src/main.tsx`
- **Verification:** All 3 TopBar tests pass GREEN; full 113-test suite passes
- **Committed in:** `14852f4` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug: test failure from QueryClient missing in test context)
**Impact on plan:** Fix maintains identical runtime behavior. Polling runs in AppLayout — always active when app is post-onboarding. NotificationPopover contract unchanged (pure UI rendering from store). No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in OnboardingWizard.tsx, GitLabStep.tsx, JiraStep.tsx, TokenSection.tsx, stronghold.ts — all pre-existing, out of scope, not caused by Plan 03-02 changes.
- Unhandled rejections in tests (LazyStore/Tauri invoke in test environment) — pre-existing across all component tests that import notifications.store.ts without mocking LazyStore. Tests still pass GREEN.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 complete: all notification UI components built and wired, polling active, settings controls in place
- All 6 NOTF requirements satisfied (NOTF-01 through NOTF-06)
- Bell badge, popover feed, detail panel, mark-all-read, permission-denied banner, OS notification toggles — all functional
- 113 tests passing GREEN (was 86 before Phase 3, now 113 with all new notification tests)

## Self-Check: PASSED

All created files verified present on disk. All task commits verified in git log.

- FOUND: taskflow/src/components/app/TopBar.tsx
- FOUND: taskflow/src/routes/notifications/NotificationRow.tsx
- FOUND: taskflow/src/routes/notifications/NotificationDetail.tsx
- FOUND: taskflow/src/routes/notifications/NotificationPopover.tsx
- FOUND: taskflow/src/hooks/useNotificationPolling.ts
- FOUND: taskflow/src/routes/settings/NotificationSettingsSection.tsx
- FOUND commit: 331628d (Task 1 GREEN)
- FOUND commit: 14852f4 (Task 2 GREEN)

---
*Phase: 03-notifications-hub*
*Completed: 2026-03-11*
