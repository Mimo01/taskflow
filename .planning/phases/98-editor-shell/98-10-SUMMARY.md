---
phase: 98-editor-shell
plan: 10
subsystem: wiki-editor
tags: [toolbar, container-queries, overflow, source-mode]
requires: [98-04, 98-06, 98-08, 98-09]
provides:
  - toolbar-config (TOOLBAR_ITEMS, splitToolbar, OVERFLOW_BREAKPOINTS, INLINE_CLASS)
  - OverflowMenu
  - Toolbar (full and compact presets, rich and source behaviour)
affects: [98-11]
key-files:
  created:
    - taskflow/src/components/wiki-editor/toolbar/toolbar-config.ts
    - taskflow/src/components/wiki-editor/toolbar/toolbar-config.test.ts
    - taskflow/src/components/wiki-editor/toolbar/OverflowMenu.tsx
    - taskflow/src/components/wiki-editor/toolbar/Toolbar.tsx
    - taskflow/src/components/wiki-editor/toolbar/Toolbar.test.tsx
  modified:
    - taskflow/src/components/wiki-editor/toolbar/ToolbarButton.tsx
decisions:
  - "Compact breakpoints are strike 420, mono 400, bullet/numbered 380 so that all four overflow at 360 (min-width semantics)"
  - "Frame width unmeasured (null) means nothing overflows; CSS inline classes still hide items before first measure"
requirements-completed: [EDIT-04, EDIT-09, EDIT-06, BLOCK-04]
completed: 2026-11-17
---

# Phase 98 Plan 10: Toolbar composition Summary

Single-row Toolbar with full and compact presets, a pure width split into a "..." overflow menu (CSS container-query classes kept in sync with the JS split), useEditorState-driven pressed states, and source-mode behaviour (wiki wrappers, canonical inserts, validated link insert, preview toggle).

## Commits
- 8d58a9b6: toolbar-config + OverflowMenu
- fd4feb82: Toolbar + tests (ToolbarButton, OverflowMenu extended)

## Deviations from Plan
1. [Rule 3] ToolbarButton now forwards extra props onto its Button so it can act as the trigger for Popover/ColourPopover/LinkPopover and keep its keycap tooltip.
2. OverflowMenu gained an optional `submenu` so the colour palette is reachable when colour overflows. When Link overflows, the LinkPopover anchors to a zero-size span next to the menu.
3. The planned "class literal in source" assertion was dropped from the unit test (jsdom URL fs read fails); the grep acceptance criterion covers it, and a test checks classes match breakpoints.
4. Overflowed items are not rendered inline once the width is measured (no hidden duplicates).

## Known Stubs
None.

## Threat mitigations
T-98-02: source link insert gated by normalizeLinkUrl (non-allowlisted URL inserts nothing, tested). T-98-01: colour only via applyColour.

## Self-Check: PASSED
Full vitest suite, tsc and biome clean (one pre-existing role="grid" warning).
