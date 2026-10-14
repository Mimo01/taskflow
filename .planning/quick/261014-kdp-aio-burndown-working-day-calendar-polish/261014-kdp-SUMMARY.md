# Quick 261014-kdp: AIO burndown working-day calendar and polish

Burndown ideal now measured in Tempo working days (Mon-Fri fallback), non-working days shaded, chart restyled on a Card, and moved into the top stats row as a column.

## Commits
- 39faff8c: working-day ideal and nonWorking ranges in cycleBurndownSeries (+ tests, CycleKpiTiles temp arg)
- f456645c: Card-surfaced chart, in-row layout, calendar wiring from AioCycleDetailPage (+ tests)
- Task 3 needed no component fixes, so it has no commit; preview harness files were deleted and the tree is clean.

## What changed
- `cycleBurndownSeries(runs, cycle, now, isWorkingDay)`: ideal = total * (1 - W(t)/W(to)), W = working time elapsed; ideal-only points at every interior local midnight (remaining = step value up to max(tail, last execution), null after); merged `nonWorking` ranges clipped to [from, to]; fully non-working span falls back to the linear ideal; spans over 731 days skip the day walk (T-kdp-01).
- CycleBurndown: `<Card size="sm">` absolute inset-0 (overflow-visible so the tooltip is not clipped), CartesianGrid, 2px foreground Area step line with 0.06 fill, dashed 1.5px muted ideal, ReferenceArea bands only when >= 4px per day, tick styling, tickCount 4, no fixed heights.
- CycleKpiTiles: `calendar` prop; three layouts (stacked with 140px plot, two rows from 896px, one row of four from 1408px using `@min-[88rem]/epic`, which Tailwind v4 generated correctly); memo keyed on `calendar.source` + joined holidays. Section gained `bodyClassName`.
- AioCycleDetailPage calls `useEpicWorkCalendar(toLocalDateString(new Date()))` and passes `calendar`.

## Screenshots (fixture harness, Chrome headless; 1500/1100/760px, light; 1500px dark)
- 1500px: one row of four; block height identical (divider at the same y) to a render with no burndown; plot fills the tile height.
- 1100px: two rows [tiles | burndown] / [execution | defect]; plot fills the tiles' height.
- 760px: stacked, 140px plot.
- Weekend bands and the Mon 12 Oct holiday merge into one band; the ideal is flat across them; Saturday diamond sits at its real position; gridlines light; ticks legible, no clipping; dark mode fine; line distinct from diamonds (r 4 kept).
- No visual fixes were necessary.

## Deviations from Plan
- Existing cycleBurndownSeries tests assert on a filtered subset of points (executions, from, to, now) since midnight boundary points were added. Fixtures switched from UTC-epoch to local-time constructors.
- CycleBurndown.test.tsx fixture start changed to a local-time date; added layout tests (heading order, no old strip classes).
- Added `overflow-visible` to the Card (not in the plan) so the recharts tooltip is not clipped by the Card's default overflow-hidden.
- A biome-ignore (with reason) is on the useMemo in CycleKpiTiles for the intentional content-based deps.

## Verification
Full pre-commit suite passed on both commits (3521 tests); tsc and biome clean on touched files.

## Known Stubs
None.

## Self-Check: PASSED
