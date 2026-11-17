---
phase: 98-editor-shell
plan: 07
subsystem: wiki-editor
tags: [tiptap, node-views, panels, code-blocks, raw-atoms]
requires: [98-03, 98-05]
provides:
  - richExtensions (module-scope extension list with React node views)
  - CODE_LANGUAGES, panel/code commands
  - EDIT_IN_SOURCE_EVENT
affects: [rich editor shell plans in wave 4+]
tech-stack:
  added: []
  patterns: [React node views via ReactNodeViewRenderer, headless commands separate from UI]
key-files:
  created:
    - taskflow/src/components/wiki-editor/languages.ts
    - taskflow/src/components/wiki-editor/panel-commands.ts
    - taskflow/src/components/wiki-editor/code-block.test.ts
    - taskflow/src/components/wiki-editor/panel.test.ts
    - taskflow/src/components/wiki-editor/rich-extensions.ts
    - taskflow/src/components/wiki-editor/nodeviews/events.ts
    - taskflow/src/components/wiki-editor/nodeviews/PanelView.tsx
    - taskflow/src/components/wiki-editor/nodeviews/CodeBlockView.tsx
    - taskflow/src/components/wiki-editor/nodeviews/RawBlockView.tsx
    - taskflow/src/components/wiki-editor/nodeviews/RawInlineChip.tsx
    - taskflow/src/components/wiki-editor/nodeviews/nodeviews.test.tsx
  modified: []
decisions:
  - Panel title input keeps a local draft so inner spaces survive typing; the stored params are always the sanitised, trimmed title.
metrics:
  tasks: 2
  completed: 2026-11-17
---

# Phase 98 Plan 07: Rich blocks node views Summary

Panels, code blocks and raw atoms now have React node views, backed by headless commands, and are composed into the module-scope `richExtensions` list with schema parity to `wikiSchema`.

## Tasks

| Task | Commit | Notes |
| ---- | ------ | ----- |
| 1 Language list + panel/code commands | 47e11e8b | Every CODE_LANGUAGES value proven against parseWiki; hostile-title round-trips pass |
| 2 Node views + richExtensions | 2131f853 | 7 jsdom tests incl. parity, title edit, type menu, Noformat, edit-in-source event |

## Deviations from Plan

**1. [Rule 1 - Test fixture] Non-canonical opener fixture** - `{code:JAVA}` is not modelled by the parser (it becomes a raw block), so the "reset open spelling" test uses `{code:title=a.java|borderStyle=solid}`, which the parser models with a recorded `open`. Command behaviour is unchanged.

**2. [Rule 3 - Blocking] Test wrapper** - WikiRenderer needs a router, so node-view tests wrap in `MemoryRouter` (react-router-dom). `NodeViewContent` needs the generic `<'code'>` for TypeScript.

Pre-commit full-suite runs timed out on unrelated tests (EpicDetailSheet, IssueDetailSheet, WorklogsPage, FindBar) under parallel load; retried without bypass and passed.

## Known Stubs

None.

## Threat Flags

None. Mitigations T-98-03/03b/05/04 implemented: title sanitising, fixed language list, WikiRenderer/text children only (no dangerouslySetInnerHTML), parity test.

## Self-Check: PASSED

All listed files exist; commits 47e11e8b and 2131f853 present; tsc, biome and wiki-editor tests clean.
