---
phase: 98-editor-shell
plan: 11
subsystem: wiki-editor
tags: [tiptap, lazy-chunk, shell, forced-source, save-safety]
requires: [98-03, 98-06, 98-07, 98-10]
provides:
  - WikiEditorProps / WikiEditorVerdict contract (types.ts)
  - WikiEditorLazy (eager wrapper, equal-height skeleton, load-error boundary)
  - WikiEditor default export (value/onChange binding, modes, notices, shortcuts)
affects: [98-12, 98-13, 99, 100]
key-files:
  created:
    - taskflow/src/components/wiki-editor/types.ts
    - taskflow/src/components/wiki-editor/WikiEditorLazy.tsx
    - taskflow/src/components/wiki-editor/WikiEditorLazy.test.tsx
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
    - taskflow/src/components/wiki-editor/WikiEditor.test.tsx
    - taskflow/src/components/wiki-editor/forced-source.test.tsx
    - taskflow/src/components/wiki-editor/save-failed.test.tsx
    - taskflow/src/components/wiki-editor/shell-test-utils.tsx
decisions:
  - "Latest-callback ref (cbRef) feeds onChange/onVerdict into the once-created editor, so useEditor takes no deps and is never recreated"
  - "Initial mode reads the preference via useSettingsStore.getState() once (D-06); only user toggles write it, forced/edit-in-source switches never do"
  - "Source text in source mode clears the save-error line on the next edit; the reason stays visible until then"
requirements-completed: [EDIT-01, EDIT-02, EDIT-03, EDIT-08, EDIT-09, SAFE-05, FLOW-04]
completed: 2026-11-17
---

# Phase 98 Plan 11: WikiEditor shell Summary

Single-frame WikiEditor (sticky toolbar, one-line notice slot, rich/source content) bound to `value`/`onChange` through editor-session, behind a tiny lazy wrapper with an equal-height skeleton.

## Commits
- ab3e7a3e: both tasks in one commit (the lazy wrapper's dynamic import needs WikiEditor to exist for tsc, and the pre-commit hook runs the full suite, so the two tasks could not be committed separately)

## Deviations from Plan

1. [Rule 3] Tasks 1 and 2 committed together (see above).
2. [Rule 3] Added `shell-test-utils.tsx` (layout stubs, render helper, live-editor accessor via `.ProseMirror.editor`, textarea query) shared by the three shell test files.
3. `onCreate` also calls `onVerdict`, because TipTap fires it asynchronously and `created` would otherwise never be reported.
4. Skeleton and load-error tests use `vi.resetModules` + `vi.doMock` per test, since one module-scope `lazy()` can only resolve once.
5. In source mode, `role=textbox` matches both the hidden contenteditable and the textarea, so tests query the textarea by tag.

## Known Stubs
None.

## Threat mitigations
T-98-04/04e (only saved/unchanged text emitted; failed loads never enter rich; preference untouched), T-98-11 (frame capture + stopPropagation, spy test), T-98-10 (types.ts and WikiEditorLazy.tsx free of editor imports, asserted by test and bundle guard).

## Self-Check: PASSED
Full vitest suite (6102 tests), tsc and biome clean (one pre-existing role="grid" warning).
