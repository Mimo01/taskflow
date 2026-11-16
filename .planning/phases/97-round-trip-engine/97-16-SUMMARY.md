---
phase: 97-round-trip-engine
plan: 16
subsystem: wiki-editor
tags: [safe-06, safe-04, escape, gap-closure]
requires: []
provides:
  - mid-line live macro tokens modelled as rawInline atoms
  - opening-delimiter-last escape minimiser
key-files:
  modified:
    - taskflow/src/lib/wiki/editor/parse/inline.ts
    - taskflow/src/lib/wiki/editor/parse/tables.ts
    - taskflow/src/lib/wiki/editor/emit.ts
    - taskflow/src/lib/wiki/editor/raw.test.ts
    - taskflow/src/lib/wiki/editor/escape.test.ts
    - taskflow/src/lib/wiki/editor/save-check.test.ts
    - taskflow/src/lib/wiki/editor/roundtrip.test.ts
metrics:
  tasks: 2
  completed: 2026-11-16
---

# Phase 97 Plan 16: Typed macro look-alike escaping Summary

Mid-line `{code}`, `{info}` and similar tokens are now rawInline atoms when parsed, so typed look-alikes are saved with an escaped opening brace while parsed Jira callouts survive edits verbatim.

## Commits
- 2e220990: parser models LIVE_INLINE_MACROS (known macros minus color) as rawInline
- 61b747ce: OPENING_DELIMS ordering in the minimiser, cell panel opener fix, gap 1 tests

## RED evidence
- Task 1: `raw.test.ts` "mid-line live macro tokens (gap 1)" ran 3 failed / 10 passed before the parser change (token rawInline assertion, split-around-atoms, atoms-in-marks). All pass after.
- Task 2: before the emitter change, the gap-1 paragraph and item emissions already escaped (Task 1 makes the re-parse differ) but chose the closing brace: `a {code\}x{code\} b`. The WR-04 spellings were RED (`ping [\~admin] now` vs expected `ping \[~admin] now`, also in save-check.test.ts) and the `{code}` saveWiki case was RED for the same reason. Green after OPENING_DELIMS.

## Changed pinned spellings (old to new)
- escape.test.ts and save-check.test.ts: `ping [\~admin] now` -> `ping \[~admin] now`
- Added exact spellings: `macro \{status:colour=Red} x`, `a \[^secret.pdf] b`, `a \{code}x\{code} b`
- roundtrip.test.ts RAW_ALLOWED: added `panels/panel-mid-line.wiki` (6 mid-line live tokens are now rawInline atoms, so the "no raw atoms unless allowed" registry needed the entry). No byte-identity, fuzz or equivalence assertion was changed.

## Corpus loadWiki kinds (fixtures containing mid-line macro tokens), after
All `rich`: escapes/regressions, lists/panel-after-item, macros/mismatched-closer, monospace/plain-space, panels/panel-in-panel, panels/panel-mid-line, tables/code-in-cell, tables/inline-callout-cell, tables/panel-in-cell-multi. No kind changed (the unchanged corpus and registry tests are green).

## Deviations from Plan
1. [Rule 1 - Bug] `{{code}}` monospace: the new rule turned the inner `{code}` into an atom and broke the mono span (monospace/plain-space.wiki). Fix: skip a token directly wrapped as `{{name}}` in inline.ts.
2. [Rule 3 - Blocking] `parse/tables.ts` cellBlocks matched `{panel...}` after a backslash, so an escaped typed `\{panel}` in a cell re-parsed as a panel and could not be spelled. Added a `(?<!\\)` lookbehind to the opener regex. File not in the plan's files_modified list.
3. roundtrip.test.ts edited (registry entry, see above); the plan's acceptance listed it as untouched, but the expectation pinned mid-line macros as text.
4. Cells: typed `{code}`/`{noformat}` in a table cell cannot be spelled at all because parseCell keeps any cell containing `{code`/`{noformat` as a raw table (D-10), escaped or not. The emitter leaves it as typed and checkSaved fails closed (tested in save-check.test.ts). The escape.test gap-1 cell cases therefore cover the 7 other strings; code/noformat in a cell are covered by the fail-closed test. Whether to make parseCell escape-aware is left for a follow-up (needs the renderer behaviour for `\{code}` in cells).

## Known Stubs
None.

## Notes
- The worktree had no node_modules; a symlink to the main checkout's node_modules was created (gitignored).

## Self-Check: PASSED
