---
phase: 19-keyboard-foundation
plan: "04"
subsystem: ui
tags: [react-hotkeys-hook, keyboard-shortcuts, hotkey, layout-independent]

# Dependency graph
requires:
  - phase: 19-keyboard-foundation
    provides: shortcuts.ts SHORTCUTS array, KeyboardShortcutsPanel component, useHotkeys wiring in main.tsx
provides:
  - mod+/ hotkey (Cmd+/ macOS, Ctrl+/ Windows/Linux) replaces bare ? for show-shortcuts
  - Layout-independent keyboard shortcut for opening the shortcuts panel
  - Updated KeyboardShortcutsPanel test suite matching ⌘/ display badge
affects:
  - 20-command-palette
  - any future phase adding keyboard shortcuts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "defaultKey field in ShortcutEntry serves as display label rendered in <kbd> badge — hotkey binding string passed directly to useHotkeys"
    - "mod+/ convention for cross-platform modifier+key shortcuts in react-hotkeys-hook"

key-files:
  created: []
  modified:
    - taskflow/src/lib/shortcuts.ts
    - taskflow/src/main.tsx
    - taskflow/src/components/app/KeyboardShortcutsPanel.test.tsx
    - taskflow/src/components/app/KeyboardShortcutsPanel.tsx

key-decisions:
  - "defaultKey for show-shortcuts set to '⌘/' (display label) rather than 'mod+/' — avoids adding displayKey field to ShortcutEntry interface while keeping <kbd> badge readable"
  - "useHotkeys('mod+/') hardcoded in main.tsx independent of SHORTCUTS array — panel renders defaultKey verbatim, so display and binding strings are intentionally decoupled"

patterns-established:
  - "Display label vs binding string: SHORTCUTS defaultKey = what <kbd> shows; useHotkeys arg = react-hotkeys-hook binding string"

requirements-completed: [KEYS-01, KEYS-07]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 19 Plan 04: Hotkey ? to mod+/ Gap Closure Summary

**Replaced layout-dependent bare `?` shortcut with `mod+/` (Cmd+/ on macOS, Ctrl+/ elsewhere) for opening the keyboard shortcuts panel**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-15T22:00:58Z
- **Completed:** 2026-03-15T22:04:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `useHotkeys('mod+/', ...)` in main.tsx replaces `useHotkeys('?', ...)` — fires reliably on non-US keyboard layouts
- `shortcuts.ts` show-shortcuts `defaultKey` changed to `'⌘/'` so the panel renders the correct symbol badge
- All 8 KeyboardShortcutsPanel tests updated and passing; full suite (412 tests) passes with 0 failures
- No `?` bare-key hotkey references remain in src/

## Task Commits

Each task was committed atomically:

1. **Task 1: Change hotkey from ? to mod+/ across all three files** - `8e37ec6` (feat)
2. **Task 2: Run full test suite and verify no regressions** - (verification only, no new files changed)

**Plan metadata:** (docs commit — created below)

## Files Created/Modified

- `taskflow/src/lib/shortcuts.ts` - `defaultKey` for show-shortcuts changed to `'⌘/'`; JSDoc example updated to `'mod+/'`
- `taskflow/src/main.tsx` - `useHotkeys('mod+/', ...)` replaces `useHotkeys('?', ...)`; comments updated
- `taskflow/src/components/app/KeyboardShortcutsPanel.test.tsx` - Test name and assertion updated to expect `'⌘/'` badge; KEYS-07 structural test comment updated to reference `mod+/`
- `taskflow/src/components/app/KeyboardShortcutsPanel.tsx` - JSDoc updated to reference `mod+/`/Cmd+/

## Decisions Made

- Used `defaultKey: '⌘/'` (display label) in shortcuts.ts rather than `'mod+/'` because the component renders `entry.defaultKey` verbatim as `<kbd>` text. The `useHotkeys` call in main.tsx independently uses `'mod+/'` as the binding string. This avoids adding a new `displayKey` field to the `ShortcutEntry` interface and keeps the solution minimal.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The full test suite showed 18 pre-existing "Unhandled Rejection" errors from `gitlab.test.ts` unrelated to our changes (missing Tauri mock for auth.store) — these are out-of-scope pre-existing failures and were not touched.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All keyboard shortcut infrastructure (react-hotkeys-hook, shortcuts.ts, KeyboardShortcutsPanel) is complete and stable
- Phase 19 keyboard foundation is fully done — ready for Phase 20 (Command Palette + Recent Items) which will use `mod+k` following the same `mod+` pattern

---
*Phase: 19-keyboard-foundation*
*Completed: 2026-03-15*
