---
phase: 03-notifications-hub
verified: 2026-03-11T16:20:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 3: Notifications Hub Verification Report

**Phase Goal:** Users receive OS-level notifications for new Jira issues assigned to them and new GitLab MR comments/reviews, with a badge counter and in-app notification feed accessible from the TopBar.
**Verified:** 2026-03-11T16:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths — Plan 03-01 (Engine)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `fetchNewNotifications` returns deduplicated `NotificationItem[]` combining Jira comment mentions and GitLab MR notes newer than `lastSeenCursor` | VERIFIED | `notifications.ts` lines 168-233: `Promise.allSettled` parallel fetch, `Set`-based dedup by `id`, newest-first ISO sort. |
| 2 | `tryDispatchOsNotification` calls `sendNotification` when permission is granted, returns `'denied'` when refused | VERIFIED | `notifications.ts` lines 246-262: full permission flow with `isPermissionGranted` / `requestPermission` / `sendNotification`, returns `'sent' | 'denied' | 'error'`. |
| 3 | `notifications.store` `prependItems`, `markAsRead`, `markAllRead`, and `lastSeenCursor` update correctly and persist across store rehydration | VERIFIED | `notifications.store.ts` lines 70-98: `prependItems` prepends + caps at 200, `markAsRead` is idempotent via `.includes()` guard, `markAllRead` maps all item IDs, `partialize` persists `items/readIds/lastSeenCursor`. |
| 4 | `readIds` is stored as `string[]` (not `Set`) so Zustand JSON persist serializes it correctly | VERIFIED | `notifications.store.ts` line 45: `readIds: string[]` with comment `// string[] NOT Set — JSON-serializable`. `partialize` at line 92 persists the `string[]`. |
| 5 | `notificationPollIntervalSecs` is clamped to [30, 300] — never allows intervals below 30s | VERIFIED | `settings.store.ts` line 70: `Math.max(30, Math.min(300, secs))` inside setter. Additionally, `useNotificationPolling.ts` line 35: `Math.max(30_000, notificationPollIntervalSecs * 1000)` as a second safety clamp. |
| 6 | `tauri-plugin-notification` is registered in `Cargo.toml`, `lib.rs`, `capabilities/default.json`, and `package.json` | VERIFIED | `Cargo.toml` line 28: `tauri-plugin-notification = "2"`. `lib.rs` line 20: `.plugin(tauri_plugin_notification::init())`. `capabilities/default.json` lines 14-16: three notification permissions present. `package.json` line 18: `"@tauri-apps/plugin-notification": "^2.3.3"`. |

### Observable Truths — Plan 03-02 (UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | Bell icon with unread badge is visible in a top bar persistent across all post-onboarding pages | VERIFIED | `TopBar.tsx` is a `<header>` element. `main.tsx` line 51 renders `<TopBar />` as first child of the flex-col div inside the `onboardingComplete` branch of `AppLayout`. |
| 8 | Badge shows count capped at `'99+'`; badge disappears when all notifications are read | VERIFIED | `TopBar.tsx` lines 27-30: badge rendered only when `unreadCount > 0`; displays `unreadCount > 99 ? '99+' : unreadCount`. |
| 9 | Clicking the bell icon opens a popover panel with the chronological notification feed | VERIFIED | `TopBar.tsx` lines 21-36: `Popover` wraps bell trigger; `PopoverContent` renders `<NotificationPopover />`. `NotificationPopover.tsx` sorts items newest-first and renders feed. |
| 10 | Each notification row shows left border color (orange=Jira, purple=GitLab), source icon, bold title + tinted background if unread, 2-line body preview, relative timestamp | VERIFIED | `NotificationRow.tsx` line 30: `border-orange-500` / `border-purple-500`. Line 54: `font-bold` when `isUnread`. Line 57: `line-clamp-2`. Lines 58: `getRelativeTime()`. Lines 42-49: source icon circles. |
| 11 | Clicking a notification row opens the read-only detail panel AND marks that notification as read | VERIFIED | `NotificationPopover.tsx` lines 38-41: `handleRowClick` calls `setSelectedItemId(id)` + `markAsRead(id)`. Lines 91-93: `NotificationDetail` rendered inline below the matching row. |
| 12 | Popover header has a 'Mark all as read' button that clears the badge | VERIFIED | `NotificationPopover.tsx` lines 50-55: header `<Button variant="ghost" size="sm" onClick={markAllRead}>Mark all as read</Button>`. |
| 13 | Notification polling uses `refetchInterval` from `notificationPollIntervalSecs` in settings store, minimum 30s | VERIFIED | `useNotificationPolling.ts` line 35: `Math.max(30_000, notificationPollIntervalSecs * 1000)`. Line 81: `refetchInterval: pollIntervalMs`. `main.tsx` line 40: `useNotificationPolling()` called inside `AppLayout` (within `QueryClientProvider`). |
| 14 | When `permissionDenied` is true in notifications store, an Alert banner is rendered inside the popover with actionable text | VERIFIED | `NotificationPopover.tsx` lines 58-75: `{permissionDenied && <Alert>...Desktop notifications are blocked...}`. Dismissible via `setPermissionDenied(false)`. |
| 15 | Settings page has a new Notification Settings section with poll interval input (clamped [30,300]) and Jira/GitLab OS notification toggles | VERIFIED | `NotificationSettingsSection.tsx` lines 37-45: `<input type="number" min={30} max={300}>` for interval. Lines 53-87: Jira and GitLab checkbox toggles. `Settings.tsx` line 39: `<NotificationSettingsSection />` rendered after `StaleMrThresholdSection`. |

