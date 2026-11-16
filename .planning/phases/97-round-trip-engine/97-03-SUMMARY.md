---
phase: 97-round-trip-engine
plan: 03
subsystem: wiki-renderer
tags: [wiki, jira-markup, panels, preprocess, sanitize]
requires: ["97-01", "97-02"]
provides:
  - "Full panel family ({info},{note},{warning},{tip}, titled forms) rendered as panels"
  - "Lists inside panels render as real ul/ol"
  - "Table-cell callouts accept the full panel family"
affects: [wiki-renderer, 98-editor]
tech-stack:
  added: []
  patterns: ["blank-line wrapped panel bodies so markdown parses lists inside", "inline callout spans in table cells"]
key-files:
  created: []
  modified:
    - taskflow/src/lib/wiki/preprocess.ts
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/lib/wiki/pipeline.test.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
key-decisions:
  - "wikiSanitizeSchema and pipeline.ts left untouched"
  - "A callout opening on a table row line stays an inline span (newline becomes br) so rows are not split"
requirements-completed: [SAFE-03]
duration: n/a
completed: 2026-11-16
---

# Phase 97 Plan 03: Panel family renderer fixes Summary

Jira panel family (`{tip}`, titled `{info|note|warning|tip:title=...}`, lists inside panels, and panel-family callouts inside table cells) now renders as styled panels without widening the sanitize schema.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Block panel family renders as panels, lists inside panels render as lists | d9cb3647 |
| 2 | Table-cell callouts accept the full panel family | 53cd6f82 |
| 3 | Visual Jira-parity check (checkpoint) | deferred, see below |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Blank-line wrapping split table rows with single-line callouts**
- **Found during:** Task 2
- **Issue:** Task 1's blank-line wrapping of panel bodies broke rows like `|a|{info}x{info}|`.
- **Fix:** In preprocess.ts a callout opening on a `|` line stays an inline span (newline becomes br). PANEL_TAG_RE widened to the whole panel family so multi-line `{info}`/`{tip}` cell bodies merge like `{panel}`. Regression test asserts tables/inline-callout-cell.wiki still renders one table with two callouts.
- **Files modified:** taskflow/src/lib/wiki/preprocess.ts, taskflow/src/lib/wiki/pipeline.test.tsx
- **Commit:** 53cd6f82

No existing test assertion was changed or removed; only new D-12 describe blocks were appended.

## Verification

Wiki + WikiRenderer vitest scope: 331 tests pass. Task 1 pre-commit hook failed once on the known-flaky FindBar.test.tsx and passed on rerun.

## Deferred verification

Task 3 (human-verify checkpoint) was deferred by the user ("skip, i will verify at the end of implementation"). To confirm at end-of-phase UAT, in the running app compare against Jira:
- D-01: mixed `*#` / `#*` list nesting renders correctly.
- D-02: header-less tables show no synthetic header row.
- D-12: `{tip}` panel, titled info/note/warning/tip panels (title shown), lists inside panels (incl. nested), and panel-family callouts inside table cells.

## Known Stubs

None.

## Self-Check: PASSED
Commits d9cb3647 and 53cd6f82 exist in git history.
