---
phase: 19-keyboard-foundation
plan: 03
subsystem: ui
tags: [react, react-hotkeys-hook, base-ui, dialog, keyboard-shortcuts]

# Dependency graph
requires:
  - phase: 19-01
    provides: react-hotkeys-hook installed, test scaffolding established
  - phase: 19-02
    provides: src/lib/shortcuts.ts SHORTCUTS array and types, KeyboardShortcutsPanel.test.tsx RED tests
provides:
  - KeyboardShortcutsPanel component (KEYS-01, KEYS-02) — dialog modal listing all shortcuts
  - useHotkeys('?') wired in AppLayout (KEYS-01, KEYS-07)
  - SearchOverlay Escape handler migrated from raw window listener to useHotkeys
affects: [20-command-palette, 21-header-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dialog-based modal using @base-ui/react/dialog with Dialog.Root + Dialog.Portal + Dialog.Backdrop + Dialog.Popup + Dialog.Title + Dialog.Close"
    - "useHotkeys('?', handler) with no options object — react-hotkeys-hook default disables form inputs (KEYS-07)"
    - "useHotkeys('escape', handler, { enableOnFormTags: true }) — enables Escape even while typing in search input"
    - "fireEvent.keyDown requires { key, code } both set for react-hotkeys-hook to process the event in jsdom (code !== undefined guard)"

key-files:
  created:
    - taskflow/src/components/app/KeyboardShortcutsPanel.tsx
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/components/app/SearchOverlay.tsx
    - taskflow/src/components/app/SearchOverlay.test.tsx

key-decisions:
  - "useHotkeys requires code property in fireEvent.keyDown calls in tests — react-hotkeys-hook guards on s.code !== undefined before processing events"
  - "SearchOverlay Escape test updated to use fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }) — useHotkeys listens on document not window"
  - "No useHotkeys('escape') in KeyboardShortcutsPanel — @base-ui/react/dialog handles Escape natively to avoid double-fire"

patterns-established:
  - "Keyboard shortcut components: never add useHotkeys('escape') inside a Dialog component — Dialog.Root handles it natively"
  - "Test pattern for useHotkeys: always include code property alongside key in fireEvent.keyDown"

requirements-completed: [KEYS-01, KEYS-02, KEYS-07]

# Metrics
duration: 12min
completed: 2026-03-15
---

# Phase 19 Plan 03: Keyboard Foundation Deliverables Summary

**KeyboardShortcutsPanel modal using @base-ui/react/dialog wired to `?` hotkey in AppLayout; SearchOverlay Escape migrated from raw window listener to react-hotkeys-hook**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-15T22:12:00Z
- **Completed:** 2026-03-15T22:16:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created KeyboardShortcutsPanel.tsx — Dialog-based modal reading from SHORTCUTS array, grouped by category, with sr-only close button (all 8 tests green)
- Wired useHotkeys('?') in AppLayout (main.tsx) with shortcutsOpen state and KeyboardShortcutsPanel render
- Removed last raw window.addEventListener('keydown') from the codebase — SearchOverlay now uses useHotkeys('escape', onClose, { enableOnFormTags: true })
- Full vitest suite: 36 test files pass, 412 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create KeyboardShortcutsPanel.tsx** - `c11ad0f` (feat)
2. **Task 2: Wire ? shortcut in AppLayout + migrate SearchOverlay Escape** - `82fbefc` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `taskflow/src/components/app/KeyboardShortcutsPanel.tsx` - New keyboard shortcuts help modal component
- `taskflow/src/main.tsx` - Added useHotkeys('?') hook + shortcutsOpen state + KeyboardShortcutsPanel render in AppLayout
- `taskflow/src/components/app/SearchOverlay.tsx` - Replaced raw window.addEventListener with useHotkeys('escape', onClose, { enableOnFormTags: true })
- `taskflow/src/components/app/SearchOverlay.test.tsx` - Updated Escape test to use fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

## Decisions Made
- react-hotkeys-hook checks `s.code !== void 0` before processing any keydown event — tests must include `code` in fireEvent.keyDown or the callback never fires
- useHotkeys registers on `document` not `window` — changed test dispatch target from window to document
- No Escape hotkey in KeyboardShortcutsPanel itself — Dialog.Root in @base-ui/react/dialog handles Escape natively; adding useHotkeys('escape') inside would cause double-fire

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SearchOverlay Escape test — added code property to fireEvent.keyDown**
- **Found during:** Task 2 (SearchOverlay migration)
- **Issue:** Plan said to change window to document in the Escape test, but fireEvent.keyDown(document, { key: 'Escape' }) still failed — react-hotkeys-hook source guards on `s.code !== void 0` before processing any keydown event, so an event without `code` is silently ignored
- **Fix:** Changed test to `fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })`
- **Files modified:** taskflow/src/components/app/SearchOverlay.test.tsx
- **Verification:** All SearchOverlay tests pass green
- **Committed in:** 82fbefc (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: missing code property in test event)
**Impact on plan:** Auto-fix necessary for test correctness. The plan anticipated updating window→document but didn't anticipate the code property requirement. No scope creep.

## Issues Encountered
- react-hotkeys-hook silently ignores keydown events without a `code` property — this is documented behavior in the source (`s.code !== void 0` guard) but not obvious from the API docs. Verified by reading node_modules source.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 19 complete: react-hotkeys-hook installed, SHORTCUTS registry established, KeyboardShortcutsPanel working, ? hotkey wired, all raw window listeners removed
- Phase 20 (Command Palette) can use the same useHotkeys pattern from AppLayout with Cmd+K
- Future shortcuts: append entries to src/lib/shortcuts.ts — KeyboardShortcutsPanel reads the array with no changes needed

---
*Phase: 19-keyboard-foundation*
*Completed: 2026-03-15*
