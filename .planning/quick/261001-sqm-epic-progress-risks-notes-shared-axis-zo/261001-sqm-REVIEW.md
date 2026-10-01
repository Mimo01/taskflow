---
phase: 261001-sqm
reviewed: 2026-10-01T00:00:00Z
depth: quick
files_reviewed: 11
files_reviewed_list:
  - taskflow/src/components/ui/tooltip-body.tsx
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/issue-detail/ConfidenceMeter.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  - taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx
findings:
  critical: 0
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# Phase 261001-sqm: Code Review Report

**Depth:** quick (grep plus targeted reads; behaviours were reasoned through, not executed)

## Summary

No security issues. Both charts do share one domain: they use the same `chartAxisStart`, `chartDomain` and `padToDomain`, and the XAxis domain comes from the same `zoom.range`. `rangeIndexes` guarantees `start < end` when there are at least two points, and `clampRange` guarantees `from < to`. The main problems are Brush resync when the domain changes, a stale "Forecast" preset, and Risks popover keys that do nothing when `onOpenIssue` is undefined.

## Warnings

### WR-01: Risk keys are live buttons that do nothing when `onOpenIssue` is undefined

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx:304,389-392`
**Issue:** `onOpenIssue` is optional. When it is missing, a key click still closes the popover (`setOpen(false)`) and then calls `onOpenIssue?.()`, which is a no-op. The keys look and focus like actions but do nothing.
**Fix:** Pass `onPick` as `undefined` when there is no handler. Render a non-interactive `<span>` for the key (or `disabled`, with no hover or pointer styles) in that case. Close the popover only when a handler exists.

### WR-02: Brush is not resynced when the shared domain or data changes under a preset

**File:** `EpicChartZoom.tsx:20`, `EpicCfdChart.tsx:247-261`, `EpicTimeBurnup.tsx:246-260`
**Issue:** `epoch` is bumped only on preset clicks. The Brush is keyed on `epoch` and takes `startIndex`/`endIndex` as initial values. The domain depends on `finish`, which changes when worklogs or history load. The chart data also grows (projection, `padToDomain`). The `range` derived from the active preset then moves, but the Brush keeps its old indexes. The XAxis follows `range` while the Brush handles show the old selection, so the two disagree until the next click or tab remount.
**Fix:** Include the domain or data length in the Brush key, for example `key={`${zoom.epoch}:${chartData.length}:${zoom.range.from}:${zoom.range.to}`}`. Only resync when `range` did not originate from a drag. A drag already sets `preset` to null, so the key can include `zoom.preset ?? 'drag'`.

### WR-03: Persisted 'forecast' preset stays pressed after it becomes unavailable

**File:** `EpicProgressSection.tsx:259-262`, `EpicChartZoom.tsx:60`
**Issue:** When `zoom.preset === 'forecast'` and `presetRange` later returns null (forecast gone or finish in the past), the range silently falls back to the full domain. The Forecast button is disabled but still has `aria-pressed=true` and the active style. The state shown is wrong.
**Fix:** Treat an unavailable preset as `'all'` when computing `chartZoom.preset`, for example `const activePreset = zoom.preset && presetRange(...) ? zoom.preset : zoom.preset ? 'all' : null`.

### WR-04: Remaining line uses the same colour as the In progress band (CFD)

**File:** `epic-markers.tsx:48-55`, `EpicCfdChart.tsx` (legend and series)
**Issue:** `SERIES.remaining` is `STATUS_CATEGORY_COLOR.indeterminate`, the same colour as the "In progress" stacked area. The CFD legend shows two identical swatches (In progress and Remaining). A 2px line of the same hue drawn over or against a stacked band of that hue is hard to read, especially in dark mode.
**Fix:** Verify contrast in both themes. If it is poor, add a contrasting stroke or halo (for example a `var(--color-background)` outline), or accept the overload only for the Time chart and keep a neutral line on the CFD.

### WR-05: Popover is hover-opened but keys inside it are only reachable by pointer

**File:** `EpicProgressSummary.tsx:331-336,366-370`
**Issue:** With `openOnHover`, keyboard users open the popover through the trigger. The code does not show that focus then moves into the popover. Tabbing from the trigger may skip the portalled keys. Nothing was verified in a browser, so this is not confirmed.
**Fix:** Check Tab order and Escape handling in a browser or test. If focus does not enter the popover, set `initialFocus` or similar on `PopoverContent` when it opens through the keyboard.

### WR-06: Time-chart source flag is always null, and the flag is title-only

**File:** `EpicProgressSection.tsx:339`, `EpicCfdChart.tsx:118-125`
**Issue:** `sourceFlag={null}` is hard-coded for the Time chart. `SourceFlag` is `role="img"` with only `title` and `aria-label`. It is not focusable, so keyboard and touch users cannot see why a chart is approximate. The full text now lives only in the hero tooltip.
**Fix:** Make the flag a focusable element with a tooltip, or keep a visible short label for approximate states.

## Info

### IN-01: Redundant alias and unused fields

**File:** `EpicChartZoom.tsx:34`, `epic-markers.tsx:51-67`
**Issue:** `brushIndexes = rangeIndexes` is a pure alias. `tone` is retained on the status-coloured series but ignored by the status markers, as the comment admits.
**Fix:** Import `rangeIndexes` directly. Drop `tone` from the status series entries if the type allows it.

### IN-02: Confidence level null renders inconsistently

**File:** `EpicProgressSummary.tsx:220,257`, `EpicChartTooltip.tsx` (Confidence row)
**Issue:** The Finish tile sub falls back with `finish.confidence ?? 'low'`. The tooltip Confidence row passes `finish.confidence` raw, so a null value renders an empty row.
**Fix:** Use the same fallback in the tooltip rows, or hide the row when the level is null.

### IN-03: Magic numbers in the calendar note and Brush

**File:** `epic-progress.ts` (`HOLIDAY_NOTE_LOOKBACK_DAYS = 42`), `EpicChartZoom.tsx:11`
**Issue:** The 42-day look-back is a heuristic. The note "Excludes weekends and N holidays" counts holidays from today minus 42 days to the finish date, while the text suggests a general rule. `CHART_HEIGHT` of 252 is a magic sum (plot plus 20px Brush plus margin).
**Fix:** Derive `CHART_HEIGHT` from a plot-height constant plus `BRUSH_STYLE.height`. Reword the holiday note, for example "N holidays in the window".

---

_Reviewed: 2026-10-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

---

## Disposition (orchestrator)

Fixed in the commit after 3a1a703d.

| ID | Disposition |
|----|-------------|
| WR-01 | Fixed — keys render as plain text without onOpenIssue (test proven to fail pre-fix). Two existing tests now pass onOpenIssue (intentional) |
| WR-02 | Fixed — Brush key = epoch + domain from/to (domain changes only on data load, never mid-drag). Not testable in jsdom |
| WR-03 | Fixed — unavailable Forecast preset is shown/applied as All |
| WR-04 | Not an issue — Remaining legend already uses a `status-line` marker (line), not a square; line-vs-area legibility is a UAT item |
| WR-05 | UAT — hover-open focus behaviour of base-ui Popover needs a real browser |
| WR-06 | Partly — Time chart already renders its own loading skeleton / error + Retry, so no flag is needed there; SourceFlag made focusable |
| IN-01..03 | Not changed |
