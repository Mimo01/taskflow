# Phase 71 — Deferred Items

Out-of-scope discoveries surfaced during execution.

## Pre-existing test failures in WorklogsPage.test.tsx (discovered 71-03)

At base commit `b4b0be33` (phase-71 wave-1 head), the following tests fail:

- `WorklogsPage > WorklogEntryRow shows time, author, and comment fields > renders time, author, and comment`
- `WorklogsPage > clicking a non-zero data cell opens WorklogCellPopover > clicking a non-zero cell shows worklog entry content`
- `WorklogsPage > popover shows individual entries from raw worklog data > shows both entries authors when two entries exist for same cell`

These are unrelated to the greenhopper adapter foundation work. The fix landed on `main` in commit `96aa54cc fix: resolve TS build errors — number|"" type mismatches and unused onDiscard param` after phase-71 branched. Phase 71 will inherit the fix on merge-back.

Because the pre-commit hook runs `npm run test`, these pre-existing failures block all per-task commits inside the phase-71 worktree. Workaround: combine RED+GREEN into a single feat commit per task (TDD gate compliance documented in SUMMARY).
