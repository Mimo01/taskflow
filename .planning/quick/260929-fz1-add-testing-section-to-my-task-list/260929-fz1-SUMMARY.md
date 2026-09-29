# Quick 260929-fz1: Testing band in My Day + workflow display order

Added a "Testing" band (status name contains "test", amber dot) to the My Tasks My Day view and decoupled render order (MY_DAY_BAND_DISPLAY_ORDER) from classification precedence (MY_DAY_BANDS).

## Commits
- a46febcb feat: testing band, named band constants (no numeric literal returns), display-rank sort, page label/dot maps, lib tests
- 8f765c0b test: MyTasksPage render tests (Testing header, In Progress -> Testing -> To Do row order)

## Deviations
None. MR band not covered in the page render test (harness has no simple myOpenMRIssueKeys supply); lib tests cover it (all 8 bands in display order).

## Notes
- "Ready to test" is statusCategory indeterminate, so it still counts toward the In Progress stat tile (stat tiles key on category, not bands).
- Worktree had no node_modules; symlinked main checkout's (gitignored, uncommitted).
- Biome shows only pre-existing warnings (unused suppressions in test file, non-null assertion in page); no new ones.

## Self-Check: PASSED
Full vitest suite ran green in the pre-commit hook on both commits (2805 passed).
