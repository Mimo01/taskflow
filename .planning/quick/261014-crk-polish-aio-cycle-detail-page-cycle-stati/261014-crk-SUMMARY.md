# Quick 261014-crk: AIO cycle detail polish Summary

Execution Distribution donut beside a de-duplicated 2x2 tile grid, plus a Defect Summary with Status and Priority donuts, built on recharts 3.8 fixed-size `PieChart` (no Cell, no ResponsiveContainer).

## Commits
- fe8f16f9: feat(261014-crk): aio cycle chart helpers (`lib/aio-cycle-charts.ts` + 13 unit tests)
- 242af1bb: feat(261014-crk): execution distribution donut + de-duplicated cycle stats
- c1a55f97: feat(261014-crk): defect summary status + priority pies

## What changed
- `AioDonut.tsx` (shared donut + same-size ring skeleton), `ExecutionDonut.tsx` (160px, centre `executed/total`, loading ring, "No runs recorded" empty ring).
- `CycleKpiTiles.tsx`: tiles are Pass rate (pass/executed), Re-runs, Unlinked failures, Open defects in a fixed `grid-cols-2`; donut beside on `@3xl`, stacked below when narrow. Progress bar removed (`cycle-progress-bar` / `progress-seg-*` gone). `lastExecuted` prop dropped (header already shows it).
- `DefectSummary.tsx` replaces `SummaryStrip`: "Defect Summary" with Status (by category) and Priority (icon-severity colours) cards, plus the plain `Sev:` line. No centre count, no latest-run toggle. `severityOf` now lives here and is imported by `DefectsList`.
- Page tests updated to assert donut/tile testids and centre text instead of segment widths.

## Deviations
None of substance. The worktree had no `node_modules`; symlinked the main checkout's (gitignored) to run tests. The worktree was also reset to 5ddb309a per the branch check.

## UAT points
- FLAG: Pass rate is now passed/executed, not passed/total (de-duplication against the donut share). Cheap to revert.
- Check the not-run slice colour (gray-300) is readable against the card.
- A donut was rejected earlier on the cycles list dashboard (261013-l97); confirm it is wanted here.
- "Show only latest run" toggle intentionally omitted: defect data is already latest-run only (cycles.ts:588).
- No slice labels, only hover tooltips (at most 4 rows). Critical and Should share a colour (both use highest.svg).
- Narrow the window and confirm the donut stacks below the tiles.
- Hover tooltips on donut slices were not tested in jsdom; verify visually in the app.

## Known Stubs
None.

## Verification
Full vitest suite (3370 passed), tsc clean, biome clean on touched files (pre-commit ran on each commit).

## Self-Check: PASSED
