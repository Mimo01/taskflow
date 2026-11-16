---
phase: 97-round-trip-engine
plan: 02
subsystem: wiki-editor-engine
tags: [tiptap, prosemirror, schema, fixtures, bundle-guard]
requires: []
provides:
  - 64-fixture placeholder wiki corpus
  - wikiSchema / wikiExtensions (module-scope, spelling attributes)
  - WikiEol / WikiParse / WikiLoad engine contract types
  - bundle-isolation guard for WikiRenderer's import graph
affects: [97-03..97-10, 98]
tech-stack:
  added: ["@tiptap/core ^3.34.0", "@tiptap/pm ^3.34.0", "@tiptap/starter-kit ^3.34.0", "@tiptap/extension-table ^3.34.0"]
  patterns: ["spelling-as-attributes via one addGlobalAttributes extension", "static import-graph guard test"]
key-files:
  created:
    - taskflow/src/lib/wiki/editor/schema.ts
    - taskflow/src/lib/wiki/editor/types.ts
    - taskflow/src/lib/wiki/editor/index.ts
    - taskflow/src/lib/wiki/editor/schema.test.ts
    - taskflow/src/lib/wiki/editor/bundle-guard.test.ts
    - 27 fixtures under taskflow/src/lib/wiki/__fixtures__/
  modified:
    - taskflow/src/lib/wiki/corpus-coverage.test.ts
    - taskflow/package.json
    - taskflow/package-lock.json
key-decisions:
  - "Spelling attributes on StarterKit/table nodes and marks are added through a single wikiSpelling Extension.addGlobalAttributes instead of extending each StarterKit node, so no transitive @tiptap/extension-* imports are needed"
  - "StarterKit configured with code, undoRedo, dropcursor, gapcursor, trailingNode, listKeymap disabled (pure schema, no plugins)"
requirements-completed: [SAFE-03, SAFE-04, SAFE-06]
duration: ~15min
completed: 2026-11-16
---

# Phase 97 Plan 02: Corpus, Schema and Bundle Guard Summary

27 placeholder fixtures (corpus now 64), the four @tiptap packages, a complete wiki ProseMirror schema with spelling attributes, engine contract types, and a guard keeping ProseMirror out of WikiRenderer's static import graph.

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 1. 27 fixtures, coverage list to 64 | 6bdcd530 | All fixtures pass identity equivalence and react-markdown parity unchanged; mixed-eol has 3 CRLF + bare LF |
| 2. Packages, schema, types | 74d3204b | schema.test.ts: all nodes/marks, full-doc `check()`, two mutation rejections, defaults, singleton |
| 3. Bundle guard | b8be1dd3 | Real graph clean; synthetic graph proves it reports `@tiptap/core`, `prosemirror-*`, re-exports; type/dynamic imports ignored |

## Deviations from Plan

**1. [Rule 3 - Blocking] Dropped `// @vitest-environment node` from schema.test.ts and bundle-guard.test.ts**
- **Issue:** `src/test/setup.ts` touches `window`, so node-environment tests crash at setup ("window is not defined").
- **Fix:** Tests run in the default jsdom environment; both only use pure schema / fs code. The acceptance grep for `@vitest-environment node` in bundle-guard.test.ts therefore returns 0, not 1.

**2. [Rule 3 - Blocking] `npm ci` in the worktree**
- node_modules was absent in the fresh worktree.

**3. Schema built with global attributes rather than `.extend()` per StarterKit node**
- Equivalent resulting attributes and defaults as specified; avoids importing transitive packages.

## Known Stubs
None.

## Threat Flags
None. T-97-SC: `npm view` confirmed ueberdosis repo and no install scripts before install. T-97-07 (color value allowlist) is deferred to Plan 09 as planned.

## Self-Check: PASSED
Commits 6bdcd530, 74d3204b, b8be1dd3 exist; full vitest suite, tsc and biome ran green in each pre-commit; `src/lib/wiki/index.ts` unchanged.
