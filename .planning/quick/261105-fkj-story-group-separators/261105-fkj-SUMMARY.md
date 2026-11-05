# Quick 261105-fkj: Story group separators Summary

Faint `divide-y divide-border/40` hairline between story groups (story plus its subtasks/MRs) in My Tasks (My Day bands and sprint-grouped lists), Standup Today (In Progress, Up Next) and Yesterday (Worked On).

## Commits
- c6b45eb9: My Tasks. `MyTaskRow` top-level rows now render a `my-task-group` wrapper div (internal space-y and half-gap py moved inside). Both list containers in `MyTasksPage` use `divide-y divide-border/40`. New group test in `MyTasksPage.test.tsx`.
- d14d6a1f: Standup. `TodayInProgressSection`, `TodayUpNextSection` and `YesterdayColumn` lists use `flex flex-col divide-y divide-border/40`. Group wrappers (including the `IssueActivityGroup` root) carry `data-testid="standup-story-group"` and `py-0.5 density-compact:py-px density-comfortable:py-1`. New test in `TodayColumn.test.tsx`.

## Deviations from Plan
None. Production code was not altered to fit test mocks.

Environment note: the worktree had no node_modules, so I symlinked the main checkout's `taskflow/node_modules` into the worktree (gitignored, not committed). The worktree also started at a different base and was reset to eae552af as instructed.

## Verification
Full vitest suite passed in the pre-commit hook for both commits (4398 tests). Biome reported no errors on the touched folders. Row classes were untouched, so row heights are unchanged; inter-group spacing is preserved by the half-gap padding.

## Known Stubs
None.

## Self-Check: PASSED
