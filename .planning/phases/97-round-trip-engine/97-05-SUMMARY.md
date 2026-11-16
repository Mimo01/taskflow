---
phase: 97-round-trip-engine
plan: 05
subsystem: wiki-editor-engine
tags: [wiki, prosemirror, lists, blockquote, round-trip]
requires: ["97-04"]
provides:
  - "parseListRun: iterative list run parser with contiguous-ancestry nesting (mixed *# supported)"
  - "blockquote model for bq. and {quote} with recorded form/lead/tail"
  - "parseContainerBody: shared macro-container body parser (reused by panels in Plan 06)"
affects: [97-06, 97-07, 97-08]
key-files:
  created:
    - taskflow/src/lib/wiki/editor/parse/lists.ts
    - taskflow/src/lib/wiki/editor/lists.test.ts
  modified:
    - taskflow/src/lib/wiki/editor/parse/blocks.ts
    - taskflow/src/lib/wiki/editor/parse/macros.ts
    - taskflow/src/lib/wiki/editor/emit.ts
    - taskflow/src/lib/wiki/editor/roundtrip.test.ts
    - taskflow/src/lib/wiki/editor/raw.test.ts
key-decisions:
  - "A list run yields one rawBlock when ancestry is non-contiguous or `-` is nested; type change at the same depth starts a sibling list (matches D-01 renderer)"
  - "Container body lead/tail absorb all leading/trailing blank area so inner first-block gap is 0 and bodies rebuild exactly"
requirements-completed: [SAFE-03, SAFE-04]
duration: ~15min
completed: 2026-11-16
---

# Phase 97 Plan 05: Lists and Quotes Summary

Lists (pure and mixed `*#` nesting, `-` bullets, lazy continuation, indentation) and block quotes (`bq.`, `{quote}`) are now real nodes that round-trip byte-identically; ambiguous structures stay raw, and `parseContainerBody` is ready for panels.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Lists with mixed nesting and recorded marker spelling | a60426bf |
| 2 | Block quotes and shared macro-container body parser | e2618ce8 |

## Deviations from Plan

**1. [Adaptation] `parseListRun` returns `{ parts, end }`, with an optional `stopAt` predicate**
- A single run can produce several top-level lists (`mixed-nesting.wiki` is a bulletList then an orderedList), so one `node` is not enough. Each part carries its own end line so per-block slices stay exact. `stopAt` avoids a circular import with blocks.ts. The sibling lists get gap 0.

**2. [Adaptation] `bq.` takes lazy continuation lines** (paragraph-style until blank/another block), matching the markdown pipeline.

**3. [Rule 3] raw.test.ts expectation updated** (lists and quotes no longer raw in the grouped-run test). No `@vitest-environment node` per prior plans.

**4. No schema.ts change** was needed; all spellings fit existing attrs. `MacroSpan` gained an optional `closer` position (macros.ts) so quotes can verify the closer ends its line.

## Known Stubs
None.

## Threat Flags
None. T-97-15..17 mitigated: iterative list build, non-contiguous and same-name nested quotes are raw, fuzz/engine suites unchanged and green. Full suite (5501 tests), tsc and biome green in the pre-commit hook.

## Self-Check: PASSED
