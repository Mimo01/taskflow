---
phase: 100-host-adoption-editing-workflow
plan: 01
subsystem: wiki-editor
tags: [host-api, shortcuts, test-stub, descope]
requires: []
provides:
  - WikiEditorHandle (focus, blur, insertFiles) and placeholder/autoFocus/onSubmit/onCancel/ref props
  - editor-submit and editor-cancel shortcut rows
  - "@/test/wiki-editor-stub (WikiEditorLazyStub, wikiEditorLazyMock, lastStubProps)"
affects: [100-04, 100-05, 100-06, 100-08]
tech-stack:
  added: []
  patterns: [React 19 ref-as-prop handle, callbacks via cbRef]
key-files:
  created:
    - taskflow/src/components/wiki-editor/host-keys.test.tsx
    - taskflow/src/test/wiki-editor-stub.tsx
    - taskflow/src/test/wiki-editor-stub.test.tsx
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - taskflow/src/components/wiki-editor/types.ts
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
    - taskflow/src/lib/shortcuts.ts
    - taskflow/src/lib/shortcuts.test.ts
    - taskflow/src/components/wiki-editor/toolbar/ToolbarButton.test.tsx
key-decisions:
  - "Placeholder overrides editorProps.attributes data-wiki-placeholder directly; extensions.ts needed no change"
requirements-completed: [HOST-02, FLOW-03]
metrics:
  completed: 2026-11-17
---

# Phase 100 Plan 01: Host API foundation Summary

Additive editor host API (imperative handle, placeholder, autoFocus, Cmd+Enter onSubmit, Esc onCancel), the D-01 inline-description descope in planning docs, two Editor shortcut rows, and a shared textarea stub for host tests.

## Tasks

1. Docs descope (389709e3): HOST-02 and UI-04 marked dropped, FLOW-02/HOST-03 reworded, ROADMAP Phase 100 criteria 1 and 3 aligned with D-01/D-08, Phase 102 criterion 2 removed.
2. Editor host API (bc9208d7): Mod-Enter in the capture handler calls onSubmit with the current text (rich: last emitted text, source: source text), skipped during IME composition or while a suggestion popover is open (rich plugin state, source via portaled `[data-suggestion]`). Esc handled in a bubble-phase frame handler that ignores already-handled events and only prevents default when onCancel exists. `useImperativeHandle` exposes focus/blur/insertFiles for both modes. 14 real-editor tests.
3. Shortcuts and stub (36db2497): `editor-submit` and `editor-cancel` rows; `WikiEditorLazyStub` with the same handle and key behaviour.

## Deviations from Plan

**1. [Rule 1 - Bug] Suspense reconnect crash in WikiEditor**
- **Found during:** Task 2 (real WikiEditorLazy test)
- **Issue:** `editor?.storage.wikiHost.set(...)` threw "Cannot read properties of undefined" on first lazy mount in jsdom (reproduced on the unmodified baseline), tripping the error boundary.
- **Fix:** optional chaining on `wikiHost`.
- **Files modified:** WikiEditor.tsx
- **Commit:** bc9208d7

**2. [Rule 3 - Blocking] ToolbarButton.test.tsx asserted the exact Editor shortcut list**
- **Fix:** list updated to 20 rows; submit/cancel exempt from the "while editing" wording check.
- **Commit:** 36db2497

**3. Plan-listed files not changed:** extensions.ts (placeholder override works via editorProps) and WikiEditorLazy.tsx (`{...props}` already forwards `ref`). The "null before chunk loads" ref assertion was dropped because the chunk is cached across tests.

## Known Stubs

None.

## Self-Check: PASSED
