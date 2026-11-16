---
phase: 97-round-trip-engine
plan: 10
subsystem: wiki-editor-engine
tags: [wiki, prosemirror, ladder, edits, validation]
requires: ["97-09"]
provides:
  - "loadWiki D-11 ladder: rich / rich-demoted (with demoted indexes) / failed, never throws"
  - "edit.test.ts scripted ProseMirror edits for D-04..D-08"
  - "engine parse/emit corpus run in equivalence.test.ts"
  - "97-VALIDATION.md closed (nyquist_compliant, wave_0_complete)"
affects: [98]
key-files:
  created:
    - taskflow/src/lib/wiki/editor/ladder.test.ts
    - taskflow/src/lib/wiki/editor/edit.test.ts
  modified:
    - taskflow/src/lib/wiki/editor/engine.ts
    - taskflow/src/lib/wiki/equivalence.test.ts
    - taskflow/src/lib/wiki/editor/roundtrip.test.ts
    - .planning/phases/97-round-trip-engine/97-VALIDATION.md
key-decisions:
  - "Demoted docs are not re-checked for idempotence through parse; whole-text equivalence is the authority"
requirements-completed: [SAFE-03, SAFE-04, SAFE-06]
duration: ~15min
completed: 2026-11-16
---

# Phase 97 Plan 10: Ladder, Edits and Validation Summary

loadWiki now demotes top-level blocks whose own emit is not equivalent to their source slice into raw blocks (kind `rich-demoted`), re-verifies the whole text, and otherwise returns `failed`; scripted edit tests and an engine corpus run close the phase.

## Tasks

1. D-11 ladder (commit with ladder.test.ts): per-block `isEquivalent(source, emitBlock(block))`, mismatches become `rawBlock` with original gap; `EngineDeps` gained optional `emitBlock` (default `emitBlockNode`).
2. Edit tests, harness wiring and validation (commit 94136117): 12 edit tests (append, bold, cell, list item, heading-no-space, CRLF/mixed/new-LF, trailing whitespace prose vs code, new-node forms); `emitWiki(parseWiki)` corpus test; RAW_ALLOWED reasons asserted to start with D-10 / D-09 demotion; validation map marked green.

## Deviations from Plan

1. **[Adaptation] Idempotence after demotion.** The plan says to re-run both checks after demoting. Re-parsing the emitted text rebuilds the very blocks that were demoted, so the parse-based idempotence check can never hold for a demoted doc. The ladder re-checks schema validity and whole-text equivalence only; reloading the same text demotes the same blocks again.
2. **[Adaptation] Edit tests do not use `// @vitest-environment node`**, per project notes (jsdom).
3. **No emit.ts changes** were needed; no emitter bug was exposed.
4. RAW_ALLOWED already held only D-10 entries (no D-09 demotions remained); only the reason assertion was added.

## Known Limitations

- A block created with the schema default `gap: 1` as the first document block emits a leading blank line; the parser always gives the first block its real gap, so only programmatic first-block creation is affected (Phase 98 should set gap 0 on a new first block).

## Known Stubs

None.

## Threat Flags

None. T-97-30 (whole-text recheck after demotion), T-97-31 (untouched-line assertions in edit tests) mitigated.

## Verification

Full vitest suite (5603 tests), tsc and biome green.

## Self-Check: PASSED
