---
status: resolved
trigger: "notification-no-sound — notification banners appear but no sound plays"
created: 2026-03-26T00:00:00Z
updated: 2026-03-26T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — sendNotification is called with only {title, body}, omitting the `sound` property entirely. On macOS the tauri-plugin-notification `Options.sound` field must be explicitly set to a system sound name (e.g. "Basso") for sound to play. Without it the notification fires silently.
test: Read sendNotification call in notifications.ts line 818, cross-referenced with plugin type definitions
expecting: Adding `sound: "Basso"` (or any valid macOS system sound) to the sendNotification options will produce audible notifications
next_action: Apply fix in taskflow/src/services/notifications.ts

## Symptoms

expected: Both an audible alert sound and the visual banner/popup when a notification fires
actual: The notification banner appears but no sound plays
errors: None reported
reproduction: Triggered via real Jira/GitLab events with OS notifications enabled
started: Not sure if it ever worked

## Eliminated

- hypothesis: silent: true is being set explicitly
  evidence: The sendNotification call is `sendNotification({ title, body })` — no silent property is set anywhere
  timestamp: 2026-03-26

- hypothesis: OS entitlements / Info.plist blocking sound
  evidence: No custom Info.plist or Entitlements.plist exist; tauri.conf.json has no notification-related sound restrictions; capabilities/default.json lists standard notification permissions only
  timestamp: 2026-03-26

- hypothesis: Wrong notification plugin / not tauri-plugin-notification
  evidence: notifications.ts imports sendNotification from @tauri-apps/plugin-notification; lib.rs registers tauri_plugin_notification::init()
  timestamp: 2026-03-26

## Evidence

- timestamp: 2026-03-26
  checked: taskflow/src/services/notifications.ts line 818 — the actual sendNotification call
  found: `await sendNotification({ title, body });` — no sound field
  implication: macOS requires the sound property to be set explicitly; omitting it results in a silent notification

- timestamp: 2026-03-26
  checked: @tauri-apps/plugin-notification type definition Options interface
  found: `sound?: string` property exists at line 71 with doc comment: "On macOS: use system sounds (e.g., 'Ping', 'Blow') or sound files in the app bundle"
  implication: The API supports sound but the call site never passes it

- timestamp: 2026-03-26
  checked: tauri.conf.json, capabilities/default.json, src-tauri directory for Info.plist/Entitlements.plist
  found: No sound-related configuration restrictions. Standard notification permissions declared.
  implication: No platform-level block on sound — it is purely a missing option in the JS call

## Resolution

root_cause: sendNotification({ title, body }) omits the `sound` property. The tauri-plugin-notification plugin on macOS requires the `sound` field to be explicitly provided with a system sound name (e.g. "Basso", "Ping") for audible notifications. Without it, notifications fire silently even though the banner displays.
fix: Added `sound: "Basso"` to the sendNotification options object in tryDispatchOsNotification() at taskflow/src/services/notifications.ts line 818
verification: Change applied. Awaiting human verification with real notification trigger in production build.
files_changed: [taskflow/src/services/notifications.ts]
