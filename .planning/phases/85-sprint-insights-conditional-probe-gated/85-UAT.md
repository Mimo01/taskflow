---
status: partial
phase: 85-sprint-insights-conditional-probe-gated
source: [85-01-SUMMARY.md, 85-02-SUMMARY.md, 85-03-SUMMARY.md, 85-04-SUMMARY.md, 85-HUMAN-UAT.md]
started: 2026-06-15
updated: 2026-06-15
---

## Current Test

[testing complete]

## Tests

### 1. Sprint Insights row layout
expected: Two cards (Personal Velocity, Sprint Burndown) render at the bottom of the Dashboard below Activity & Releases, side-by-side on wide screens, degrading independently.
result: pass
note: Both cards render side-by-side; burndown's blank plot did not blank velocity or the Dashboard, confirming independent degradation.

### 2. Velocity chart with real data
expected: Personal Velocity shows committed vs completed SP across the last (up to 6) closed sprints, personal-scoped to your displayName. Fewer than 3 qualifying sprints shows the "not enough data" message (not an error). Grouped bars: faint committed behind, solid completed front.
result: pass

### 3. Burndown Y-axis unit
expected: Sprint Burndown Y-axis is labelled in hours (e.g. 8h), never story points. Tooltip shows Xh Ym remaining.
result: issue
reported: "the Sprint Burndown has no data — blank/empty chart (plot area completely empty); Personal Velocity beside it shows data fine"
severity: major
note: Cannot verify Y-axis unit because the plot is empty. Same root cause as test 4 (burndown extracts zero data points from live .changes).

### 4. Burndown curve + ideal guideline
expected: Remaining-work area reads sensibly against the live .changes timeline; dashed ideal guideline (peak scope → 0 at sprint end) is visible. Validates the MEDIUM-confidence burndown model.
result: issue
reported: "the Sprint Burndown has no data — blank/empty chart (plot area completely empty); Personal Velocity beside it shows data fine"
severity: major
note: Predicted MEDIUM-confidence failure mode (UAT-4): live Jira DC .changes statC field names/unit likely differ from probe assumption, so parseBurndownChanges yields no points.

### 5. Independent error/retry
expected: Forcing a fetch failure shows the affected chart's own error state with a working Retry, while the other chart and the rest of the Dashboard stay functional. Velocity fan-out failure surfaces as error/retry, NOT a misleading "not enough data" (CR-02 regression guard).
result: skipped
reason: User could not easily force a fetch failure during this session. Note: the live blank-burndown case (test 3/4) already demonstrated the affected chart degrading without blanking velocity or the Dashboard — partial evidence for independent degradation.

## Summary

total: 5
passed: 2
issues: 2
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Sprint Burndown plots remaining work (hours) across the sprint timeline against a dashed ideal guideline"
  status: failed
  reason: "User reported: the Sprint Burndown has no data — blank/empty chart (plot area completely empty), while Personal Velocity beside it renders fine"
  severity: major
  test: 4
  root_cause: ""     # Filled by diagnosis — suspect parseBurndownChanges / BurndownChangeEntry field-name or unit mismatch vs live Jira DC .changes shape (MEDIUM-confidence probe assumption)
  artifacts: []      # Filled by diagnosis
  missing: []        # Filled by diagnosis
  debug_session: ""  # Filled by diagnosis
