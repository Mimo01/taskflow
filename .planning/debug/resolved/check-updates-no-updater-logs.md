---
name: check-updates-no-updater-logs
status: resolved
trigger: "When I click check updates in settings, I don't see any call with 'updater' group logged in dev tools logs"
created: 2026-05-26
updated: 2026-05-26
---

## Symptoms

- **Expected:** Updater makes a network call and logs appear with 'updater' group in dev tools (exact expected behavior not fully known)
- **Actual:** No logs appear in dev tools console when "Check Now" is clicked in Settings > Updates
- **Errors:** Not confirmed — user unsure if any errors present
- **Timeline:** Unknown — unclear if this ever worked
- **Reproduction:** Settings > Updates > "Check Now" button click

## Current Focus

hypothesis: "handleCheckNow in UpdatesSection.tsx calls updaterService.check() directly but never calls appendLog — only the automatic polling hook (useUpdatePolling.ts) appends updater log entries"
test: "Grep confirmed: appendLog is imported and called only in useUpdatePolling.ts, not in UpdatesSection.tsx"
expecting: "Adding appendLog calls inside handleCheckNow (both success and error paths) will produce 'updater' group entries in dev tools when Check Now is clicked"
next_action: "apply fix"
reasoning_checkpoint: "There are two code paths that invoke updaterService.check(): (1) useUpdatePolling.ts — automatic polling, which does appendLog; (2) handleCheckNow in UpdatesSection.tsx — manual button press, which does NOT appendLog. The manual path is the one triggered by 'Check Now'."

## Evidence

- timestamp: 2026-05-26T00:00:00Z
  file: taskflow/src/services/updater.ts
  note: "updaterService.check() — thin wrapper around @tauri-apps/plugin-updater check(). No logging inside the service itself."

- timestamp: 2026-05-26T00:00:01Z
  file: taskflow/src/hooks/useUpdatePolling.ts
  note: "appendLog called on lines 49-59 (update available), 61-72 (up to date), 79-90 (error). All three paths log source: 'updater'."

- timestamp: 2026-05-26T00:00:02Z
  file: taskflow/src/routes/settings/UpdatesSection.tsx
  note: "handleCheckNow (lines 172-196): calls updaterService.check() directly, updates store, sets local checkState — but never imports or calls appendLog."

- timestamp: 2026-05-26T00:00:03Z
  note: "Also confirmed: IS_DEV_BUILD guard in updater.ts returns null early for dev builds (version includes '-dev'). In dev, updaterService.check() returns null immediately — no Tauri IPC call — so even the polling hook logs 'up to date' but the manual button gets no log at all."

## Eliminated

- Bug in debug-log.store.ts — store is correct, append works fine
- Bug in DebugLogs.tsx viewer — renders all entries with source 'updater' correctly
- IS_DEV_BUILD causing a crash — it just returns null, handleCheckNow handles null fine

## Resolution

root_cause: "handleCheckNow in UpdatesSection.tsx calls updaterService.check() directly without calling appendLog — the logging code lives exclusively in useUpdatePolling.ts (the automatic polling hook), so manual 'Check Now' clicks produce no debug log entries"
fix: "Import useDebugLogStore in UpdatesSection.tsx and add appendLog calls inside handleCheckNow mirroring the three log paths already in useUpdatePolling.ts (available, up-to-date, error)"
verification: "appendLog calls added on all three paths (available, up-to-date, error) in handleCheckNow — types confirmed against ApiLogEntry interface"
files_changed: "taskflow/src/routes/settings/UpdatesSection.tsx"
