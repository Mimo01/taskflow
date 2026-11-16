---
phase: 97-round-trip-engine
plan: 13
subsystem: wiki-editor
tags: [emit, cr-03, cr-04, wr-02, gap-closure]
requirements: [SAFE-04, SAFE-06]
key-files:
  modified:
    - taskflow/src/lib/wiki/editor/emit.ts
  created:
    - taskflow/src/lib/wiki/editor/emit-edited.test.ts
metrics:
  tasks: 3
  completed: 2026-11-16
---

# Phase 97 Plan 13: Emitter contracts on edited documents

emit.ts now fails closed (WikiEmitError) on shapes wiki cannot express, never drops raw atoms in items and cells, keeps cells and breaks line-safe, hoists edge whitespace out of canonical flank-sensitive marks, and reuses recorded spellings only while they still match the node's attributes.

## Commits

- 8f09429b Task 1 (CR-03): container children routed through real emitters; `WikiEmitError`; no `textOf` fallback.
- 9349da97 Task 2 (CR-04 + edge whitespace): empty-cell space, context-aware hard break, `hoistEdgeSpace`.
- fc395f03 Task 3 (WR-02): `stillSpells`, `colorOpen`, `codeOpenHolds`.

## RED evidence

Task 1 (pre-fix emitter plus a stub `WikiEmitError`, 10 of 11 failed): list item with raw block emitted `* a\n` (raw lost); raw-only cell emitted `||`; paragraph plus raw in a cell emitted `|a|`; code/panel/table/heading/quote in items and cells did not throw.

Task 2 (12 failures): `||b|` for the empty first cell; `|a||c|` after clearing a parsed cell; `||||h||` for empty header cells; `|a\nb|` for a user-created break in a cell; heading with break split into 2 blocks; `*hello *world`, `say* hello*`, `x_ a b _y`, `*hello\t*z`, `see *hello *`, `a* *b`. The no-hoist idempotency tests (`{*} a {*}`, `^ a ^`, `{color:red} a {color}`, etc.) pass both before and after.

Task 3 (5 failures): `[~jdoe]` written back after the id edit; `!a.png|width=3!` after the name edit; `[x|^f.pdf]` after the label edit; `{color:red}a{color}` after the value edit; `{code:java}` after the language edit.

## Deviations from Plan

**1. [Rule 1 - Bug] Recorded `\n` hard break kept in cells/headings/quotes.** The plan said a break whose src contains a newline is rewritten to `\\` in cells, headings and quotes. That broke `tables/open-row-merge.wiki` (parsed open-row continuation, `src:"\n"`) and the fuzz inputs with multi-line quotes, which violates SAFE-03. Only a break with no recorded src (user-created) is rewritten. The plan bullet "hardBreak {src:"\n"} moved into a cell emits `\\`" is therefore not implemented (a parsed and a moved break are indistinguishable); plan 97-14's save re-parse check is the backstop for that shape. Replaced by a test that a parsed open-row continuation round-trips.

**2. [Rule 1 - Bug] Edge-whitespace hoist only peels text carrying exactly that one mark.** The fuzz corpus (`||*~  ~text`) showed that peeling whitespace off a text node that also carries a nested mark (sub) moves the bold delimiter inside the nested mark's delimiter, breaking byte round-trip. Nodes with additional marks fall back to the previous behaviour.

**3. Attribute comparison in `stillSpells`** compares only semantic attrs (mention id; image name/params; attachment name/label) rather than the full attrs minus src, so schema-default attrs on editor-serialised docs never cause a spurious respelling.

## Verification

`npx vitest run src/lib/wiki/editor src/lib/wiki/equivalence.test.ts`: 17 files, 210 tests pass (corpus byte-identical). Full pre-commit suite (vitest, biome, tsc) passed on every commit. spelling.test.ts unmodified.

## Known Stubs

None.

## Self-Check: PASSED
