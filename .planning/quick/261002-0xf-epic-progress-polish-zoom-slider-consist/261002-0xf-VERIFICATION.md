---
phase: quick-261002-0xf
verified: 2026-10-02T00:00:00Z
status: human_needed
score: 9/9 must-haves verified (automated)
human_verification:
  - test: "Drag each thumb and the selection (pan) at All / 6M / 2W on a long epic in Tauri; double-click resets; keyboard thumbs"
    expected: "Smooth drag, chart re-renders locally, commit on release, min span 7 days, no thumb jump"
    why_human: "Pointer pan has no jsdom coverage (zero geometry); drag feel is visual"
  - test: "Pan a 30-day window and watch axis ticks"
    expected: "Ticks stay put on calendar boundaries; year shown when range crosses years"
    why_human: "Visual stability"
  - test: "Compare the four top cards in 480px peek and the main pane across Count / SP / Time and loading / empty states"
    expected: "Identical 72px cards, 2x2 below 672px container, 4-across above"
    why_human: "Container-query layout is not computed in jsdom"
  - test: "Hover tooltips and risk popovers; empty SP state button; Time source flag"
    expected: "Concise tooltips, chips <= 4, Switch to Count works, chart slot height unchanged"
    why_human: "Visual / real-app behaviour"
---

# Quick 261002-0xf Verification

**Goal:** Epic progress polish (date navigator replacing zoom, fixed top cards, concise tooltips, decluttered risks, UI-review P1/P2 polish).
**Re-verification:** No.

## Automated results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS (clean) |
| vitest: epic-progress, issue-detail/*, IssueDetailContent, duration (16 files) | PASS, 419 passed, 2 skipped |
| `biome check` on the 19 changed files (via xargs) | PASS, no diagnostics |
| Debt markers (TODO/FIXME/XXX/TBD) in the changed Epic* files and lib | none found |
| Leftover `Brush`, `axisTicks`, `rangeIndexes`, `CFD_MAX_DAILY` in code | none (only doc comments mention the old Brush) |

## Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Two-thumb date navigator, no recharts Brush | VERIFIED | EpicRangeNavigator.tsx uses base-ui Slider.Root (largeStep 7, minStepsBetweenValues = ZOOM_MIN_SPAN_DAYS, collision none); Indicator pan handle and double-click reset; both charts import it |
| 2 | Daily history, window thinned | VERIFIED | `viewSample` and `useChartView` in EpicChartZoom (VIEW_MAX_POINTS) used by the charts; lib range-matrix tests pass |
| 3 | Calendar ticks, year on year change | VERIFIED | Both charts call `timeTicks(range.from, range.to, width)`; unit-tested |
| 4 | Local drag, commit on release, no remount | VERIFIED (code and tests) | `useLiveRange`, onLive/onCommit; the section test "sliders not remounted on data change" passes. Pointer feel is a human item |
| 5 | Zoom only when the domain is > 28 days, adaptive presets, reset per epic, kept across tabs | VERIFIED | ZOOM_MIN_DAYS = 28, ZOOM_MIN_SPAN_DAYS = 7, `zoomEnabled` uses `> ZOOM_MIN_DAYS`; section state keyed by epicKey, reset on epic change; `rebaseRange` used; tests pass |
| 6 | Four fixed 72px cards in a container-query grid, matching skeleton | VERIFIED (code) | STAT_CARD_CLASS `h-[72px]` with 3 fixed rows; STAT_GRID_CLASS `grid-cols-2 @2xl/epic:grid-cols-4`; applied in Summary and in the skeleton in Section; contract tests pass. Visual check pending |
| 7 | Tooltips <= 4 rows and <= 1 note of <= 8 words | VERIFIED | Budget tests for hero/Finish/Remaining/assignee/chart datum pass |
| 8 | Risks tab-independent, chips <= 4, no Finish duplication | VERIFIED | `deriveRisks` called without a metric; overdue has `issues: []`; risk-identical-across-tabs tests pass |
| 9 | Equal Y-axis widths, empty-estimate state, Time source flag | VERIFIED | Both YAxes use `Y_AXIS_WIDTH`; "Switch to Count" in Section; `sourceNote` wired to the hero; height-equality test passes |

## Gaps

None. No FAILED truths.

## Notes

- Pointer pan is not covered by a jsdom test; only the lib `panDeltaDays`/`panRange` are unit tested. Routed to human verification.
- The chart jumps when the skeleton is replaced by the zoomable chart; this was accepted in the plan.
- Running `npx biome check` with an unquoted `$FILES` variable does not split in zsh and reports "0 files"; use xargs.
