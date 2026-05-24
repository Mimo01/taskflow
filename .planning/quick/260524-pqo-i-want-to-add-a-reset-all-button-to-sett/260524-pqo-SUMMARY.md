---
phase: quick-260524-pqo
plan: "01"
subsystem: settings
tags: [settings, reset, auth, stronghold, zustand, tdd]
dependency_graph:
  requires: []
  provides: [resetSettings, resetAuth, reset-ui-rows]
  affects: [settings.store, auth.store, DebugModeSection]
tech_stack:
  added: []
  patterns: [zustand-merge-reset, tdd-red-green]
key_files:
  created: []
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/auth.store.ts
    - taskflow/src/stores/settings.store.test.ts
    - taskflow/src/routes/settings/DebugModeSection.tsx
decisions:
  - "Extracted initialSettings const above create() so reset spreads a static object — avoids repeated inline default maintenance"
  - "initialAuthState mirrors the same pattern in auth.store for consistency"
  - "resetSettings uses set((s) => ...) callback form for 'preferences' scope to read current custom field keys before overwriting"
  - "sidebarItems excluded from initialSettings and always provided fresh via getDefaultSidebarItems() to avoid shared array reference"
  - "handleResetAll uses useSettingsStore.getState() / useAuthStore.getState() directly (outside React hooks) since it runs in an async event handler"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-24T16:47:48Z"
  tasks_completed: 2
  files_modified: 4
---

# Phase quick-260524-pqo Plan 01: Reset All Button Summary

**One-liner:** Three scoped reset actions (wizard/preferences/all) with confirm dialogs in Settings > Advanced, backed by `resetSettings(scope)` and `resetAuth()` Zustand store actions that use merge-mode set to preserve action functions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED  | Failing unit tests for reset actions | 5ced9cb7 | settings.store.test.ts |
| GREEN | resetSettings + resetAuth store actions | b58375f0 | settings.store.ts, auth.store.ts |
| 2    | Three reset rows with confirm dialogs | 841c5a58 | DebugModeSection.tsx |

## What Was Built

### Store layer

**`taskflow/src/stores/settings.store.ts`**
- Added `initialSettings` const (52 data fields, no actions, no sidebarItems) declared above `create()`
- Factory now spreads `...initialSettings` + `sidebarItems: getDefaultSidebarItems()` instead of inlining all defaults
- Added `resetSettings(scope: 'preferences' | 'all')` action:
  - `'all'`: spreads `{ ...initialSettings, sidebarItems: getDefaultSidebarItems() }`
  - `'preferences'`: same spread but preserves `onboardingComplete` + 7 custom field keys from current state
  - Uses merge-mode `set()` — action functions always survive

**`taskflow/src/stores/auth.store.ts`**
- Added `initialAuthState` const (12 data fields, excludes `_hasHydrated` and actions)
- Factory spreads `...initialAuthState` + `_hasHydrated: false` explicitly
- Added `resetAuth()` action: `set({ ...initialAuthState })` — preserves `_hasHydrated` and all actions via merge mode

### UI layer

**`taskflow/src/routes/settings/DebugModeSection.tsx`**
- New "Reset" subsection below the existing "Data" block
- Row 1 "Reset onboarding wizard": calls `setOnboardingComplete(false)` — wizard re-runs reactively without restart
- Row 2 "Reset preferences": calls `resetSettings('preferences')` — keeps connection/field-key config
- Row 3 "Reset all": async handler calls `resetSettings('all')` + `resetAuth()` + `removeSecret('jira-pat')` + `removeSecret('gitlab-pat')` (errors swallowed)
- Each row has its own `<Dialog>` with `<DialogContent showCloseButton={false}>`, Cancel + destructive Reset buttons matching the existing Clear-notification-cache pattern
- Inline success feedback via `resetDone: null | 'wizard' | 'preferences' | 'all'` state, 3-second timeout, Check icon + "Done" text

### Tests

**`taskflow/src/stores/settings.store.test.ts`**
- 23 new tests in two describe blocks:
  - `settings.store — reset actions (quick 260524-pqo)`: 16 tests covering all/preferences scopes, defaults restored, preserved fields kept, action functions survive
  - `auth.store — resetAuth() (quick 260524-pqo)`: 8 tests covering all identity fields cleared, _hasHydrated preserved, action functions survive
- All 59 tests pass

## Verification

- `npm run test -- settings.store`: 59/59 passed
- `npx tsc --noEmit`: no type errors
- `npm run lint`: no errors in changed files (875 pre-existing warnings, unchanged)
- `npm run build`: succeeded in 3.94s

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced beyond what the threat model anticipated.

## TDD Gate Compliance

- RED gate commit: `5ced9cb7` (test(quick-260524-pqo-01): add failing tests...)
- GREEN gate commit: `b58375f0` (feat(quick-260524-pqo-01): add resetSettings + resetAuth...)
- Both gates present. No REFACTOR pass needed (code was clean on first pass).

## Self-Check: PASSED

- taskflow/src/stores/settings.store.ts: FOUND
- taskflow/src/stores/auth.store.ts: FOUND
- taskflow/src/stores/settings.store.test.ts: FOUND
- taskflow/src/routes/settings/DebugModeSection.tsx: FOUND
- Commit 5ced9cb7: FOUND
- Commit b58375f0: FOUND
- Commit 841c5a58: FOUND
