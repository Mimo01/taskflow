# Quick Task 261014-crk: Polish AIO cycle detail (stats tiles, Execution Distribution, Defect Summary) - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Task Boundary

Polish the AIO cycle detail page (follow-up to 261013-mnc), taking inspiration from the real AIO UI
(user screenshots: "Cycle Statistics" tile grid + "Execution Distribution" pie; "Defect Summary" with
"Status Distribution" + "Priority Distribution" pies and a "Show only latest run" checkbox).
Scope: cycle detail page only (aio-cycle/CycleKpiTiles, ExecutionsList/DefectsList headers, page composition).

</domain>

<decisions>
## Implementation Decisions

### Execution Distribution
- Donut chart placed BESIDE the KPI tiles (tiles left, donut right, like AIO), REPLACING the segmented progress bar.
- Status colours (existing status palette), no legend: direct labels on slices / tooltip per slice (<=4 rows),
  centre shows executed/total. Responsive: donut stacks below the tiles when narrow.

### KPI tiles
- Claude's discretion, with the user constraint: "not too overcomplicated and no duplicate data".
- Guidance: AIO-style presentation (centred big number, small "(xx%)" sub-line) but every figure shown ONCE
  across tiles + donut. Don't repeat in tiles what the donut already shows per status (no per-status
  Passed/Failed/Blocked tiles if the donut carries them). Only data computable from probed API fields
  (no effort tiles unless API returns effort).

### Defect Summary charts
- Claude's discretion, with the user constraint: user likes PIE graphs, "not too complicated and no duplicate data".
- Guidance: two pies/donuts (Status distribution, Priority distribution) in a "Defect Summary" block with the
  "Show only latest run" toggle only if latest-run data is already available; priority colours follow the
  existing 9-level scheme (icon severity); status colours by status category. No duplicate numbers vs. the
  defects list / tiles (e.g. open-defect count lives in ONE place).

### Claude's Discretion
- Exact tile set/count, chart library usage (recharts ^3.8 already a dependency), layout breakpoints, empty/loading states.

</decisions>

<specifics>
## Specific Ideas

- Real AIO: Cycle Statistics grid 4x2 (Total Cases, Incomplete Cases %, Cases in Passed type %, Cases in Failed type %, Estimated/Actual Effort, All Defects (Open: n), Latest Run Defects (Open: n)); Execution Distribution pie w/ legend (Not Run, In Progress, Passed, Failed, Blocked, N/A).
- Defect Summary: Status Distribution + Priority Distribution pies, titled, "Show only latest run" checkbox top-right.
- Saved prefs apply: colour = status only, <=4-row tooltips, no legends, identical cards across tabs, one row = one line.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Prior work: .planning/quick/261013-mnc-enhance-aio-cycle-detail-page-and-testca/ (SUMMARY.md, PROBE-RESULTS.md).

</canonical_refs>
