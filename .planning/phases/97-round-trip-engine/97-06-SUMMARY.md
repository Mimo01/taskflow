---
phase: 97-round-trip-engine
plan: 06
subsystem: wiki-editor-engine
tags: [wiki, prosemirror, panels, tables, round-trip]
requires: ["97-05"]
provides:
  - "parsePanel: panel family (bare or title=) with nested lists/panels via parseContainerBody"
  - "parseTableRun: table parser with bracket-aware split, open-row merge, headerless attr, panels in cells"
  - "emitter support for panel and table nodes (headerless never writes a synthetic header)"
affects: [97-07, 97-08, 97-09]
key-files:
  created:
    - taskflow/src/lib/wiki/editor/parse/panels.ts
    - taskflow/src/lib/wiki/editor/parse/tables.ts
    - taskflow/src/lib/wiki/editor/panels.test.ts
    - taskflow/src/lib/wiki/editor/tables.test.ts
  modified:
    - taskflow/src/lib/wiki/editor/parse/blocks.ts
    - taskflow/src/lib/wiki/editor/emit.ts
    - taskflow/src/lib/wiki/editor/roundtrip.test.ts
    - taskflow/src/lib/wiki/editor/raw.test.ts
key-decisions:
  - "Panel params other than bare or title=<text> stay rawBlock; same-name nested openers and text after the closer are raw"
  - "Indented rows, trailing whitespace after a row, rows not followed by a blank line, mixed rows, {code} in cells, inline single-line tables and unclosed rows are raw (D-10)"
  - "Panel after a list item is a sibling block with gap 0, which is where the renderer puts it"
requirements-completed: [SAFE-03, SAFE-04]
duration: ~25min
completed: 2026-11-16
---

# Phase 97 Plan 06: Panels and Tables Summary

Panels (whole family, nested, with lists, inside table cells) and tables (header and header-less) are real nodes that round-trip byte-identically; every heuristic table form stays raw.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1+2 | Panel family and tables (single commit, see deviations) | 734fab66 |

## Deviations from Plan

**1. [Adaptation] One commit for both tasks.** The pre-commit hook runs the full suite and the registry test spans both families, so the work landed together.

**2. [Adaptation] `parsePanel(lines, i, span, parseBody)`** takes the macro span and the container-body parser as arguments, avoiding an import cycle with blocks.ts.

**3. [Rule 1 - Bug] `parseContainerBody` swallowed a trailing space** on the closer line into an empty tail, so the D-07 strip removed it (found by the 200 KB fuzz case once panels were modelled). The tail now starts at the end of the content when no newline follows. Also affects `{quote}` (same helper). Panel and quote bodies always emit the first child with gap 0.

**4. [Adaptation] Single-line inline table fixture** is a plain paragraph line, not a table row. A paragraph line matching the renderer's inline-table heuristics (`|---|---|` run, or `||h||… |`) becomes a rawBlock so `tables/single-line-inline.wiki` is raw as D-10 requires.

**5. [Adaptation] Indented rows stay raw.** The renderer only treats rows starting at column 0 as rows, so `indent` is always '' for modelled rows; `close` is left null (derived from the row's separator).

**6. D-09 note: `lists/panel-after-item.wiki`** is modelled as list, panel (gap 0), list. The renderer shows the panel after the list, but renders the following `* next` as literal text (renderer quirk); emit is byte-identical, so this was kept modelled rather than demoted.

## Known Stubs
None.

## Threat Flags
None. T-97-18..20 mitigated: 50-line cap and single-pass cell split, malformed forms emitted verbatim as raw, params gated to the renderer-supported forms. Full suite, tsc and biome green in the pre-commit hook.

## Self-Check: PASSED
Commit 734fab66 and all four created files exist. The pre-commit hook needed several retries because machine load (load average 40-96) timed out unrelated UI tests; the wiki editor suite passed every time.
