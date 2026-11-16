---
phase: 97-round-trip-engine
plan: 17
subsystem: wiki-editor
tags: [safe-06, safe-03, end-to-end, gap-closure]
requires: [97-15, 97-16]
key-files:
  created:
    - taskflow/src/lib/wiki/editor/typed-render.test.ts
  modified:
    - .planning/phases/97-round-trip-engine/97-VALIDATION.md
requirements-completed: []
completed: 2026-11-16
---

# Phase 97 Plan 17: End-to-end typed text proof Summary

A 32-case battery feeds typed text through `saveWiki` and then `wikiToHtml` and asserts it displays exactly as typed with no generated element. It passes with 97-15 and 97-16 merged. SAFE-06 was deliberately NOT marked Complete, because one cell-level gap is still open (below).

## Commits
- b002c0c5: test(97-17): end-to-end typed text battery

## What the battery covers
- The verifier's 8 repro rows as paragraphs (`{code}`, `{info}`, `{quote}`, `{noformat}`, `*b*`, `_b_`, `[~admin]`, `{color:red}`).
- All 14 escapable characters (each must save and display as typed, or fail with a non-null `unspellableReason`; none took the failure path).
- `{code}`/`{info}`/`{quote}` look-alikes in list items (exactly 2 `<li>` kept), and `{info}`/`{quote}` in table cells.
- Typed image syntax yields no `<img`; `panels/panel-mid-line.wiki` edited elsewhere keeps 3 `data-callout`; `JIRA_ESCAPE_CHARS` equals `ESCAPABLE_CHARS`.

## RED evidence
Run on a throwaway worktree at 9b4bc73c (pre-fix): 18 failed, 14 passed. Failures: paragraph rows `{code}` (renders a code fence), `{info}`, `{quote}` (renders a blockquote), `{noformat}`, `*b*` (strong), `_b_` (em), `[~admin]` (mention), `{color:red}x{color}` (span); escapable `* _ ^ ~ !`; list item `{code}`/`{info}`/`{quote}`; table cell `{quote}`; and the constants agreement case (`JIRA_ESCAPE_CHARS` undefined). Worktree removed; `git worktree list` is clean.

## Verification
- Full suite (pre-commit hook): 5754 passed; `npx tsc --noEmit` clean; biome clean on the new file.

## Open gap (why SAFE-06 is not marked Complete)
Typed `{code}...{code}` or `{noformat}...{noformat}` inside a TABLE CELL cannot be saved. This is the 97-16 deviation 4 limitation: `parseCell` treats any cell containing `{code`/`{noformat` as a raw table, escaped or not, so no spelling is safe. `checkSaved` fails closed (saveWiki returns `failed`), so nothing is corrupted, but the user cannot save that text. The battery pins this as `table cell fails closed` rather than hiding it. Closing it needs `parseCell` to become escape-aware plus a renderer check. REQUIREMENTS.md was left untouched (SAFE-06 still Pending); the orchestrator should decide whether fail-closed is acceptable for the requirement or a follow-up plan is needed.

## Deviations from Plan
1. Task 2: REQUIREMENTS.md SAFE-06 edit skipped, per the open gap above and the instruction not to mark SAFE-06 complete when a real gap remains. Full suite and tsc were green.
2. Table-cell `{code}`/`{noformat}` cases assert fail-closed instead of display-as-typed (known limitation).
3. Table-cell assertions compare `${typed}z` because adjacent cells have no whitespace separator in `textContent`.
4. The worktree base was reset to 42ccb9e8 per the branch check (it started elsewhere).

## Known Stubs
None.

## Self-Check: PASSED
