---
phase: 98-editor-shell
plan: 08
subsystem: wiki-editor
tags: [tiptap, toolbar, insert-menu, text-style]
requires: [98-04, 98-05]
provides:
  - "wiki-editor/insert-items.ts: INSERT_ITEMS, InsertItem (shared with Phase 99 slash menu)"
  - "wiki-editor/text-style.ts: TEXT_STYLES, currentTextStyle, applyTextStyle"
  - "toolbar/InsertMenu, TableGridPicker, TextStyleMenu (prop-driven, editor-agnostic)"
affects: [98-10, 99]
key-files:
  created:
    - taskflow/src/components/wiki-editor/insert-items.ts
    - taskflow/src/components/wiki-editor/insert-items.test.ts
    - taskflow/src/components/wiki-editor/text-style.ts
    - taskflow/src/components/wiki-editor/text-style.test.ts
    - taskflow/src/components/wiki-editor/toolbar/InsertMenu.tsx
    - taskflow/src/components/wiki-editor/toolbar/TableGridPicker.tsx
    - taskflow/src/components/wiki-editor/toolbar/TextStyleMenu.tsx
    - taskflow/src/components/wiki-editor/toolbar/menus.test.tsx
requirements-completed: [BLOCK-01, BLOCK-02, BLOCK-03, EDIT-05]
completed: 2026-11-17
---

# Phase 98 Plan 08: Insert and text-style controls Summary

One data-driven INSERT_ITEMS list (table with header row, code, noformat, five panel kinds, rule) with rich `run` commands and canonical source-mode snippets, plus text-style commands and the InsertMenu, 6x6 keyboard-reachable TableGridPicker and TextStyleMenu components.

## Tasks

Both tasks landed in one commit. The pre-commit hook runs the full suite and was timing out unrelated first-render tests (EpicDetailSheet, IssueDetailSheet, WorklogsPage, FindBar) under machine load around 70, so fewer commit attempts were used.

1. insert-items.ts and text-style.ts with tests: every rich insert saves canonical wiki, every source snippet loads as `rich`, table has a header row.
2. InsertMenu, TableGridPicker, TextStyleMenu with tests (menus portal to body, grid reachable by arrow keys and Enter).

## Deviations from Plan

None in behaviour. The table source snippet is `||  ||  ||\n|  |  |` and was verified to load as rich.

## Known Stubs

None.

## Notes

- Biome emits one a11y warning (`useSemanticElements` for `role="grid"` on the picker); the plan requires `role="grid"`, so it is left.
- Pre-existing flaky timeouts in unrelated test files passed when run in isolation.

## Self-Check: PASSED

wiki-editor tests (163), tsc and biome clean.
