---
phase: 97-round-trip-engine
plan: 14
subsystem: wiki-editor-engine
tags: [save-check, round-trip, fail-closed, gap-closure]
requires: ["97-11", "97-12", "97-13"]
provides:
  - "saveWiki returns WikiSave (unchanged | saved | failed) and never throws"
  - "checkSaved: re-parse structural comparison of emitted text vs edited doc"
affects: [98-editor]
tech-stack:
  added: []
  patterns: ["fail-closed save via re-parse", "named normalisation rules, one test each"]
key-files:
  created:
    - taskflow/src/lib/wiki/editor/save-check.ts
    - taskflow/src/lib/wiki/editor/save-check.test.ts
  modified:
    - taskflow/src/lib/wiki/editor/engine.ts
    - taskflow/src/lib/wiki/editor/types.ts
    - taskflow/src/lib/wiki/editor/index.ts
    - taskflow/src/lib/wiki/editor/engine.test.ts
    - taskflow/src/lib/wiki/editor/ladder.test.ts
    - taskflow/src/lib/wiki/editor/edit.test.ts
    - .planning/phases/97-round-trip-engine/97-VALIDATION.md
    - .planning/REQUIREMENTS.md
decisions:
  - "Newline hardBreak moved into a table cell is accepted: the parser reads `|a\\nb|c|` back as one cell (open-row merge), so the re-parse check passes."
  - "Multi-mark text over edge whitespace emits `*_hello _*world`, which does not read back, so it fails closed."
requirements-completed: [SAFE-03, SAFE-04, SAFE-06]
metrics:
  tasks: 3
  completed: 2026-11-16
---

# Phase 97 Plan 14: Save-time re-parse check Summary

`saveWiki` now emits the edited doc, re-parses the emitted text and compares structure, returning `{kind:'failed', reason}` instead of corrupted text; SAFE-04 and SAFE-06 are Complete again.

## Commits

- c960ad7b: save-check.ts (shape projection, checkSaved) and tests
- ecc899dc: saveWiki returns WikiSave, callers and WR-01 battery
- Task 3 docs commit (VALIDATION map rows, Deferred to Phase 98, REQUIREMENTS.md)

## shape() normalisation rules

1. Spelling attrs are not structure: blocks keep type plus semantic attrs only (heading level, table headerless, panel type/params, code language and exact body, rawBlock raw, link href, color value, atom ids). Gap, prefix, sep, markers, open/close, span, form, src, padding are dropped. Why: D-05 spellings are replayed, not structural.
2. Inline stream: escape atoms become their character; adjacent equal-mark text merges; spaces/tabs before a break and at stream end are trimmed. Why: an escape is how typed text is spelled; D-07 strips trailing whitespace on edit.
3. Item and cell paragraphs/rawBlocks flatten into one stream joined by breaks. Why: the emitter writes them joined by a break and the parser reads them back as one paragraph (rawBlock becomes rawInline).
4. Empty paragraphs are dropped from doc, panel and quote bodies, and cells/items. Why: blank lines are gaps on re-parse.
5. Edge spaces/tabs of a maximal run of a delimiter mark compare as unmarked on both sides. Why: 97-13 hoists them outside canonical delimiters, brace spellings keep them inside; either reads back equal. Never drops a mark from a non-space character.

No rule was added beyond the five planned. Top-level rawBlocks additionally match on `blockSource(slice)` for rich-demoted docs.

## RED evidence (pre-change `saveWiki` on the corruption cases)

- intraword italic: `x_a_y`
- bold across break: `*one\ntwo*`
- mono with brace: `{{a}b}}`
- link href with bracket: `[t|https://x.example/a]b]`
- typed `h1. hi`: `h1. hi` (reads back as heading)
- typed `see (x) here`: `see (x) here` (reads back as emoticon)
- listItem[paragraph, codeBlock]: throws `cannot emit a codeBlock inside a list item`

After the change all return `kind: 'failed'`; the `h1.` reason contains `{{h1. hi}}`, the `(x)` reason contains `monospace does not help`, the codeBlock reason contains `list item`.

## 97-13 handoff shapes

- (a) newline hardBreak in a table cell: emits `|a\nb|c|`, `|c|a\nb|`, `|a\nb|`. These all re-parse to the identical structure, so they save. The test asserts this and that a mismatching doc against the same text is refused.
- (b) bold+italic over `hello `: emits `*_hello _*world`; check fails closed (tested).
- 97-12 unspellables `(x)`, `(i)`, typed `h1. `: fail closed with the unspellableReason text (tested).

## Verification

Full `npm run test` (5691 passed) and `npx tsc --noEmit` green before the REQUIREMENTS.md edit; biome clean on `src/lib/wiki/editor`. Corpus battery (one appended character per rich fixture) saves for every fixture; `EXCLUDED` is empty.

## Deviations from Plan

- Worktree base was behind the expected base commit; reset to 53a5c7c7 per the startup step (tree was clean).
- Ran `biome check --write` once across `src/lib/wiki/editor/*.ts` (it only changed my own test file; verified by git status).

## Known Stubs

None.

## Self-Check: PASSED
