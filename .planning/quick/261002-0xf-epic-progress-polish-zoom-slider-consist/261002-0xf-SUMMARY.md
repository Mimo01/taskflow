---
phase: quick-261002-0xf
plan: 01
subsystem: epic-progress
tags: [zoom, navigator, tooltips, stat-cards, risks]
requires: [261002-0et]
provides:
  - date range navigator (base-ui Slider) replacing the recharts Brush in both epic charts
  - daily history with visible-window sampling and calendar-aligned ticks
  - fixed 72px stat cards, concise tooltips, tab-independent risks
key-files:
  created:
    - taskflow/src/routes/dashboard/issue-detail/EpicRangeNavigator.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicRangeNavigator.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicStatCard.tsx
  modified:
    - taskflow/src/lib/epic-progress.ts
    - taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
decisions:
  - "R1 unestimated = no SP and no time estimate (CONTEXT over UI-REVIEW union)"
  - "R2 data sources: one note of at most 8 words from at most 2 tokens"
  - "R3 Stalled/Scope dropped when they duplicate Finish; Stalled suppresses Scope (chips <= 4)"
  - "R4 task split: lib zoom model (T1), cards/tooltips/risks (T2), navigator/charts (T3)"
metrics:
  tasks: 3
  commits: 3
---

# Quick 261002-0xf: Epic progress polish (zoom navigator, cards, tooltips, risks)

Three commits: 147a749c (Task 1), a7aac0a6 (Task 2), 9f05dd5e (Task 3).

## Task 1 (147a749c, executor)

Pure zoom/data lib work. Daily `historyDates`; `viewSample` (every ceil(n/(max-1))-th row, keeps
first/last, one neighbour each side and `keep` dates); `timeTicks` / `formatMonthYear` /
`formatDateRange`; `ZOOM_MIN_SPAN_DAYS` 7 and `ZOOM_MIN_DAYS` 28; `spanDays` / `rangeToOffsets` /
`offsetsToRange` / `panRange` / `rebaseRange` / `panDeltaDays`; `clampRange` with minSpan; '6m'
preset with `PRESET_SHORT_MAX_DAYS` 90 and `PRESET_MEDIUM_MAX_DAYS` 240; range-matrix tests A to H.
Intentional test changes are listed in that commit. No deviations.

## Task 2 (a7aac0a6, finished by the orchestrator)

The executor was interrupted by a usage limit and two stream stalls; the orchestrator finished it.
EpicStatCard plus a container-query grid; concise tooltips; `sourceNote`; tab-independent risks
(neither-rule; stalled/scope only when not duplicating Finish; overdue without issues, which
supersedes 261002-0et WR-01); empty-estimate state with Switch to Count; Time source flag; story
mini-bar Over-by; `formatDurationCompact` (additive, only epic-progress consumers). About 30
intentional EpicProgressSection.test changes per plan, plus new contract tests (card shape across
tabs/states, skeleton cards, tooltip budget for hero/Finish/Remaining/assignee, risks identical
across tabs). The chart-tooltip budget was deferred to Task 3. Deviation: the "1 unestimated" /
"2 unassigned" tests now query chips by accessible name because chips show short tokens.

## Task 3 (9f05dd5e)

- `EpicRangeNavigator`: base-ui Slider (two thumbs 'Range start' / 'Range end', date
  aria-valuetext, step 1 day, largeStep 7, minStepsBetweenValues 7, collision 'none') over a
  neutral sparkline (`sparklinePath`, linear in time, null gaps skipped). The Indicator is the pan
  handle: pointer pan uses total delta from the start via the lib `panDeltaDays` + `panRange`;
  double-click resets to All. Caption "Aug 14 – Nov 27 (105 d)" with domain edge month labels.
- `EpicChartZoom`: Brush/epoch/brushUsable removed; `PLOT_HEIGHT` 232, `NAVIGATOR_HEIGHT` 48,
  `CHART_HEIGHT`, `Y_AXIS_WIDTH` 40, `zoomUsable`, one `chartHeight(zoom)` helper used by the chart
  wrapper, Time loading/error states and the section's empty-estimate block (no jump when
  switching tab/state), `useElementWidth`, `useLiveRange` (drag-local range, one rAF per move,
  commit cancels the pending frame), `useChartView` (memoised viewSample + 160-point overview).
  Selected preset is `bg-accent font-medium`.
- Charts render viewSample'd daily data with `timeTicks`; the Time derivation is memoised ahead of
  the early returns. Both YAxes use `Y_AXIS_WIDTH`. Legend: `Forecast: Oct 14`.
- Tooltip: year only when it differs from today's; key-date label merged into the title
  ('Oct 14 · Likely finish'); Confidence and key-date rows removed; Forecast row future-only;
  note 'Latest falls after Nov 29'.
- Section zoom state is `{epicKey, preset, range, domainTo}`; resets when the epic changes,
  persists across Count/SP/Time, and a custom range pinned to the domain end follows a grown domain
  (`rebaseRange`). `axisTicks` / `rangeIndexes` removed with their tests.

### Intentional test changes (Task 3)

- epic-progress.test: removed 'axisTicks are day-aligned...', 'rangeIndexes maps...',
  'rangeIndexes keeps start < end...' (functions deleted); describe titles renamed.
- EpicChartTooltip.test: history title now 'Sep 15' (with `today`); clipped note text; key-date
  describe now asserts the merged title and no key-date rows; ForecastLegend text no longer says
  'nothing left'; Confidence test now asserts no Confidence row.
- EpicProgressSection.test: no existing expectation needed changing (CHART_HEIGHT is imported and
  its value now includes the navigator).
- New: EpicRangeNavigator.test (sparklinePath, sliders/names/valuetext/caption, +-1/7/7 day keys,
  keyboard move reports onLive then onCommit, every committed range spans >= 7 days, double-click
  reset); section tests (keyboard move shifts range / unpresses / survives Time tab; reset on epic
  change; sliders not remounted on data change; no navigator for short domains; empty-estimate
  height equals chart height); tooltip budget tests (history datum <= 4 rows, no note; future datum
  <= 4 rows, note <= 8 words; history datum on today's date has no Forecast row).

## Deviations from Plan

None in production code. Notes:
- `useChartView` (shared hook for view/overview sampling) was added to EpicChartZoom instead of
  duplicating two `useMemo` blocks with biome-ignore comments in each chart.
- The chart still jumps when the section skeleton (domain unknown) is replaced by the zoomable
  chart; accepted, as the plan states.
- Pointer pan is not covered by a jsdom test (zero geometry); `panDeltaDays` / `panRange` are unit
  tested in the lib.

## UAT items (Tauri)

Drag each thumb and the selection at All/6M/2W on a long epic; double-click reset; keyboard thumbs;
ticks stable while panning; four cards equal in the 480px peek and main pane across Count/SP/Time;
tooltip lengths; risk chips and popovers; empty SP state button.

## Verification

Full vitest (205 files, 3162 tests) via the pre-commit hook, `tsc --noEmit` and
`biome check` on touched files clean.

## Self-Check: PASSED
