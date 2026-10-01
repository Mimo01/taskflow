# Quick 261002-0et Summary: Epic progress, simpler confidence, conditional zoom, simpler risks

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | 1c91e0cc | zoom threshold, visible presets, shorter confidence reasons |
| 2 | 828396d4 | aligned confidence meter, conditional zoom |
| 3 | 30b1eb13 | one-line risks with per-risk issue popover |

Each commit passed the full pre-commit hook (biome, tsc, full vitest: 3111 passed on the last).

## What changed

- Lib: `ZOOM_MIN_DAYS = 42`, `zoomEnabled`, `visiblePresets` (hides presets that do not cut history; returns [] when only "All" would remain, per checker warning 1), `CONFIDENCE_REASON_MAX = 60`, `EpicRisk.issues {key, summary}[]`, short risk texts.
- Confidence: ConfidenceMeter is a fixed h-4 non-wrapping inline-flex; a single Finish confidence row plus one reason line (`confidence-reason`); no meter on per-metric rows; chart tooltip drops the reason and hides the row when confidence is null.
- Zoom: Brush and presets only above 42 days; `PLOT_HEIGHT`/`CHART_HEIGHT`/`chartHeight`; `data-zoomable`; stored zoom resets to All via guarded render-phase setState.
- Risks: one button per risk (`epic-risk-item`) opening a popover (`epic-risk-popover`) with the explanation and scrollable `epic-risk-issues` rows; arrows/Enter/Escape; `initialFocus` on the first row button (checker warning 2).

## Intentional existing-test changes

Task 1: three confidenceReason strings drop "the last ".
Task 2: EpicChartTooltip "future datum" test (reason now absent, renamed); Finish tooltip test (body-text regex replaced by reason-element assertions); Forecast preset test (hidden, not disabled).
Task 3: five deriveRisks lib tests (issues shape, texts, rename, 7-issue rewrite); EpicProgressSection tests for risk chips -> items, overdue text, opening a risk, icon-marker test Risks half, popover click/Enter test, 5-keys test rewritten as scrollable list, WR-01 plain-text test.
New tests: zoom/visiblePresets boundaries, lone-All edge, reason-length test, short/long domain, zoom reset, tooltip null-confidence, popover focus on first row.

## Deviations

- Plan said row accessible name is "A-4 A-4" and to match `/^A-4\b/`. Spans concatenate without a space ("A-4A-4"), so the test matches `/^A-4/` instead. Test-only; no prod change.
- `biome check` reports a pre-existing `noNoninteractiveTabindex` error at EpicCfdChart.tsx:122 (untouched source-flag span); the pre-commit hook did not block on it.

## UAT items

Meter alignment in light and dark; zoom appearance at the 6-week boundary; risk popover keyboard focus in the Tauri webview.

## Self-Check: PASSED
