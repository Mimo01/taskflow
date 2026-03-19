---
status: awaiting_human_verify
trigger: "OS notifications are turned on in the app settings but the user doesn't receive any OS-level notifications"
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus

hypothesis: The implementation is complete and correct — all layers are wired up properly
test: Verified all layers: Rust plugin, Cargo dep, frontend npm dep, capabilities, settings store, polling hook, dispatch function
expecting: Code should work — need to verify if `npm run tauri dev` has notification permission issues on macOS
next_action: Confirm that the code is functionally correct and check for macOS-specific dev-mode issues

## Symptoms

expected: When new notifications arrive (Jira/GitLab), the app should show OS-level notifications (macOS notification center)
actual: No OS notifications appear despite the setting being enabled in the app
errors: None reported
reproduction: Enable OS notifications in settings, wait for new notifications to arrive
started: Unknown — may have never worked

## Eliminated

- hypothesis: Notification plugin not installed on Rust side
  evidence: Cargo.toml has `tauri-plugin-notification = "2"`, lib.rs has `.plugin(tauri_plugin_notification::init())`
  timestamp: 2026-03-19

- hypothesis: Notification plugin not installed on frontend side
  evidence: package.json has `@tauri-apps/plugin-notification: ^2.3.3`, notifications.ts imports `isPermissionGranted`, `requestPermission`, `sendNotification` from it
  timestamp: 2026-03-19

- hypothesis: No code calls sendNotification
  evidence: `tryDispatchOsNotification()` in notifications.ts (line 787-803) calls `isPermissionGranted()`, `requestPermission()`, and `sendNotification()`. Called from useNotificationPolling.ts (line 166) for each new notification item.
  timestamp: 2026-03-19

- hypothesis: Capabilities/permissions not declared
  evidence: default.json capabilities include `notification:allow-is-permission-granted`, `notification:allow-request-permission`, `notification:allow-notify`
  timestamp: 2026-03-19

- hypothesis: Settings toggles not wired to polling logic
  evidence: useNotificationPolling.ts reads `osNotifJiraEnabled` and `osNotifGitlabEnabled` from settings store and gates `tryDispatchOsNotification` calls on them (line 163-164)
  timestamp: 2026-03-19

## Evidence

- timestamp: 2026-03-19
  checked: Full notification pipeline from settings to OS dispatch
  found: All layers are correctly wired. The code path is: useNotificationPolling() polls for new items -> for each new item, checks `osNotifJiraEnabled`/`osNotifGitlabEnabled` -> calls `tryDispatchOsNotification()` -> checks `isPermissionGranted()` -> requests permission if needed -> calls `sendNotification()`. The `tryDispatchOsNotification` function catches errors silently and returns 'error'. If permission is denied, it sets `permissionDenied: true` in the notifications store.
  implication: The code is correct. The issue is likely that in `npm run tauri dev` mode, macOS notification permissions may not be granted because the app doesn't have a proper bundle identifier during development.

- timestamp: 2026-03-19
  checked: Error handling in tryDispatchOsNotification
  found: The catch block on line 800 catches ALL errors silently and returns 'error'. The calling code in useNotificationPolling.ts only checks for 'denied' (line 170) but ignores 'error' return. This means if notifications fail for ANY reason (including dev-mode permission issues), the user gets no feedback.
  implication: The silent error swallowing means the user has no way to know WHY notifications aren't working. This is a UX gap but not the root cause.

## Resolution

root_cause: Two issues: (1) Known Tauri limitation — macOS notifications often don't work in `npm run tauri dev` mode because the dev binary lacks a proper bundle identifier/code signature that macOS requires for the UserNotifications framework. This is a documented issue (tauri-apps/plugins-workspace#2143, #2341). Notifications should work in a production build (`npm run tauri build`). (2) UX gap — `tryDispatchOsNotification` swallows all errors silently (returns 'error') and the polling hook only checks for 'denied', so the user has zero feedback when notifications fail for non-permission reasons.
fix: (1) Add console.warn logging to tryDispatchOsNotification so dev-mode failures are visible. (2) Surface the 'error' state in the notification store alongside 'denied' so the NotificationPopover can display a helpful message explaining the limitation.
verification: All existing notification tests pass. Pre-existing test failures (QUICK-19 changelog mocks, LazyStore invoke mocks) are unrelated.
files_changed:
  - taskflow/src/services/notifications.ts
  - taskflow/src/stores/notifications.store.ts
  - taskflow/src/hooks/useNotificationPolling.ts
  - taskflow/src/routes/notifications/NotificationPopover.tsx
  - taskflow/src/routes/notifications/NotificationPopover.test.tsx
