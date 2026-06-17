---
phase: quick
plan: 260617-dta
subsystem: navigation
tags: [keyboard-shortcuts, native-menu, tauri, navigation]
dependency_graph:
  requires: []
  provides: [nav-shortcuts-all-pages]
  affects: [shortcuts.ts, main.tsx, lib.rs]
tech_stack:
  added: []
  patterns: [useHotkeys, Tauri emit/listen, MenuItemBuilder]
key_files:
  created: []
  modified:
    - taskflow/src/lib/shortcuts.ts
    - taskflow/src/main.tsx
    - taskflow/src-tauri/src/lib.rs
decisions:
  - "Go menu restructured with logical groupings: overview (Dashboard/MyTasks/Standup), boards (Sprint/Backlog/Epics), code (MRs), tracking (Releases/Worklogs/Notifications), system (Settings)"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-17"
---

# Phase quick Plan 260617-dta: Add Nav Shortcuts for All Sidebar Pages Summary

Seven keyboard shortcuts (Cmd+Shift+H/T/U/E/M/R/W) wired end-to-end in shortcuts.ts, main.tsx, and lib.rs Go menu for Dashboard, My Tasks, Standup Notes, Epics, Merge Requests, Releases, and Worklogs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Register new nav shortcuts in shortcuts.ts | 05009404 | taskflow/src/lib/shortcuts.ts |
| 2 | Wire shortcuts in main.tsx (useHotkeys + Tauri listeners) | 1885725f | taskflow/src/main.tsx |
| 3 | Add Go menu items and event routing in lib.rs | c21c5613 | taskflow/src-tauri/src/lib.rs |

## What Was Built

- **shortcuts.ts:** 7 new Navigation category entries appended after `nav-devtools`. Each includes `navMeta` with `label` and `route` so they automatically appear in the Command Palette Navigation group (via `NAV_SHORTCUTS` filter) and the Keyboard Shortcuts Panel (via `SHORTCUTS` array) — no changes to those components needed.
- **main.tsx:** 7 `useHotkeys()` calls added after the existing `mod+shift+d` line. 7 `listen('menu-nav-*', ...)` entries added to the Tauri event listener `useEffect` array.
- **lib.rs:** 7 `MenuItemBuilder` declarations with accelerators. Go submenu restructured into logical groups with separators. `on_menu_event` match arm extended with all 7 new IDs.

## Verification

- `cargo build`: Passed cleanly (51s)
- `biome check ./src`: 17 pre-existing warnings, no errors (pre-existing baseline, unchanged)
- `tsc --noEmit`: 2 pre-existing unused variable errors in MyTaskRow.tsx (unrelated to this change)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. All routes are internal client-side navigation; no user-supplied data in paths.

## Self-Check: PASSED

- taskflow/src/lib/shortcuts.ts: contains all 7 nav-* IDs with navMeta
- taskflow/src/main.tsx: contains 7 useHotkeys + 7 listen entries
- taskflow/src-tauri/src/lib.rs: contains 7 MenuItemBuilder declarations + restructured Go menu + extended match arm
- Commits: 05009404, 1885725f, c21c5613 all verified in git log
