# Quick 261014-jzn: AIO cycle burndown chart Summary

Compact AIO-style burndown (neutral step line of remaining cases, status-coloured diamond per execution, dashed straight ideal line) added to the AIO cycle detail stats block.

## Commits
- f587fc4a: cycleBurndownSeries / aioDateMs / burndownMarkerColor + unit tests (aio-cycle-charts)
- 844b70d7: CycleBurndown component, wired into CycleKpiTiles and AioCycleDetailPage (`cycle` prop) + tests

## Behaviour
- Burndown section sits below the stats row, 140px plot; skeleton while runs load; hidden when nothing executed.
- Tooltip: Remaining / Executed / Ideal (max 3 rows), z-index 50, no legend.

## Deviations from Plan
- Environment: the worktree had no node_modules; symlinked `taskflow/node_modules` to the main checkout's (git-ignored, not committed).
- Test adjustment: the plan's "series with fewer than 2 points returns null" does not trigger for a zero-span cycle (start point plus execution point = 2 points), so that test asserts all ideal values are null instead.
- No existing AioCycleDetailPage tests needed changes.

## Self-Check: PASSED
Both commits exist; full suite (3511 tests), tsc and biome pass.
