---
phase: 39-update-ux-version-policy
plan: "01"
subsystem: update-ux
tags: [update, dialog, settings-store, whats-new, tauri, react]
dependency_graph:
  requires:
    - taskflow/src/stores/update.store.ts
    - taskflow/src/services/updater.ts
    - taskflow/src/lib/build-info.ts
    - taskflow/src/components/ui/dialog.tsx
    - taskflow/src/components/ui/button.tsx
    - taskflow/src/hooks/useUpdatePolling.ts
  provides:
    - taskflow/src/components/update/UpdateDialog.tsx
    - taskflow/src/components/update/WhatsNewDialog.tsx
    - settings store v11 with lastSeenVersion/lastSeenChangelog
  affects:
    - taskflow/src/main.tsx
    - taskflow/src/stores/settings.store.ts
tech_stack:
  added: []
  patterns:
    - Dialog state machine driven by Zustand store status
    - TDD red-green cycle for dialog components
    - Non-dismissable dialogs via omitted onOpenChange (D-06)
    - relaunch via invoke('plugin:process|relaunch') — plugin-process not installed
key_files:
  created:
    - taskflow/src/components/update/UpdateDialog.tsx
    - taskflow/src/components/update/WhatsNewDialog.tsx
    - taskflow/src/components/update/UpdateDialog.test.tsx
    - taskflow/src/components/update/WhatsNewDialog.test.tsx
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/main.tsx
decisions:
  - "[39-01] Used invoke('plugin:process|relaunch') instead of @tauri-apps/plugin-process — package not in project dependencies"
metrics:
  duration: 6min
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_changed: 6
---

# Phase 39 Plan 01: Update Dialog Lifecycle + What's New Summary

Update dialog lifecycle with available/downloading/ready/error views, post-update "What's New" dialog, settings store v11 migration, and AppLayout wiring — all using TDD.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Settings store v11 migration + UpdateDialog component | 8df037c | Done |
| 2 | WhatsNewDialog component + AppLayout wiring | ee665ed | Done |

## What Was Built

### Settings Store v11 Migration

- Bumped `version` from 10 to 11 in `settings.store.ts`
- Added `lastSeenVersion: string | null` and `lastSeenChangelog: string | null` fields
- Added `setLastSeenVersion` and `setLastSeenChangelog` action methods
- Migration block `if (version < 11)` initializes both fields to `null` for existing users

### UpdateDialog Component

Single component with four conditional views driven by `useUpdateStore().status`:

- **AvailableView**: "Update Available" with version info (`v{current} → v{new}`), markdown changelog in scrollable area, "Later" (outline) and "Update Now" (default) buttons
- **DownloadingView**: "Downloading Update" with progress bar (`role="progressbar"`, `aria-valuenow`), percentage label, "Stop Download" (outline). Non-dismissable (no `onOpenChange`)
- **ReadyView**: "Ready to Restart" with 10-second countdown (`aria-live="polite"`), auto-relaunches at 0s. "Restart Later" returns to available view. Non-dismissable during countdown
- **ErrorView**: "Download Failed" with error text in `text-destructive`, "Dismiss" (outline) and "Retry" (destructive) buttons

All states use `showCloseButton={false}` per D-06.

### WhatsNewDialog Component

- Shows when `lastSeenVersion !== buildInfo.version && lastSeenChangelog !== null`
- Renders last update's changelog markdown in scrollable area
- "Got it" calls `setLastSeenVersion(buildInfo.version)` — dialog won't reappear
- `lastSeenChangelog` NOT cleared on dismiss (kept for future reference per UI-SPEC)

### AppLayout Wiring (main.tsx)

- Added `import { useUpdatePolling }`, `import { UpdateDialog }`, `import { WhatsNewDialog }`
- `useUpdatePolling()` called alongside `useNotificationPolling()`
- `<UpdateDialog />` and `<WhatsNewDialog />` mounted in AppLayout JSX after `<KeyboardShortcutsPanel>`

## Test Results

- `UpdateDialog.test.tsx`: 7/7 tests pass
- `WhatsNewDialog.test.tsx`: 4/4 tests pass
- Full suite: 719 passing (pre-existing failures in ReleasesTab + jira.test.ts are unrelated to this plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used invoke() instead of @tauri-apps/plugin-process for relaunch**

- **Found during:** Task 1 (GREEN phase)
- **Issue:** `@tauri-apps/api/process` does not exist; `relaunch()` requires `@tauri-apps/plugin-process` which is not in project dependencies
- **Fix:** Used `invoke('plugin:process|relaunch')` via `@tauri-apps/api/core` — same underlying IPC mechanism, no new dependency needed. Added comment in ReadyView for clarity
- **Files modified:** `taskflow/src/components/update/UpdateDialog.tsx`

## Self-Check: PASSED

- [x] `taskflow/src/components/update/UpdateDialog.tsx` exists
- [x] `taskflow/src/components/update/WhatsNewDialog.tsx` exists
- [x] `taskflow/src/components/update/UpdateDialog.test.tsx` exists
- [x] `taskflow/src/components/update/WhatsNewDialog.test.tsx` exists
- [x] `taskflow/src/stores/settings.store.ts` has `version: 11`
- [x] `taskflow/src/stores/settings.store.ts` has `lastSeenVersion`
- [x] `taskflow/src/main.tsx` imports and mounts `<UpdateDialog />` and `<WhatsNewDialog />`
- [x] `taskflow/src/main.tsx` calls `useUpdatePolling()`
- [x] Commits 8df037c (Task 1) and ee665ed (Task 2) exist
