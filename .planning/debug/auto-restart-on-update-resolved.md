---
status: resolved
trigger: "The auto restart on app updates doesn't work. The user wants to remove the auto-restart logic entirely and just have the app restart normally."
created: 2026-03-29T00:00:00Z
updated: 2026-03-29T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - ReadyView countdown was the broken auto-restart mechanism
test: Removed ReadyView, now invoke('plugin:process|relaunch') is called directly after download
expecting: App relaunches immediately when download completes, no countdown
next_action: Human verification

## Symptoms

expected: When the app updates, it should restart properly
actual: The auto-restart on app updates doesn't work
errors: Unknown
reproduction: Trigger an app update
started: Current state

## Eliminated

## Evidence

- timestamp: 2026-03-29T00:00:00Z
  checked: taskflow/src/components/update/UpdateDialog.tsx
  found: ReadyView component renders a 10-second countdown timer. When seconds reaches 0, it calls invoke('plugin:process|relaunch'). This is the auto-restart logic.
  implication: The auto-restart happens via a useEffect countdown in ReadyView, not directly after download

- timestamp: 2026-03-29T00:00:00Z
  checked: taskflow/src/components/update/UpdateDialog.tsx handleUpdateNow()
  found: After downloadAndInstall resolves, it calls setReady() which transitions status to 'ready', rendering ReadyView with the countdown
  implication: The countdown/auto-restart is triggered by the 'ready' status transition

- timestamp: 2026-03-29T00:00:00Z
  checked: taskflow/src/stores/update.store.ts
  found: 'ready' is a valid UpdateStatus. setReady() transitions to this state.
  implication: The 'ready' status and ReadyView are the sole mechanism for the auto-restart countdown

## Resolution

root_cause: Auto-restart logic lived in ReadyView component (UpdateDialog.tsx). A useEffect countdown fired invoke('plugin:process|relaunch') after a 10s timer. This indirect mechanism was fragile. The user wants it removed entirely.
fix: Removed ReadyView component, removed 'ready' status from UpdateStatus type, removed setReady() from store. After downloadAndInstall completes in handleUpdateNow, invoke('plugin:process|relaunch') is now called directly and immediately.
verification: All 37 tests pass (vitest run on affected files). New test confirms invoke is called with 'plugin:process|relaunch' after successful download.
files_changed: [taskflow/src/components/update/UpdateDialog.tsx, taskflow/src/stores/update.store.ts, taskflow/src/stores/update.store.test.ts, taskflow/src/components/update/UpdateDialog.test.tsx, taskflow/src/components/about/AboutDialog.test.tsx, taskflow/src/routes/settings/UpdatesSection.test.tsx]
