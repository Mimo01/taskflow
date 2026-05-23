---
phase: 65-tech-debt-cleanup
plan: "01"
subsystem: worklogs-ui, tempo-types, sidebar-test
tags: [bug-fix, tech-debt, react-cleanup, type-architecture]
dependency_graph:
  requires: []
  provides: [CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05]
  affects:
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
    - taskflow/src/services/tempo/types.ts
    - taskflow/src/stores/tempo-filters.store.ts
    - taskflow/src/components/app/Sidebar.test.tsx
tech_stack:
  added: []
  patterns:
    - useEffect cleanup return for setTimeout refs
    - React.Fragment with key on map callback returns
    - Type export from service layer (not route components)
key_files:
  created: []
  modified:
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
    - taskflow/src/routes/worklogs/WorklogsPage.test.tsx
    - taskflow/src/services/tempo/types.ts
    - taskflow/src/stores/tempo-filters.store.ts
    - taskflow/src/components/app/Sidebar.test.tsx
decisions:
  - "CLEAN-02 (D-01): isError alone (not isError && !data) — error takes precedence over cached empty result"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-23"
  tasks_completed: 3
  files_modified: 5
---

# Phase 65 Plan 01: WorklogsPage Debt Cleanup + Type Architecture Fix Summary

Five carried React and type-architecture debt items surgically fixed: timer memory leak (CLEAN-01), suppressed error UI (CLEAN-02), React fragment key warnings (CLEAN-03), store-to-route type import inversion (CLEAN-04), and stale sidebar test mock (CLEAN-05). All 44 WorklogsPage tests and 7 Sidebar tests pass; `npm run build` green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| Pre | Commit pending tauri-storage fix (D-07) | f57e01bc | tauri-storage.ts, tauri-storage.test.ts |
| 1 | WorklogsPage timer cleanup, error state, keyed fragments (CLEAN-01, 02, 03) | c2c845d4 | WorklogsPage.tsx, WorklogsPage.test.tsx |
| 2 | Move DatePreset to tempo service types, fix store import (CLEAN-04) | 16bbe922 | types.ts, WorklogsPage.tsx, tempo-filters.store.ts |
| 3 | Remove stale workload sidebar test mock (CLEAN-05) | f204cbec | Sidebar.test.tsx |

## What Was Built

### CLEAN-01: Timer cleanup useEffect

Added `useEffect(() => { return () => { if (closeTimer.current) clearTimeout(closeTimer.current); }; }, [])` cleanup alongside existing effects. Prevents post-unmount `setOpen(false)` firing when a combobox blur timer is still pending at component teardown.

Also added `import React, { ... }` (namespace required for CLEAN-03).

### CLEAN-02: Error state condition

Changed `isError && !data` to `isError` at line 960 (after CLEAN-01 insertion). React Query caches stale data as `[]` (truthy empty array) after a successful empty fetch; the old condition hid `ErrorState` on subsequent failures. Now `ErrorState` renders whenever the query is in error state, per D-01.

### CLEAN-03: Keyed hierarchy fragments

Replaced two shorthand `<></>` fragments returned by `.map()` callbacks with `<React.Fragment key={epicKey}>` and `<React.Fragment key={storyKey}>` at the epic and story iterator sites. Both closing `</>` tags updated to `</React.Fragment>`. The inner `<tr>` key attributes that duplicated the fragment keys were removed (fragment is now the keyed root). No React "each child should have unique key" console warnings in hierarchy renders.

### CLEAN-04: DatePreset type architecture fix

Moved `DatePreset` union type from `WorklogsPage.tsx` (route component) to `services/tempo/types.ts` (service layer). Updated:
- `WorklogsPage.tsx`: removed `export type DatePreset = ...` block, added `import type { DatePreset } from '@/services/tempo/types'`
- `tempo-filters.store.ts`: changed import from `'../routes/worklogs/WorklogsPage'` to `'../services/tempo/types'`

No other files imported DatePreset from WorklogsPage. `npm run build` passes with both tsc and Vite bundle steps.

### CLEAN-05: Sidebar test mock cleanup

Removed `{ id: 'workload', visible: true }` from the `sidebarItems` mock array in `Sidebar.test.tsx`. The workload page was deleted in Phase 59 (v1.9 dashboard cleanup); this stale entry was orphaned. Array reduced from 11 to 10 items. Test count unchanged at 7.

## Test Coverage Added

| Test | Covers | Result |
|------|--------|--------|
| CLEAN-01: timer cleanup unmount | unmounts with pending blur timer, asserts no act() warning | Pass |
| CLEAN-02: ErrorState with cached [] | forces isError=true, asserts ErrorState visible | Pass |
| CLEAN-03: no key warnings in hierarchy | renders 2 epics × 2 stories, asserts no console.error /key/ calls | Pass |

Total: 44 WorklogsPage tests + 7 Sidebar tests (31 in Sidebar suite) = 75 passing.

## Verification Results

```
grep -c "isError && !data" WorklogsPage.tsx  → 0
grep -c "<React.Fragment key=" WorklogsPage.tsx  → 2
grep -c "export type DatePreset" services/tempo/types.ts  → 1
grep -c "export type DatePreset" WorklogsPage.tsx  → 0
grep -rn "DatePreset.*from.*routes/worklogs" src/  → (no output)
grep -c "workload" Sidebar.test.tsx  → 0
npm test WorklogsPage Sidebar → 75 passed
npm run build → built in 3.72s
```

## Deviations from Plan

### Pre-execution: Committed tauri-storage.ts pre-condition (D-07)

Per CONTEXT.md D-07, committed the pending `tauri-storage.ts` and `tauri-storage.test.ts` modifications as a standalone commit (`f57e01bc`) before any phase-65 plan work. These files were already modified in the working tree and must not be mixed into plan commits.

### Node modules symlink for worktree test execution

The worktree's `taskflow/` directory lacked a `node_modules` installation. Symlinked `/Users/mimo/Documents/Projects/taskflow/taskflow/node_modules` into the worktree's `taskflow/node_modules` to allow `npm test` to run against the worktree's modified files. This is infrastructure setup, not a code deviation.

## Known Stubs

None. All five items are complete surgical fixes with no placeholder code.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are client-side React component lifecycle, a type definition move, and a test mock update.

## Self-Check

- [x] `WorklogsPage.tsx` modified: line 29 import contains `import React, {`
- [x] `clearTimeout(closeTimer.current)` present in useEffect cleanup return
- [x] `isError && !data` count = 0
- [x] `<React.Fragment key=` count = 2
- [x] `export type DatePreset` in `services/tempo/types.ts` = 1
- [x] `export type DatePreset` in `WorklogsPage.tsx` = 0
- [x] No DatePreset import from routes/worklogs anywhere
- [x] `workload` count in `Sidebar.test.tsx` = 0
- [x] All commits exist: c2c845d4, 16bbe922, f204cbec
- [x] Build passes: `npm run build` exits 0

## Self-Check: PASSED
