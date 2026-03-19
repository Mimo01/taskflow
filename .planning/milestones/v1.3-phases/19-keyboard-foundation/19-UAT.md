---
status: diagnosed
phase: 19-keyboard-foundation
source: 19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md, 19-04-SUMMARY.md
started: 2026-03-15T23:00:00Z
updated: 2026-03-15T23:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Open Keyboard Shortcuts Panel
expected: Press Cmd+/ (macOS) or Ctrl+/ (Windows/Linux) while not focused in a text input. A modal dialog opens listing keyboard shortcuts.
result: issue
reported: "pressing it, nothing happens"
severity: blocker

### 2. Shortcuts Panel Content
expected: The panel shows at least a "General" category heading with two entries: a key badge showing "⌘/" labeled "Show keyboard shortcuts" and "Esc" labeled "Dismiss".
result: skipped
reason: depends on test 1 (panel can't be opened)

### 3. Close Panel with Escape
expected: With the shortcuts panel open, press Esc. The modal closes and you return to the normal app view.
result: skipped
reason: depends on test 1 (panel can't be opened)

### 4. Shortcut Suppressed in Form Inputs
expected: Click into any text input (e.g., task title, search box), then press Cmd+/ (or Ctrl+/). The shortcuts panel does NOT open — the keystroke is consumed by the input or browser.
result: skipped
reason: depends on test 1 (panel can't be opened)

### 5. Search Overlay Closes with Escape
expected: Open the search overlay, start typing in the search input field, then press Esc. The search overlay closes (Escape works even while a text input is focused).
result: pass

## Summary

total: 5
passed: 1
issues: 1
pending: 0
skipped: 3

## Gaps

- truth: "Pressing Cmd+/ opens the keyboard shortcuts panel"
  status: failed
  reason: "User reported: pressing it, nothing happens"
  severity: blocker
  test: 1
  root_cause: "react-hotkeys-hook v5.2.4 key-naming bug: useHotkeys('mod+/') stores key as '/' but real KeyboardEvents produce event.code='Slash' which normalizes to 'slash'. '/' !== 'slash' so handler never fires. Tests pass because jsdom synthetic events bypass normalization."
  artifacts:
    - path: "taskflow/src/main.tsx"
      issue: "useHotkeys('mod+/') uses wrong key name format — should be 'mod+slash'"
    - path: "node_modules/react-hotkeys-hook/dist/index.js"
      issue: "Library key normalization doesn't map '/' to 'slash' (GitHub issue #1125)"
  missing:
    - "Change useHotkeys('mod+/') to useHotkeys('mod+slash') in main.tsx"
    - "Update tests to use 'mod+slash' binding string"
  debug_session: ".planning/debug/mod-slash-hotkey-broken.md"

- truth: "Keyboard shortcut discoverable via native app Help menu on macOS (and equivalents on Windows/Linux)"
  status: failed
  reason: "User requested: add the shortcut to the mac toolbar app help menu and equivalents on other platforms"
  severity: major
  test: 1
  root_cause: "No native menu integration exists — Tauri backend has zero menu items registered in lib.rs and no menu plugin in Cargo.toml"
  artifacts:
    - path: "taskflow/src-tauri/src/lib.rs"
      issue: "No native menu setup"
    - path: "taskflow/src-tauri/Cargo.toml"
      issue: "No tauri-plugin-global-shortcut or menu plugin"
  missing:
    - "Add Tauri menu plugin and create Help menu with 'Keyboard Shortcuts' item (Cmd+/ accelerator)"
    - "Wire menu event to trigger the same panel-open action in the frontend"
