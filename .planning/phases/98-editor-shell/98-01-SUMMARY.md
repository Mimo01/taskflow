---
phase: 98-editor-shell
plan: 01
subsystem: wiki-editor-engine
tags: [wiki, tiptap, prosemirror, roundtrip]
requires: []
provides:
  - saveWiki accepts docs from any Schema instance (TipTap editors)
  - schema.ts exports every node/mark const plus STARTER_KIT_OPTIONS
  - escape-aware table cell parsing (code/noformat/panel openers)
affects: [98-02, 98-05]
key-files:
  modified:
    - taskflow/src/lib/wiki/editor/engine.ts
    - taskflow/src/lib/wiki/editor/schema.ts
    - taskflow/src/lib/wiki/editor/parse/tables.ts
    - taskflow/src/lib/wiki/editor/engine.test.ts
    - taskflow/src/lib/wiki/editor/schema.test.ts
    - taskflow/src/lib/wiki/editor/tables.test.ts
    - taskflow/src/lib/wiki/editor/save-check.test.ts
    - taskflow/src/lib/wiki/editor/typed-render.test.ts
decisions:
  - "IN-01 closed as accepted: lookbehind regexes already ship in the main bundle (preprocess.ts since 724452e5, services/linkEngine.ts since 2026-11-12) and tauri.conf.json has no minimumSystemVersion, so Phase 97/98 add no new platform risk."
metrics:
  tasks: 2
  completed: 2026-11-17
---

# Phase 98 Plan 01: Engine fixes before the editor UI

saveWiki now normalises foreign-schema docs to wikiSchema (schema-identity bug, Pitfall 1), schema building blocks are exported for `.extend()`, and table cells with escaped `{code}`/`{noformat}` or even-run `\\{panel}` are parsed correctly.

## Tasks

1. saveWiki schema-identity fix and schema exports. Committed as "fix(98-01): normalise foreign-schema docs in saveWiki, export schema consts". Tests: a TipTap `Editor` doc unedited returns `unchanged` with original bytes (including CRLF), edited returns `saved`, an unrebuildable doc returns `failed` without throwing; exports and extension order are pinned.
2. Escape-aware parseCell and WR-02. Module-scope `CELL_PANEL_OPENER` and `UNESCAPED_CODE_OPENER` use the odd-run rule `(?<!(?<!\\)(?:\\\\)*\\)` from preprocess.ts. Commit: "fix(98-01): escape-aware table cell openers, WR-02 even backslash run".

## Findings

- The renderer shows an escaped `\{code}` / `\{panel}` in a cell as literal text, and a `\\{panel}` (even run) as a callout (`data-callout`), so parser and renderer agree.
- A user-typed `{code}x{code}` in a cell now saves as `\{code}x\{code}`, reads back as a modelled table, and re-emits identically.

## Deviations from Plan

**[Rule 1 - Behaviour change] Updated two prior fail-closed tests.** `save-check.test.ts` ("typed {code} in a table cell fails closed") and `typed-render.test.ts` ("table cell fails closed") encoded the old limitation this plan removes. They now assert the cell saves and renders as typed.

## Issues Encountered

The pre-commit full vitest suite intermittently failed in unrelated files (`EpicDetailSheet`, `IssueDetailSheet`, `WorklogsPage` first-render timeouts under parallel load in a fresh worktree). They pass in isolation (`src/routes/dashboard`, `src/routes/worklogs`: 2162 passed). Commits were retried, not bypassed. Out of scope; not fixed.

Worktree base was corrected with `git reset --hard 3624e41c` per the startup check (branch was on 1cc3524b).

## Known Stubs

None.

## Self-Check: PASSED
