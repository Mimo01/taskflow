---
phase: quick-261002-enj
plan: 01
subsystem: epic-progress
tags: [epic, risks, charts, polish]
key-files:
  modified:
    - taskflow/src/lib/epic-progress.ts
    - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicRangeNavigator.tsx
metrics:
  completed: 2026-10-02
---

# Quick 261002-enj: Epic progress polish Summary

Readable hoverable risk labels (tooltip + popover on one trigger), confidence only in the Finish hover, capped hero bar, more card-to-chart spacing, and both chart legends replaced by a toolbar above the chart.

## Commits

- c13ff1df: Task 1 (cards)
- 596aad43: Task 2 (charts)

## What changed

- `EpicRisk.chip` replaced by `short` (<= 16 chars, substring of `text`); late text is now "Finishes N days late".
- Finish card no longer shows the ConfidenceMeter; the tooltip keeps it plus the reason note.
- Risks card: 2 visible labels (icon + short text) and a `+N` overflow control. Each is one button composed with `TooltipTrigger render={<PopoverTrigger/>}`; tooltip is controlled and closed while the popover is open.
- Hero bar `h-2 w-3/4 max-w-40`; chart block `pt-3`.
- `ChartToolbar` (h-6, justify-end) holds `SourceFlag` + `ZoomPresets`; legend rows, `LegendItem`, `ForecastLegend` removed; navigator `mt-2`, `NAVIGATOR_HEIGHT` 56.

## Intentional test changes

Task 1: Finish "date, range and confidence" test (renamed, absence assertions); averaged Finish Count/SP test (meter assertions -> absence); Finish confidence-meter tooltip test (renamed, card meter -> absence, nowrap check moved to the range span); risk popover test (`textContent` '3d' -> 'Overdue 3 days', a direct consequence of the chip -> short change); lib tests (chip -> short, late text).
Task 2: hero/panels test (legend assertion -> absent); legend lists test; Time legend test; shared Forecast test; state-text-in-legend test; presets-outside-legend test; legend-markers test (rewritten as no-visible-meter); EpicChartTooltip.test ForecastLegend describe removed.

## Deviations from Plan

1. Toolbar spacing uses `mb-2` on the toolbar instead of `gap-2` on the chart block, so the status/assignee blocks below keep their existing spacing.
2. Section skeleton chart slot grew by the toolbar height + 8px and gained the same `pt-3` wrapper, to avoid a skeleton-to-chart jump.
3. Risk overflow test uses a 3-risk fixture (overdue, unestimated, unassigned) rather than 4.
4. Task 1 risk popover test change (3d -> Overdue 3 days) was not in the plan's list but follows directly from D-2.

## Self-Check: PASSED
