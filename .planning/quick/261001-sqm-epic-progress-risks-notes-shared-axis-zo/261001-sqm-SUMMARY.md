---
phase: quick-261001-sqm
plan: 01
subsystem: epic-progress
tags: [epic-progress, recharts, popover, zoom, confidence]
key-files:
  created:
    - taskflow/src/routes/dashboard/issue-detail/ConfidenceMeter.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx
  modified:
    - taskflow/src/lib/epic-progress.ts
    - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
    - taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx
    - taskflow/src/components/ui/tooltip-body.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
completed: 2026-10-01
---

# Quick 261001-sqm: Epic progress risks, notes, shared axis, zoom, confidence, Time colours

One-liner: clickable-key Risks popover, one hero "Data sources" block, a shared chart x-domain with a lifted Brush + preset zoom, a ConfidenceMeter with a lib-derived reason, and status-coloured Time series.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | b6f1fe83 | shared chart axis/domain, zoom presets, confidence reason, data-source lines |
| 2 | 68a784fb | data sources in hero tooltip, confidence meter, clickable risk keys |
| 3 | 7a8f51ef | shared chart domain, brush + preset zoom, status-coloured time series |

Each commit passed the full pre-commit hook (biome, tsc, full vitest: 3098 passed at the end).

## Intentional existing-test changes

1. `epic-progress.test.ts` "caps issue keys at 3 and orders warnings first": renamed "lists every issue key (UI shows the first few) and orders warnings first"; `issueKeys` is the full 5 keys, the `moreKeys` assertion is removed (also checker item 4).
2. `deriveTimeBurnup` "a log before creation starts the story at the log day": renamed "a log before the shared axis start is counted on the first day"; `pts[0].date` is `2026-09-30`, `pts[0].logged === H`.
3. No other deriveTimeBurnup test needed changing.
4. EpicProgressSection "renders all panels": `epic-cfd-note` asserted absent.
5. "keeps the chart wrapper in every history state, with the matching data source" (renamed): `epic-cfd-note` text assertions became `epic-source-flag` aria-labels for pending / rejected / partial; real asserts no flag plus a `tooltip-source` row "From Jira status history" after hovering the hero.
6. "Finish shows a date, range and confidence for an ok forecast" and the qvu averaged-Finish test: `'medium confidence'` replaced by a `confidence-meter` with `data-level='medium'` and tile text containing 'Medium'.
7. qvu averaged-Finish test: the 'Excludes weekends (holidays unavailable)' assertion now runs after hovering `epic-hero`.
8. "opening Risks lists one row per risk with the affected issue keys" (renamed): `hover` -> `click`; asserts the A-4 key button(s). `getAllByRole` is used because A-4 appears under both Unestimated and Unassigned.
9. EpicChartTooltip.test marker test: CFD Remaining row is `status-line` with the indeterminate background; Time markers `['status-area','status-line','status-line']` with backgrounds [new, done, indeterminate] (replaces the data-tone array assertion).
10. Not needed: the 'adds Likely / Earliest / Latest rows' test passes unchanged (it finds rows by label).
11. Not needed: no assertions on chart height 220 or `'dataMin'` existed.

Checker item 1: the Risks-tile hover test (~1285) passes unchanged (openOnHover opens the popover; row icons stay neutral `icon` markers).

## Deviations

- **[Checker item 3] rangeIndexes semantics**: implemented as the checker specified (from -> LAST index with date <= from, to -> FIRST index with date >= to), not the plan's text (first >= from / last <= to). start < end is guaranteed for len >= 2, including from == to.
- **[Checker item 3] Brush resync**: `ChartZoom` gained an `epoch` field (bumped only by preset clicks) used as the Brush `key`. A range-derived key would remount the Brush mid-drag. Brush `onChange` ignores indices equal to the current ones, so a resync never clears the preset.
- **[Checker item 2] Null domain**: `visibleRange()` falls back to the data's first/last date when there is no shared zoom state, so the XAxis stays numeric. Presets and Brush are hidden in that case; the Brush is also hidden for < 3 points or a single-day domain. No `'dataMin'` remains.
- **Chart height**: `CHART_HEIGHT = 252` lives in EpicChartZoom.tsx and is shared (also used for the Time loading/error min-height).
- Plan item 4 test names: the "hover" test for Risks (8) was changed to click per plan; click opens reliably (verified with `findAllByRole`).

## Known limits / pending UAT (real Tauri app, light and dark)

- Brush rendering/dragging cannot be exercised in jsdom (ResponsiveContainer has no size); only the wrapper `data-x-from/to` and preset behaviour are unit-tested.
- Verify: Brush handles drag and the strip is neutral; the status-coloured Time series are legible; the CFD Remaining line (2px indeterminate) is distinguishable from the in-progress area edge; Risks popover keys open issues; hover-then-click on the Risks tile does not flicker.

## Self-Check: PASSED

Created files exist (ConfidenceMeter.tsx, EpicChartZoom.tsx); commits b6f1fe83, 68a784fb, 7a8f51ef present.
