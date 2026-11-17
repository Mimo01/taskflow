---
phase: 98-editor-shell
plan: 14
subsystem: wiki-editor
tags: [gap-closure, save, enter, list, safe-05]
requires: []
provides:
  - "Enter never copies gap 0 onto a new top-level block"
  - "withoutEmptyListItems transient rule used by saveWiki"
affects: [wiki-editor, wiki-engine]
key-files:
  created:
    - taskflow/src/lib/wiki/editor/transient.ts
    - taskflow/src/lib/wiki/editor/transient.test.ts
    - taskflow/src/components/wiki-editor/enter-split.test.ts
    - taskflow/src/components/wiki-editor/empty-list-save.test.tsx
  modified:
    - taskflow/src/lib/wiki/editor/schema.ts
    - taskflow/src/components/wiki-editor/gap-keeper.ts
    - taskflow/src/lib/wiki/editor/engine.ts
requirements: [EDIT-05, EDIT-07, SAFE-05]
completed: 2026-11-17
---

# Phase 98 Plan 14: Enter gap and empty list item save fixes Summary

Enter now always produces a block that saves with a blank line between blocks, and empty list items are pruned by `saveWiki` (transient rule) so they never flash the save banner.

## Tasks

1. Enter gap (commit 85f9b0c5): `gap` attr gets `keepOnSplit: false`; `WikiGapKeeper` gives fresh top-level blocks at index > 0 with gap 0 a gap of 1 when the block count grows. Nine real-Enter tests drive `keyboardShortcut('Enter')` through `saveWiki`, including Enter at the start of the first block and a loaded gap-0 spelling (`h1. T\npara`, which does load with gap 0 on the paragraph) that keeps its single newline while typing.
2. Empty list items (commit recorded in git log, message "fix(98-14): empty list items are transient"): `withoutEmptyListItems` prunes empty items and emptied lists (also in quotes, panels, cells; nested lists judged first; same instance returned when nothing pruned). `saveWiki` uses the pruned doc for eq, emit and `checkSaved`. A test proves an empty item cannot mask a real failure.

## Deviations from Plan

None in production code. Test-fixture notes: the engine-level 'unchanged' test builds its doc by appending an empty item to the loaded doc JSON, because a hand-built doc differs from the loaded one in attrs. In empty-list-save.test.tsx `mock.lastCall` is used instead of `.at(-1)` (tsc lib target).

## Verification

- `npx vitest run src/lib/wiki src/components/wiki-editor`: 53 files, 814 tests passed. `tsc --noEmit` clean, biome clean on named files. Full suite passed in the pre-commit hook.
- A gap-0 block that is itself split mid-way ends up with gap 1 on both halves (accepted, reads back correctly).

## Required follow-up (orchestrator)

A real-WebKit re-check is required after execution: UAT test 1 (type 100+ chars with Enter, caret and rebuild, save stays 'saved') and UAT test 4 (`* `, `# ` and Enter in a list show no banner).

## Self-Check: PASSED
