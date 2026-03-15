---
status: complete
phase: 19-keyboard-foundation
source: 19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md
started: 2026-03-15T22:30:00Z
updated: 2026-03-15T22:38:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Open Keyboard Shortcuts Panel
expected: Press `?` while not focused in a text input → a modal dialog opens listing keyboard shortcuts grouped by category, with at least a "General" section showing `?` and `Esc` entries
result: issue
reported: "doesn't work — ? requires Shift+, on my keyboard layout and doesn't fire. Want Cmd+key (Mac) or Ctrl+key (other) shortcuts instead"
severity: major

### 2. Shortcuts Panel Content
expected: The shortcuts panel shows two entries: `?` labeled "Show keyboard shortcuts" and `Esc` labeled "Dismiss", both under a "General" category heading
result: skipped
reason: depends on test 1 (panel can't be opened)

### 3. Close Panel with Escape
expected: With the shortcuts panel open, press `Esc` → the modal closes and you return to the normal app view
result: skipped
reason: depends on test 1 (panel can't be opened)

### 4. Shortcut Suppressed in Form Inputs
expected: Click into any text input (e.g., a task title field, the search box), then press `?` → the shortcuts panel does NOT open (the `?` character may be typed into the field instead)
result: skipped
reason: depends on test 1 (shortcut doesn't fire)

### 5. Search Overlay Closes with Escape
expected: Open the search overlay, start typing in the search input field, then press `Esc` → the search overlay closes (Escape works even while a text input is focused)
result: pass

## Summary

total: 5
passed: 1
issues: 1
pending: 0
skipped: 3

## Gaps

- truth: "Pressing the show-shortcuts key opens the keyboard shortcuts panel"
  status: failed
  reason: "User reported: doesn't work — ? requires Shift+, on my keyboard layout and doesn't fire. Want Cmd+key (Mac) or Ctrl+key (other) shortcuts instead"
  severity: major
  test: 1
  artifacts: []
  missing: []
