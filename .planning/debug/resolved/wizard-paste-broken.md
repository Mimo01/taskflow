---
status: resolved
trigger: "Pasting text into inputs doesn't work in the wizard process"
created: 2026-03-29T00:00:00Z
updated: 2026-03-29T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — Tauri app menu in lib.rs has no Edit menu. On macOS, Cmd+V/Cmd+C/Cmd+X are routed through the OS menu system. Without PredefinedMenuItem::paste/copy/cut/select_all/undo/redo in an Edit submenu, the webview never receives these keystrokes.
test: Checked lib.rs — only App/Go/Help menus exist. No Edit menu. PredefinedMenuItem::paste exists in tauri-2.10.3.
expecting: Adding an Edit menu with clipboard predefined items will restore paste (and copy/cut/undo/redo) in all webview inputs.
next_action: Add Edit menu to lib.rs

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: When user pastes text (Cmd+V) into wizard input fields, the pasted text should appear in the input
actual: Nothing appears when pasting - the paste action is completely ignored
errors: No error messages reported
reproduction: Open any wizard step, focus an input field, try to paste text via Cmd+V
started: Not specified
typing: Manual keystroke-by-keystroke typing works fine in the same inputs
scope: All wizard steps are affected, not just specific ones

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Wizard inputs use onKeyDown/onKeyPress instead of onChange
  evidence: JiraStep.tsx and GitLabStep.tsx both use standard React onChange on the Input component
  timestamp: 2026-03-29

- hypothesis: base-ui Input component swallows paste events
  evidence: mergeProps in base-ui composes event handlers; onChange fires on paste in React's synthetic event model; both internal and external onChange handlers fire
  timestamp: 2026-03-29

- hypothesis: Zustand store filters or rejects pasted values
  evidence: onboarding.store.ts set() is a plain Zustand setter — no filtering
  timestamp: 2026-03-29

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-29
  checked: taskflow/src/routes/onboarding/JiraStep.tsx, GitLabStep.tsx
  found: Both use standard onChange={(e) => set({ field: e.target.value })} on Input components
  implication: Input handling is correct — issue is not in the React component layer

- timestamp: 2026-03-29
  checked: taskflow/src/components/ui/input.tsx
  found: Input wraps @base-ui/react/input which renders Field.Control
  implication: Needed to trace base-ui event handling

- timestamp: 2026-03-29
  checked: @base-ui/react FieldControl.js and mergeProps.js
  found: mergePropsN composes event handlers — both internal and external onChange both fire. No paste suppression.
  implication: base-ui is not the source of the problem

- timestamp: 2026-03-29
  checked: taskflow/src-tauri/src/lib.rs — full menu construction
  found: App menu has App/Go/Help submenus only. NO Edit menu. No PredefinedMenuItem::paste/copy/cut/select_all/undo/redo anywhere.
  implication: ROOT CAUSE — on macOS, clipboard keyboard shortcuts (Cmd+V, Cmd+C, Cmd+X, Cmd+A, Cmd+Z, Cmd+Y) are routed through the OS menu system. Without an Edit menu containing the standard clipboard predefined items, macOS never dispatches these shortcuts to the webview, so paste is completely blocked.

- timestamp: 2026-03-29
  checked: ~/.cargo/registry/src/.../tauri-2.10.3/src/menu/predefined.rs
  found: PredefinedMenuItem::paste, copy, cut, select_all, undo, redo are all available in the installed Tauri version
  implication: Fix is straightforward — add an Edit submenu with these items

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: The Tauri app in lib.rs defines a custom macOS menu bar (App, Go, Help) but omits a standard Edit menu. On macOS, clipboard keyboard shortcuts (Cmd+V, Cmd+C, Cmd+X, Cmd+A, Cmd+Z) are dispatched via the menu system. Without PredefinedMenuItem::paste/copy/cut/select_all/undo/redo in the menu, macOS never routes these keystrokes to the webview — so paste (and copy, cut, undo, redo) silently does nothing in all text inputs.
fix: Added Edit submenu to the Tauri menu bar in lib.rs with PredefinedMenuItem::undo, redo, separator, cut, copy, paste, select_all. Menu order is App > Edit > Go > Help. Cargo check passes cleanly.
verification: Rust compilation passes (`cargo check` clean). Needs runtime verification in the running app.
files_changed: [taskflow/src-tauri/src/lib.rs]
