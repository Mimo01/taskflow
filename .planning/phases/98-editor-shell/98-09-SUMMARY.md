---
phase: 98-editor-shell
plan: 09
subsystem: ui
tags: [tiptap, wiki-editor, colour, link, table, popover]
requires:
  - phase: 98-05
    provides: headless editor core (extensions, link-url, test-utils)
  - phase: 98-04
    provides: ToolbarButton/Keycap
provides:
  - TEXT_PALETTE and validated colour/link commands
  - table commands with header-row/headerless sync
  - ColourPopover, LinkPopover, floating TableToolbar components
affects: [98-11]
tech-stack:
  added: []
  patterns: [isSafeColor gate on every write and style, useEditorState selector for table anchor]
key-files:
  created:
    - taskflow/src/components/wiki-editor/palette.ts
    - taskflow/src/components/wiki-editor/inline-commands.ts
    - taskflow/src/components/wiki-editor/table-commands.ts
    - taskflow/src/components/wiki-editor/colour.test.ts
    - taskflow/src/components/wiki-editor/tables.test.ts
    - taskflow/src/components/wiki-editor/toolbar/ColourPopover.tsx
    - taskflow/src/components/wiki-editor/toolbar/LinkPopover.tsx
    - taskflow/src/components/wiki-editor/toolbar/popovers.test.tsx
    - taskflow/src/components/wiki-editor/toolbar/TableToolbar.tsx
    - taskflow/src/components/wiki-editor/toolbar/TableToolbar.test.tsx
  modified: []
key-decisions:
  - "Popover (not BubbleMenu) used for the table toolbar; no new dependency, package.json untouched"
  - "Header-row toggle sets table.headerless in the same chain as toggleHeaderRow"
requirements-completed: [BLOCK-01, BLOCK-04, EDIT-06]
duration: 40min
completed: 2026-11-17
---

# Phase 98 Plan 09: Colour, Link and Table Controls Summary

Validated colour palette, link apply/remove commands, header-row toggle that keeps the headerless attribute in sync, and the ColourPopover, LinkPopover and floating TableToolbar components.

## Accomplishments
- TEXT_PALETTE (24 lowercase hex values), every one asserted against isSafeColor.
- applyColour/applyLink refuse unvalidated values; off-palette colours are untouched by load/save and shown as a disabled "Custom (kept)" swatch.
- TABLE_ACTIONS (9, ordered, delete table last and destructive); toggleTableHeaderRow round-trips both directions (headerless true/false, `|a|b|` vs `||a||b||`).
- TableToolbar uses useEditorState with the table anchor read inside the selector (the only `editor.state` access), Popover with `initialFocus={false}` and mousedown preventDefault buttons. The Popover approach worked in the test, so the BubbleMenu fallback and the extra dependency were not needed.

## Deviations from Plan
None to production code. The worktree was reset to base 2fc75369 at start (HEAD was behind it). Test-local jsdom rect stubs were added in TableToolbar.test.tsx (as the plan allows).

## Issues Encountered
- Pre-commit full-suite hook failed repeatedly under parallel load from unrelated tests (EpicDetailSheet, IssueDetailSheet, WorklogsPage, FindBar timeouts) and one intermittent uncaught exception in the 98-05 commands.test.ts (getClientRects in jsdom, passes in isolation most runs). Not caused by this plan; the two tasks were committed together to reduce hook reruns. Pre-existing flake in commands.test.ts is a candidate for a deferred fix.
- Focus retention is asserted via mousedown preventDefault and initialFocus=false; a real-WebKit check is left to 98-11 integration.

## Task Commits
Tasks 1-3 were committed together (hook flakiness); see git log for `feat(98-09)`.

## Self-Check: PASSED (files present, wiki-editor tests 191 passing, tsc and biome clean)
