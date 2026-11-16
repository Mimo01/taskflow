---
phase: 97-round-trip-engine
plan: 11
subsystem: wiki-renderer
tags: [wiki, preprocess, sanitize, gap-closure]
requires: []
provides:
  - ownLine-gated panel block form (CR-01)
  - attr() attribute escaping and positional headerless marker (CR-02)
affects: [taskflow/src/lib/wiki/preprocess.ts, taskflow/src/lib/wiki/pipeline.ts]
key-files:
  created:
    - taskflow/src/lib/wiki/__fixtures__/panels/panel-mid-line.wiki
  modified:
    - taskflow/src/lib/wiki/preprocess.ts
    - taskflow/src/lib/wiki/pipeline.ts
    - taskflow/src/lib/wiki/pipeline.test.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
    - taskflow/src/lib/wiki/corpus-coverage.test.ts
decisions:
  - Sanitize schema untouched (D-12)
metrics:
  tasks: 2
  completed: 2026-11-16
requirements: [SAFE-03]
---

# Phase 97 Plan 11: Panel mid-line and attribute injection fixes Summary

Mid-line panels now render inline inside their list item or paragraph, and no user text can add or forge an HTML attribute (including the headerless marker).

## Commits

- f7dd706b: CR-01 ownLine gate, fixture, renderer tests
- e10a3b35: CR-02 attr() escaping, positional marker, pipeline tests

## RED evidence

Task 1 (before fix, `-t "mid-line"`):
- keeps a bullet item that opens a panel mid-line: `expected 1 to be 2`
- keeps a numbered item that opens a panel mid-line: `expected 1 to be 2`
- keeps a paragraph that opens a panel mid-line: `expected 3 to be 1`
- uses the inline form when only the opener starts the line: `expected null not to be null`

Task 2 (before fix, `-t "CR-02"`):
- forged marker in a panel title removes a real header row: `expected null not to be null`
- forged marker in a color value removes a real header row: `expected null not to be null`
- quote in a panel title adds attributes: `expected true to be false`
- quote in a mention id adds attribute: `expected <mention data-id="a" title="x"> to be null`
- (the newline-title, genuine headerless, and image-name tests already passed pre-fix)

## `="${` site classification

Wrapped in `attr()`: panel list-item href, all data-title sites (flatten spans, D-12 span and div), both img src, both mention data-id, both data-color.
Left unwrapped by design: `data-callout="${type}"` (fixed loop list, 4 sites); attachment-chip `href="${url}"` (2 sites, trusted attachment map, constant class).

## Deviations

- [Rule 3] corpus-coverage.test.ts asserted exactly 64 required fixtures; bumped to 65 for the new fixture.
- Worktree base was reset to 5e799119 at start per the branch check.
- First commit attempt of Task 1 was blocked by a flaky unrelated full-suite test (FindBar-style rectsSpy); retry passed with no changes.
- The pipeline test for image-name quotes passed before the fix (the `!https://...!` path was not exploitable via that input); kept as a guard.

## Self-Check: PASSED

Fixture, both commits, and all verification (wiki suite 490 tests, full suite, tsc, biome on named files) confirmed. wikiSanitizeSchema unchanged.
