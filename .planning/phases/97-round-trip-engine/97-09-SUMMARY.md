---
phase: 97-round-trip-engine
plan: 09
subsystem: wiki-editor-engine
tags: [wiki, prosemirror, color, round-trip, security]
requires: ["97-08"]
provides:
  - "parse/color.ts: COLOR_VALUE allowlist, isSafeColor, parseColorSpan (multi-block span parser)"
  - "color mark for `{color:X}..{color}` inside paragraphs, headings, items and cells, with recorded opener"
  - "multi-block color as per-block marks sharing a string `span` id, merged back into one opener/closer on emit"
affects: [98]
key-files:
  created:
    - taskflow/src/lib/wiki/editor/parse/color.ts
    - taskflow/src/lib/wiki/editor/color.test.ts
  modified:
    - taskflow/src/lib/wiki/editor/parse/marks.ts
    - taskflow/src/lib/wiki/editor/parse/inline.ts
    - taskflow/src/lib/wiki/editor/parse/blocks.ts
    - taskflow/src/lib/wiki/editor/emit.ts
    - taskflow/src/lib/wiki/editor/roundtrip.test.ts
    - taskflow/src/lib/wiki/editor/raw.test.ts
key-decisions:
  - "Multi-block color is modelled (not demoted): fixture, idempotence and Edits A-C all pass render equivalence"
  - "Unsafe color values become rawInline from opener to closer (same line); unsafe multi-line spans stay rawBlock"
requirements-completed: [SAFE-03, SAFE-04]
duration: ~30min
completed: 2026-11-16
---

# Phase 97 Plan 09: Color Spans Summary

`{color:X}` text round-trips as a color mark with the exact opener, a strict hex-or-name allowlist keeps CSS-injection values raw, and multi-block color is modelled as per-block marks sharing a span id that the emitter merges back.

## Tasks

Both tasks were committed together in one commit (feat(97-09): model color marks and multi-block color spans). The two tasks share files (`parse/color.ts`, `emit.ts`, `color.test.ts`) and the pre-commit hook runs the whole suite, so one commit was simpler. See Deviations.

## Design

- Inline: `matchMark` (marks.ts) recognises `{color:VALUE}` ... `{color}` on the line mask, so other marks nest inside and outside. Empty content is not a mark (it would lose text; the fuzz test caught this).
- Unsafe value: in `parseInline` the `{` branch emits a `rawInline` from opener through the next `{color}` on the line. No closer on the line means plain text.
- Block level: a line-start `{color:X}` whose closer is on the same line is now plain prose (previously a rawBlock). A closer on a later line goes through `parseColorSpan`: the opener and closer are stripped, the body is scanned with the normal block scanner, and the span is accepted only if the opener starts a line, the closer ends a line, both stripped parts are non-blank, the first block is a paragraph, every block is a paragraph or heading, and the line count matches. Each inline node gets a color mark with `span: 'c<line>'` and `open` recorded on the first block. Otherwise the old rawBlock stays (lists, tables, panels, trailing text, unsafe value).
- Emit: `blockTexts` finds runs of two or more paragraphs/headings whose inline nodes all carry the same string-span color mark, drops those marks, and writes one opener before the first block and one `{color}` after the last. A run broken by an edit falls back to the ordinary mark path, giving one pair per block.

## Decision gate (D-09)

Result: promoted, not demoted. `macros/color-multi-block.wiki` is out of RAW_ALLOWED and listed under MODELLED. Edit A (changing a word), Edit B (an uncoloured paragraph inserted between: separate pairs), Edit C (mark removed from the first paragraph: second gets its own pair) are each render-equivalent to the hand-written expected text and re-parse idempotently. Headings inside a span and multi-line paragraphs are covered too.

## Deviations from Plan

**1. [Rule 3 - Blocking] `scanBody` per-block gaps.** `scanBody` overwrote every non-first block of a `scanBlocks` result with gap 0 and built slices without gap lines. A multi-block color result needs real blank-line gaps. Blocks now carry an optional `gap`, and `scanBody` derives the slice from it. Existing list runs are unaffected (gap defaults to 0).

**2. [Adaptation] Color marks reuse the `span` attribute differently.** Inline color marks get the numeric parse-order `span` from Plan 08 (so ordering with other marks is exact); cross-block marks get a string span id. The merge applies only to string ids.

**3. [Adaptation] Line-start same-line `{color}` is no longer a rawBlock.** Needed for Task 1 (the existing grouping wrapped it raw), so `scanSpecial` now returns null for it. `raw.test.ts` expectation updated from `rawBlock` to `paragraph`.

**4. Single commit for both tasks** (shared files, full-suite pre-commit hook).

**5. [Adaptation] Fixture note.** `color-multi-block.wiki` also contains a third, intra-paragraph colour paragraph; the edit tests use the two-paragraph prefix as their own input.

## Known Limitations

- A span whose last block ends in a typed backslash would fuse with the closer (`\{`); same class as the Plan 08 UNSPELLABLE sequences.
- Colored spans inside list items, tables and panels beyond one line stay as the inline mark only; multi-block spans never enter containers.

## Known Stubs

None.

## Threat Flags

None. T-97-27 mitigated (allowlist + unsafe-value tests with `;background:url()` and `expression()`), T-97-28 mitigated (Edits A-C), T-97-29 mitigated (existing closer index, next-occurrence lookups).

## Verification

Full vitest suite (5586 tests), tsc and biome green in the pre-commit hook.

## Self-Check: PASSED
