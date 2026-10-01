---
phase: 261001-rtw
reviewed: 2026-10-01T00:00:00Z
depth: quick
files_reviewed: 10
files_reviewed_list:
  - taskflow/src/components/ui/tooltip-body.tsx
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicBands.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  - taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 261001-rtw: Code Review Report

**Reviewed:** 2026-10-01
**Depth:** quick (targeted read of the diff and the files it touches)
**Status:** issues_found

## Summary

The single-forecast projection is mathematically sound. `projectFinish` overrides `remaining`, and rate = R/n gives 0 at the Finish date for any R. The time and CFD charts both end their history at `today`, so `withProjection` joins correctly. No negative margins remain in the Epic* files (grep clean). `tsc --noEmit` printed nothing. No blockers found. Most findings are legibility and consistency issues.

## Warnings

### WR-01: Finish tile shows a date but the chart silently draws no forecast when chart remaining is 0

**File:** `taskflow/src/lib/epic-progress.ts:1180-1192` (consumers `EpicTimeBurnup.tsx:113-121`, `EpicProgressSection.tsx:262-269`, `EpicCfdChart.tsx:77-92`)
**Issue:** `deriveProjection` returns no points when `remaining <= 0`. The averaged finish can be `ok` (Count or SP still has open items) while the active chart's own remaining is 0. Examples: Time chart with all estimates logged (remaining is clamped with `Math.max(..., 0)`), or SP chart where open stories have 0 SP. `ForecastLegend` then returns `null` for `state === 'ok'` and `hasProjection === false`. The Finish tile shows "Oct 14" while the chart shows no forecast and no explanation. This is the "chart remaining differs from forecast inputs" case.
**Fix:** In `ForecastLegend`, handle the `ok && !hasProjection` branch, e.g. render `Forecast: nothing remaining in this unit`. Alternatively draw a flat zero-height forecast to the Finish date.

### WR-02: Time chart: Estimate area and forecast Range band have identical legend and tooltip glyphs

**File:** `taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx:60-69`, `taskflow/src/components/ui/tooltip-body.tsx:90-99`
**Issue:** Both use `marker: 'band'`, `tone: 'muted'`. `MarkerGlyph` forces `opacity-30`, so the glyphs are pixel-identical even though the chart fills differ (0.08 vs 0.15). Tooltip rows "Estimate" and "Range" cannot be told apart by marker. In the chart, Logged (muted, 2px) and Estimate stroke (muted, 1px) differ only by width. Remaining (foreground) vs Logged (muted) differ only by tone, which is weak in dark mode and for colour-blind users.
**Fix:** Give Estimate a distinct marker, e.g. 'band' with an outline-only variant. Or give Logged a different dash or width than its neighbours. Raise the Estimate fill opacity to ~0.12 so it clears the dark-mode floor; at 0.08 over a dark card, muted-foreground is near invisible, so the 1px stroke carries the series alone.

### WR-03: Nested `role="img"` chips inside `role="img"` trigger

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicBands.tsx:61-65`, used in `EpicProgressSection.tsx:340-352`
**Issue:** The assignee trigger is `role="img"` with a full aria-label. Children of `role="img"` are presentational, so the per-chip `role="img"` and `aria-label` are dropped or ignored by assistive tech. The chips also carry duplicate `data-testid="epic-assignee-chip"` semantics. BandBar spans in the hero button have no accessible text; the caption covers it, but the bar itself is unlabeled.
**Fix:** Remove `role`/`aria-label` from the chips when they are inside the labelled trigger, or make the trigger a plain focusable `div` with `aria-label` and no role. Keep the chip text visible.

### WR-04: Non-status colour remains (`bg-red-500`) and overrun cue lost in tooltip

**File:** `taskflow/src/routes/dashboard/IssueDetailContent.tsx:378-382, 394-401`
**Issue:** The stated rule is that colour is reserved for statuses. The logged bar still uses `bg-red-500` on overrun, while the tooltip's "Logged" row used to turn red on overrun and now uses a neutral icon. Overrun is now signalled only by the bar, with no non-colour cue in the tooltip or aria text.
**Fix:** Either keep this as a documented exception (a warning tone, not a status), or add an "Over estimate by X" tooltip row when `overrun`.

### WR-05: Tooltip percentages can disagree with hero percentage; band rounding sums

**File:** `taskflow/src/lib/epic-progress.ts:841-844` vs `deriveSummary` (`pctDone`, line 819-820)
**Issue:** `deriveSummary` forces `pctDone = 100` when every story is done. `bandPct` computes from `total` and returns 0 for all bands when `total === 0`. For an SP epic where all stories are done but have 0 SP, the hero says 100% (or "—") while the tooltip shows 0%. Independently rounded bands can also sum to 99 or 101.
**Fix:** Use the largest-remainder method, or derive the displayed done % from `summary.pctDone` in `BandBreakdown`. At minimum, special-case `total === 0`.

## Info

### IN-01: Dead exports in `MARKER_ICON`

**File:** `taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx:17-27`
**Issue:** `count`, `sp`, `time`, `person` are unused, and they duplicate `METRIC_ICON`. Only `date`, `fromToday`, `logged`, `estimate` and `remaining` are consumed.
**Fix:** Delete the unused entries.

### IN-02: `formatChip` duplicates `formatMetric` numeric formatting

**File:** `taskflow/src/lib/epic-progress.ts:307-311` vs `:856-860`
**Issue:** The same integer / one-decimal logic is copied.
**Fix:** Extract a shared `formatNumber(n)`.

### IN-03: "1 working days" pluralisation

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx:197` and `EpicProgressSummary.tsx:216-217`
**Issue:** `${r.n} working days` is not singular-aware, while the "From today" row is. A forecast of 1 working day renders "1 working days".
**Fix:** Use the same singular/plural logic as the "From today" row.

### IN-04: Status legend uses round dots while tooltip and chart legend use square swatches

**File:** `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx:318-321`
**Issue:** The status-block legend uses `rounded-full` dots, while `MarkerGlyph` 'status' uses `rounded-[2px]` squares. This is a minor inconsistency in the unified vocabulary. It could reuse `MarkerGlyph`.
**Fix:** Render `<MarkerGlyph marker="status" color={statusCategoryColor(b.cat)} />`.

---

_Reviewed: 2026-10-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

---

## Disposition (orchestrator)

Fixed in the commit after aba787e5; regression tests proven to fail on the pre-fix code.

| ID | Disposition |
|----|-------------|
| WR-01 | Fixed — ForecastLegend shows "Forecast: <likely> · nothing left in this view" when the shared finish is ok but the view has no remaining |
| WR-02 | Fixed — new `area` marker for Estimate; fill 0.15. Logged vs Remaining keep tone + width difference |
| WR-03 | Fixed — row trigger `role="group"` (chips keep role="img" + labels) |
| WR-04 | Fixed — "Over estimate" tooltip row with alert icon; red fill kept as a non-status warning (allowed by CONTEXT) |
| WR-05 | Not changed — hero shows "—" when total is 0; ±1 rounding across bands is cosmetic |
| IN-01 | Fixed — unused MARKER_ICON entries removed |
| IN-02 | Not changed |
| IN-03 | Fixed — singular "working day" |
| IN-04 | Fixed — status legend swatches square |

Intentional test change: EpicChartTooltip time-row markers expect `area` for Estimate (was `band`).
