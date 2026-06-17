---
phase: quick-260617-dd2
plan: "01"
subsystem: shortcuts
tags: [keyboard-shortcut, command-palette, tauri, hotkeys]
dependency_graph:
  requires: []
  provides: [cmd+f-opens-palette]
  affects: [command-palette, menu-bar, keyboard-shortcuts-panel]
tech_stack:
  added: []
  patterns: [useHotkeys, tauri-menu-accelerator]
key_files:
  modified:
    - taskflow/src/main.tsx
    - taskflow/src-tauri/src/lib.rs
    - taskflow/src/lib/shortcuts.ts
decisions:
  - "Clean break: cmd+k removed entirely, no alias kept — per explicit user decision"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-17"
---

# Phase quick-260617-dd2 Plan 01: Remap Command Palette Shortcut Summary

**One-liner:** Remapped the command palette shortcut from cmd+k to cmd+f across all three registration points — web hotkey, Tauri native menu accelerator, and display registry.

## What Was Built

Three minimal string substitutions to move the command palette shortcut from cmd+k to cmd+f:

1. `taskflow/src/main.tsx` — changed `useHotkeys('mod+k', ...)` to `useHotkeys('mod+f', ...)`. The existing `e.preventDefault()` call is preserved; this suppresses WKWebView's native find-in-page bar when cmd+f is pressed.

2. `taskflow/src-tauri/src/lib.rs` — changed the Command Palette menu item accelerator from `"CmdOrCtrl+K"` to `"CmdOrCtrl+F"`.

3. `taskflow/src/lib/shortcuts.ts` — updated the `open-palette` entry: `defaultKey` changed from `'⌘K'` to `'⌘F'`, `displayKeys` changed from `['⌘', 'K']` to `['⌘', 'F']`.

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Remap cmd+k to cmd+f (all three registration points) | a6d16d14 |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — the shortcut only opens the command palette UI (setPaletteOpen(true)); no privileged action taken.

## Self-Check: PASSED

- `taskflow/src/main.tsx` contains `mod+f` and no `mod+k` near setPaletteOpen: CONFIRMED
- `taskflow/src-tauri/src/lib.rs` contains `CmdOrCtrl+F`: CONFIRMED
- `taskflow/src/lib/shortcuts.ts` contains `⌘F` for open-palette entry: CONFIRMED
- Commit a6d16d14 exists: CONFIRMED
- Pre-existing biome warnings (chart.tsx, MyTasksPage.tsx) and tsc errors (MyTaskRow.tsx) are out-of-scope — not introduced by this task
