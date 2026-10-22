# Quick Task 261022-kd8: AIO cycle detail KPI tiles — keep Pass rate, replace the other 3 with step-level metrics - Context

**Gathered:** 2026-10-22
**Status:** Ready for planning

<domain>
## Task Boundary

AIO test cycle detail page, stats block (`taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx`).
Today the 4 tiles are: Pass rate, Ready to retest, Unlinked failures, Re-runs. The last three
almost always show 0. Keep **Pass rate** exactly as is; replace the other three with
**test-step-level** metrics. User: "we only track cases, i also want to track steps".

Out of scope: Execution Distribution donut, Defect Summary donuts, Burndown, the layout
of the block (2x2 / 4-across responsive grid stays), other AIO pages.

</domain>

<decisions>
## Implementation Decisions

### Tile set (user picked all four candidates + "figure something out, make it look nice and consistent")
Recommended final set of 3 (Claude's discretion to adjust if data forces it):
1. **Step pass rate**: passed steps ÷ executed steps (executed = pass + fail + blocked), e.g. `91%`;
   sub `of executed steps`; tooltip rows Passed / Failed / Blocked steps with the same status colours
   as the case Pass rate tile (green-500 / red-500 / orange-400). `—` when no step executed.
   Mirrors the case Pass rate tile so the two read as a pair.
2. **Steps executed**: executed steps ÷ all steps as `%`; sub `N of M steps`; tooltip may split
   executed vs not run.
3. **Steps per case**: average step count per case (1 decimal), sub `M steps total`; tooltip e.g.
   min / max steps per case.
- **Failed steps** is NOT its own tile (it's 0 in a clean cycle, exactly what the user is removing);
  fold failed/blocked step counts into the Step pass rate tooltip instead.
- Order: Pass rate | Step pass rate | Steps executed | Steps per case.

### Look and consistency
- Reuse the existing `Tile` / `TileSkeleton` / `VALUE_CLASS` from `AioTile.tsx` and the same
  TooltipBody/TooltipRow pattern. Same geometry, no coloured numbers, ≤ 4 tooltip rows.
- Icons: distinct per tile, not circle-ish, readable when cropped (lucide; e.g. ListChecks,
  ListTodo/Footprints, Layers — Claude picks; Pass rate keeps CircleCheck).
- Tints: neutral/consistent with the existing tile tint palette; colour = status only.
- Skeletons while step data loads, matching final geometry (one per tile).

### Claude's Discretion
- How step data is fetched (per-run detail with `assignSteps=true` vs any bulk endpoint), caching,
  concurrency limits, and whether the tiles reuse cached run-detail queries.
- Drop the now-unused retest/unlinked/re-run computations and the `defects` prop to the tiles if it
  becomes unused (keep it if still needed for the donuts — it is).
- Update the component's doc comment and the tests that reference the removed tiles' testIds.

</decisions>

<specifics>
## Specific Ideas

- Design rules from earlier UAT (memory: aio-cycle-stats-block, dashboard-ui-preferences): no figure
  shown twice (case counts live in the Execution donut — step metrics are new data, so fine), no
  time-based tiles, no coloured tile numbers, tooltips ≤ 4 rows, read-only (no click-through).
- Step statuses: `AioTestRunStep.status` normalized "PASS" | "FAIL" | "BLOCKED" | "NOT_EXECUTED"
  (see `taskflow/src/services/aio/types.ts`). Run detail: GET run detail `?assignSteps=true`
  returns `testRunSteps[]` (PROBE P3 in `.planning/quick/261013-mnc-*/261013-mnc-PROBE-RESULTS.md`).
- A cycle can have dozens–hundreds of runs: fetching every run's steps must be bounded and must not
  block the case Pass rate tile or the donuts.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/261013-mnc-enhance-aio-cycle-detail-page-and-testca/261013-mnc-PROBE-RESULTS.md` (live API shapes)
- `taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx`, `AioTile.tsx`, `useAioCycleData.ts`
- `taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx` (existing run-detail + steps fetch)

</canonical_refs>
