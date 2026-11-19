---
status: awaiting-evidence
trigger: "I have just noticed, that in the real app I have stopped getting os notifications. It used to work before"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms

- expected: New notifications (Jira/MR changes) raise a macOS OS banner
- actual: In-app notification panel updates, but no OS banner appears
- errors: none reported
- timeline: Worked mid-v1.14; broke somewhere between then and v1.15.0 (exact version unknown)
- reproduction: Real (installed) app; trigger any notification-worthy change
- os_permissions: TaskFlow allowed in System Settings → Notifications

## Current Focus

hypothesis: Unknown. The app reaches sendNotification for the same items that get in-app banners, and macOS delivers mac-notification-sys notifications for com.taskflow.app (main + worker thread). The break is somewhere in the real app's JS → plugin:notification|notify → show() chain, and only runtime evidence will locate it.
next_action: user (real app, Dev Tools on, app running ≥1 poll after launch) reads the Dev Tools → Notifications outcome for an item that got an in-app banner. Also check the Notifications settings section for a permission-denied/send-error warning. Then branch: 'sent' → plugin/macOS in-process issue (add a Rust test command that calls notify directly); 'error'/'denied' → JS-side; 'catch-up'/'skipped' → gate; no entry → poll path.

## Evidence

- timestamp: 2026-11-19 — plugin registered (lib.rs:243), capabilities allow notify/permission, tryDispatchOsNotification unchanged since 2026-03 (sound 'Basso').
- timestamp: 2026-11-19 — desktopNotificationsEnabled defaults true; v36 migration = on if either old per-source switch was on.
- timestamp: 2026-11-19 — Nov 11-12 rework in window: 3d3927c5 single switch, b1689129 launch catch-up gate (isOsCatchUp mirrors banner gate), fc3e2505 burst summary, 741073c9 (11-16) Jira paging/cursor.
- timestamp: 2026-11-19 — Dev Tools → Notifications tab logs every OS dispatch with outcome (sent/denied/error/skipped/grouped/catch-up), in prod when devToolsEnabled; transient (cleared on restart).

- timestamp: 2026-11-19 — real app settings.json: desktopNotificationsEnabled=true, all type toggles true, devToolsEnabled=true, store v39.
- timestamp: 2026-11-19 — in-app banners DO show; selectBannerItems and isOsCatchUp/existingIds are identical gates → OS send() is reached for those items.
- timestamp: 2026-11-19 — plugin 2.3.3 desktop: permission always Granted; show() = notify-rust → mac-notification-sys 0.6.12 (NSUserNotificationCenter), set_application(identifier) in release, result discarded (`let _ = notification.show()`), so JS always gets 'sent'. Lock versions unchanged since 2026-03.
- timestamp: 2026-11-19 — macOS installs: 27.0.1 (10-03), 27.2 (11-05), 27.2.1 (11-16). Code rework 11-11/12. Both overlap the "mid-1.14" window.
- timestamp: 2026-11-19 — only /Applications/Taskflow.app registered for com.taskflow.app (v1.15.0, adhoc signed, CS identifier "taskflow").
- timestamp: 2026-11-19 — dev build (tauri dev) shares ~/Library/Application Support/com.taskflow.app with the installed app; no cross-instance rehydrate, so it doesn't explain the symptom on its own.

## Eliminated

- hypothesis: macOS 27.2 blocks NSUserNotificationCenter / Taskflow notifications at OS level
  evidence: scratchpad probe (mac-notification-sys 0.6.12, set_application("com.taskflow.app"), sound Basso) → banner shown, from main thread AND a worker thread; Terminal-id and osascript controls also shown.
- hypothesis: WebKit 27.2 native window.Notification blocks the plugin's init-iife shim
  evidence: Swift WKWebView probe: native Notification exists (writable, configurable, permission 'default'), but the "use strict" assignment + defineProperty succeed and the shim takes over.
- hypothesis: Desktop switch turned off (v36 per-source → single switch migration)
  evidence: persisted desktopNotificationsEnabled=true.
- hypothesis: launch catch-up gate suppresses live items
  evidence: in-app banners show, and they use the identical gate.

## Resolution
