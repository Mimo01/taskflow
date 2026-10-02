# Quick Task 261002-enj: Epic progress — confidence in hover, readable hoverable risks, spacing, no chart legend - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning

<domain>
## Task Boundary

Follow-up polish on the epic detail progress section after 261002-0xf (all on main). Keep the established style.
Key files: `taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx` (Finish card, Risks card, hero), `EpicStatCard.tsx`,
`EpicBands.tsx` (BandBar), `EpicProgressSection.tsx` (layout/spacing), `EpicCfdChart.tsx` + `EpicTimeBurnup.tsx` (legend rows,
ForecastLegend, SourceFlag, presets placement), `EpicChartZoom.tsx` / `EpicRangeNavigator.tsx` (presets), `taskflow/src/lib/epic-progress.ts` (risk text).

User feedback on 261002-0xf (verbatim):
1. "Move the confidence only into the hover."
2. "The risks are too untelling without clicking on them, put more info outside. Also make them hoverable."
3. "The completed bar is a little too wide."
4. "The top 'cards' are too close to the big graph."
5. "The legend of the big graph is too close to the slider. I don't think we need the legend there at all."

</domain>

<decisions>
## Implementation Decisions (Claude's discretion within the user's direction)

### 1. Confidence only in hover
- Finish card: remove the ConfidenceMeter from the card sub-line; the sub-line keeps only the date range (or the non-ok state sub).
- Finish tooltip keeps the Confidence row (meter + word) and the one-line reason note.
- Chart tooltips: confidence stays only where it is hover content already (no visible confidence anywhere outside hovers).

### 2. Risks readable outside + hoverable
- Risks card keeps the fixed 3-slot card shape. Value: "N risks" / "No risks". Sub-line: readable short labels instead of bare tokens —
  each risk as icon + short phrase, e.g. "Overdue 3 days", "2 unassigned", "3 unestimated", "Finishes 4 days late" (add/adjust a
  `short` text in the lib risk model if needed, ≤ ~16 chars), joined with " · ", warnings first; truncate with ellipsis on one line.
  When more risks than fit: the visible ones + "+N" (no wrapping; card height unchanged).
- Each risk in the sub-line is hoverable: hover/focus shows a tooltip in the unified tooltip style (risk text + one-line detail, ≤ 2 rows,
  no issue list). Click (or Enter/Space) still opens the existing popover with the issue rows; keyboard model unchanged.
  Hover tooltip and click popover must not fight (no flicker): e.g. tooltip closes when the popover opens; planner verifies with base-ui
  composition (Tooltip trigger rendering the PopoverTrigger, or equivalent).
- Card-level hover (hovering the Risks card outside a chip) may show a compact list of all risks (≤ 4 rows) — optional, planner's call.

### 3. Completed bar narrower
- The hero BandBar (in the Completed card sub-slot) is too wide: cap its width (e.g. ~70–75% of the card or a fixed max like 10rem),
  keep h-2, left-aligned; consistent across tabs.

### 4. More space between cards and the big chart
- Increase the gap between the stat-card grid and the chart block (e.g. +8–12px; consistent with the section's rhythm). No negative margins.

### 5. Remove the big chart's legend row
- Remove the legend rows under both charts (CFD and Time). Series meaning stays discoverable via the chart hover tooltip.
- Relocate what lived in the legend row:
  - Zoom presets (All/6M/3M/1M/Forecast): move to a compact row ABOVE the chart, right-aligned (same row as a small source flag if shown);
    only rendered when zoom is enabled. The navigator under the plot stays.
  - SourceFlag (approximate data icon): same row above the chart, left of the presets (or alone when zoom is disabled).
  - ForecastLegend state text ("Forecast: Too early"): drop — the Finish card already shows the state.
- Ensure the navigator has adequate spacing below the plot and nothing sits tight beneath it.
- Update the EpicDetailSheet.test text rule awareness: legend previously carried "Completed / In progress / To do" visible text; removing
  it is fine (no new standalone "Done"/"In Progress"/"Stories" text nodes).

### Constraints carried over
- Update only intentionally changed tests; list them (legend tests, forecast-state legend tests, Finish meter-in-card tests, risk chip text tests, preset location tests).
- No negative margins inside spaced containers. One row = one line.
- Pre-commit hook does NOT lint: run `npx biome check <touched files>` from taskflow/ manually. tsc incl tests (no `.at`) + full vitest gate commits; never --no-verify. zsh arrays for file loops; no `timeout` command.

</decisions>

<canonical_refs>
## Canonical References

- .planning/quick/261002-0xf-epic-progress-polish-zoom-slider-consist/ (plan, UI review, summary, review)

</canonical_refs>
