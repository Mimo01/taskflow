# Phase 71 — Deferred Items

Out-of-scope discoveries surfaced during execution.

## Pre-existing test failures in WorklogsPage.test.tsx (discovered 71-03)

At base commit `b4b0be33` (phase-71 wave-1 head), the following tests fail:

- `WorklogsPage > WorklogEntryRow shows time, author, and comment fields > renders time, author, and comment`
- `WorklogsPage > clicking a non-zero data cell opens WorklogCellPopover > clicking a non-zero cell shows worklog entry content`
- `WorklogsPage > popover shows individual entries from raw worklog data > shows both entries authors when two entries exist for same cell`

These are unrelated to the greenhopper adapter foundation work. The fix landed on `main` in commit `96aa54cc fix: resolve TS build errors — number|"" type mismatches and unused onDiscard param` after phase-71 branched. Phase 71 will inherit the fix on merge-back.

Because the pre-commit hook runs `npm run test`, these pre-existing failures block all per-task commits inside the phase-71 worktree. Workaround: combine RED+GREEN into a single feat commit per task (TDD gate compliance documented in SUMMARY).

## Biome regressions inside `src/services/jira/greenhopper/` (discovered 71-06)

Found while running `npx biome check src/services/jira.ts src/services/jira/greenhopper` as part of the 71-06 Task 2 verification pipeline. All originate from files committed by plans 71-02..71-05 (not modified by 71-06). Per the executor scope-boundary rule, they are not fixed in 71-06.

| File | Rule | Notes |
|------|------|-------|
| `__fixtures__/allData.real.json` | format | Real-data fixture — formatter wants single-line arrays |
| `__fixtures__/data.real.json` | format | Same |
| `__fixtures__/details.real.json` | format | Same |
| `__fixtures__/transitions.real.json` | format | Same |
| `adapter.test.ts:26` | lint/style/noNonNullAssertion | Fixture indexing — replace `[0]!` with explicit non-null check |
| `adapter.ts` | format + organizeImports | Auto-fixable via `biome check --write` |
| `client.ts` | format | Auto-fixable via `biome check --write` |
| `entityMaps.test.ts:16` | organizeImports | Auto-fixable |

**Totals:** 8 errors, 1 warning. Biome baseline (memory `project_biome_state.md`) was 0/0 before phase 71; the regression entered in waves 1-3.

**Recommendation:** A small cleanup plan that runs `npx biome check --write src/services/jira/greenhopper` and hand-fixes the two non-fixable cases (the `[0]!` assertion and the four pretty-printed JSON fixtures — may want a biome override for diff readability).

**Plan 71-06 verification scope:** `npx biome check src/services/jira.ts` is clean (0/0) — that is the only file 71-06 modified. `src/services/jira/greenhopper/index.ts` (newly created) is also clean.