**Score:** 15/15 truths verified

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `taskflow/src/services/notifications.ts` | VERIFIED | 263 lines. Exports `NotificationItem`, `fetchNewNotifications`, `tryDispatchOsNotification`. Uses `@tauri-apps/plugin-http` fetch (not global). |
| `taskflow/src/services/notifications.test.ts` | VERIFIED | Exists. 9 tests covering NOTF-01/02/03 — all GREEN. |
| `taskflow/src/stores/notifications.store.ts` | VERIFIED | 114 lines. Exports `useNotificationsStore`, `useUnreadCount`. `readIds` is `string[]`. LazyStore persist pattern. |
| `taskflow/src/stores/notifications.store.test.ts` | VERIFIED | Exists. 9 tests covering NOTF-04/05/06 — all GREEN. |
| `taskflow/src/stores/settings.store.ts` | VERIFIED | `notificationPollIntervalSecs` (default 60, clamp [30,300]), `osNotifJiraEnabled`, `osNotifGitlabEnabled` present with setters. |
| `taskflow/src/stores/auth.store.ts` | VERIFIED | `jiraUserDisplayName`, `jiraUsername`, `gitlabUserId` present with `setJiraUser` and `setGitlabUserId` setters. |
| `taskflow/src/components/app/TopBar.tsx` | VERIFIED | 39 lines. Bell icon, badge, Popover trigger wrapping `NotificationPopover`. Pure UI — no `useQuery`. |
| `taskflow/src/routes/notifications/NotificationPopover.tsx` | VERIFIED | 100 lines. Feed, mark-all-read header, permission-denied Alert, inline detail expansion. Pure store consumer. |
| `taskflow/src/routes/notifications/NotificationRow.tsx` | VERIFIED | 62 lines. Source-colored border, icon, bold-when-unread title, 2-line preview, relative timestamp. |
| `taskflow/src/routes/notifications/NotificationDetail.tsx` | VERIFIED | 65 lines. Read-only panel with source badge, entity title, author/timestamp, `<pre>` full body. |
| `taskflow/src/hooks/useNotificationPolling.ts` | VERIFIED | 87 lines. TanStack Query polling with `refetchInterval`, OS dispatch, cursor update. Separated from TopBar for test isolation. |
| `taskflow/src/routes/settings/NotificationSettingsSection.tsx` | VERIFIED | 89 lines. Poll interval input + Jira/GitLab toggles. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TopBar.tsx` | `notifications.store.ts` | `useUnreadCount` selector | WIRED | Line 13: `import { useUnreadCount }`. Line 17: `const unreadCount = useUnreadCount()`. |
| `TopBar.tsx` | `NotificationPopover.tsx` | `<NotificationPopover />` inside `PopoverContent` | WIRED | Line 14: import. Line 34: rendered inside `<PopoverContent>`. |
| `useNotificationPolling.ts` | `fetchNewNotifications` + `refetchInterval` | `refetchInterval: pollIntervalMs` | WIRED | Lines 35, 81: `pollIntervalMs = Math.max(30_000, notificationPollIntervalSecs * 1000)` used directly as `refetchInterval`. |
| `NotificationPopover.tsx` | `notifications.store.ts` | `prependItems`, `permissionDenied` | WIRED | Lines 12-22: imports and destructures `prependItems` indirectly via store (note: `prependItems` is called from `useNotificationPolling` hook, not `NotificationPopover` directly — per the architectural decision to separate polling from UI). `permissionDenied` read at line 19 for Alert banner. |
| `main.tsx` | `TopBar.tsx` | `<TopBar />` in `AppLayout` | WIRED | Line 11: import. Line 51: `<TopBar />` rendered as first child of flex-col div. |
| `main.tsx` | `useNotificationPolling` | `useNotificationPolling()` in `AppLayout` | WIRED | Line 12: import. Line 40: `useNotificationPolling()` called inside `AppLayout` (QueryClientProvider available). |
| `Settings.tsx` | `NotificationSettingsSection.tsx` | import + render | WIRED | Line 11: import. Line 39: `<NotificationSettingsSection />` rendered. |
| `notifications.ts` | `@tauri-apps/plugin-http` | `import { fetch }` | WIRED | Line 12: `import { fetch } from '@tauri-apps/plugin-http'`. Used in `fetchNewJiraComments` (line 61) and `fetchNewGitlabNotes` (line 125). |
| `notifications.ts` | `@tauri-apps/plugin-notification` | `isPermissionGranted`, `requestPermission`, `sendNotification` | WIRED | Lines 13-17: all three imported. All used in `tryDispatchOsNotification` lines 251-257. |
| `notifications.store.ts` | `LazyStore('notifications.json')` | `createJSONStorage` adapter | WIRED | Line 14: `new LazyStore('notifications.json')`. Lines 16-29: adapter wired into `createJSONStorage`. Lines 89-98: passed to `persist`. |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NOTF-01 | 03-01, 03-02 | Unified notification feed combining Jira comment mentions and GitLab MR thread activity | SATISFIED | `fetchNewNotifications` merges both sources. `NotificationPopover` renders unified sorted feed. |
| NOTF-02 | 03-01, 03-02 | Polling with configurable interval, minimum 30 seconds | SATISFIED | `notificationPollIntervalSecs` in settings (default 60, clamped [30,300]). `useNotificationPolling` uses `Math.max(30_000, ...)` as `refetchInterval`. |
| NOTF-03 | 03-01, 03-02 | Native OS desktop notifications for new activity | SATISFIED | `tryDispatchOsNotification` full permission flow. `useNotificationPolling` dispatches per-source OS notification for each new item. |
| NOTF-04 | 03-01, 03-02 | In-app badge with unread notification count | SATISFIED | `useUnreadCount` selector exported from store. `TopBar` renders capped badge. |
| NOTF-05 | 03-01, 03-02 | Mark individual notifications as read | SATISFIED | `markAsRead(id)` idempotent action in store. Called from `NotificationPopover.handleRowClick`. |
| NOTF-06 | 03-01, 03-02 | Mark all notifications as read | SATISFIED | `markAllRead()` sets `readIds` to all item IDs. Wired to "Mark all as read" button in `NotificationPopover` header. |

No orphaned requirements — all 6 NOTF requirements claimed by both plans and verified in codebase.

---

## Anti-Patterns Found

None. Scan of all 12 Phase 3 files found no `TODO`, `FIXME`, `HACK`, `PLACEHOLDER`, empty handlers, or stub returns.

---

## Test Suite Results

| Test File | Tests | Status | Notes |
|-----------|-------|--------|-------|
| `notifications.test.ts` | 9 | GREEN | NOTF-01/02/03 coverage |
| `notifications.store.test.ts` | 9 | GREEN | NOTF-04/05/06 coverage |
| `TopBar.test.tsx` | 3 | GREEN | Badge 3, badge 99+, no badge at 0 |
| `NotificationRow.test.tsx` | 6 | GREEN | Source borders, bold/plain, entity title, body preview |
| `NotificationPopover.test.tsx` | ~4 | GREEN | Permission-denied Alert, mark-all-read |
| **Full suite** | **113** | **GREEN** | 14 passed / 1 skipped file (pre-existing) |

10 unhandled rejection errors appear in test output — these are `TypeError: Cannot read properties of undefined (reading 'invoke')` from Tauri's `invoke` not being available in the Vitest jsdom environment when `notifications.store.ts` hydrates via `LazyStore`. This is a pre-existing test environment limitation documented in SUMMARY 03-01, and does not affect test pass/fail status. All 113 tests pass GREEN.

---

## Human Verification Required

### 1. OS Notification Delivery

**Test:** Build and run the Tauri app, authenticate with Jira or GitLab, wait for a new comment/note to appear.
**Expected:** A native OS notification toast appears within the configured poll interval.
**Why human:** Requires a live Tauri runtime with OS notification API — cannot verify in Vitest jsdom.

### 2. Badge Persistence Across Navigation

**Test:** Receive several notifications (unread badge shows count), navigate between routes (Dashboard, Settings, back), verify the bell badge count persists.
**Expected:** Badge count remains consistent across all post-onboarding pages because `TopBar` is always rendered in `AppLayout`.
**Why human:** Runtime navigation behavior cannot be verified with static analysis.

### 3. Notification Popover Click-to-Detail Flow

**Test:** Open the notification popover, click a notification row, verify the detail panel expands inline, verify the row becomes "read" (badge decrements, title loses bold).
**Expected:** Smooth inline expansion; badge decrements by 1; row no longer bold after click.
**Why human:** Interactive UI state and visual rendering require a running app.

---

## Gaps Summary

No gaps. All 15 observable truths verified, all 12 artifacts substantive and wired, all 6 NOTF requirements satisfied. Full test suite is GREEN at 113 tests.

---

_Verified: 2026-03-11T16:20:00Z_
_Verifier: Claude (gsd-verifier)_
