---
status: complete
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
result: pass
note: Initially blank (shared root cause with test 4). Fixed via gap closure — Y-axis now renders hours after the parser reads the live timeC shape.

### 4. Burndown curve + ideal guideline
expected: Remaining-work area reads sensibly against the live .changes timeline; dashed ideal guideline (peak scope → 0 at sprint end) is visible. Validates the MEDIUM-confidence burndown model.
result: pass
note: |
  Initially blank, then surfaced 3 further live-data issues — all fixed inline and user-verified
  against board 6708 / sprint 19562:
  - UAT-4  (8917b763): parser read assumed statC; live shape is timeC{oldEstimate,newEstimate} → flat-zero blank plot.
  - UAT-4b (a54ed5e4): .changes carried a year of pre-sprint history → bounded to sprint window, pre-start folded into baseline.
  - UAT-4c (d03c5928): anchored at startTime (planning) + categorical x-axis → anchor at activatedTime + time-proportional axis.
  - UAT-4d (3c36b03d): ideal guideline sloped through weekends → dedicated buildIdealGuideline, flat Sat/Sun working-day staircase.

### 5. Independent error/retry
expected: Forcing a fetch failure shows the affected chart's own error state with a working Retry, while the other chart and the rest of the Dashboard stay functional. Velocity fan-out failure surfaces as error/retry, NOT a misleading "not enough data" (CR-02 regression guard).
result: skipped
reason: User could not easily force a fetch failure during this session. Note: the live blank-burndown case (test 3/4) already demonstrated the affected chart degrading without blanking velocity or the Dashboard — partial evidence for independent degradation.

## Summary

total: 5
passed: 4
issues: 0
pending: 0
skipped: 1
blocked: 0
note: Tests 3 & 4 initially failed (blank burndown); resolved via 4 inline gap-closure fixes (UAT-4/4b/4c/4d), all user-verified against live board 6708. Test 5 (force-failure error/retry) skipped — not exercised this session.

## Gaps

- truth: "Sprint Burndown plots remaining work (hours) across the sprint timeline against a dashed ideal guideline"
  status: resolved   # fixed inline & user-verified — commits 8917b763, a54ed5e4, d03c5928, 3c36b03d
  reason: "User reported: the Sprint Burndown has no data — blank/empty chart (plot area completely empty), while Personal Velocity beside it renders fine"
  severity: major
  test: 4
  root_cause: "CONFIRMED via live curl (board 6708, sprint 19562). The GreenHopper .changes entries for a timeestimate-statistic burndown carry deltas under `timeC: { oldEstimate, newEstimate, timeSpent }` (seconds), NOT the assumed `statC: { newValue, oldValue }`. parseBurndownChanges only reads entry.statC, which is always undefined → running stays 0 → every BurndownPoint.remaining is 0 → flat-zero area reads as a blank plot. Secondary: GreenHopperBurndown.statisticField is an object {fieldId:'timeestimate',renderer:'duration'}, not the string the type declares (cosmetic — chart never reads it at runtime)."
  artifacts:
    - path: "taskflow/src/routes/dashboard/dashboardMetrics.ts"
      issue: "parseBurndownChanges reads entry.statC.{newValue,oldValue}; live shape uses entry.timeC.{newEstimate,oldEstimate} for a timeestimate statistic. Inline param type (signature) also only declares statC."
    - path: "taskflow/src/services/jira/greenhopper/types.ts"
      issue: "BurndownChangeEntry declares statC but not timeC; statisticField typed as string but live is an object."
    - path: "taskflow/src/routes/dashboard/dashboardMetrics.test.ts"
      issue: "No coverage for the timeC entry shape (regression guard for live DC data)."
  missing:
    - "In parseBurndownChanges, compute delta from timeC.newEstimate - timeC.oldEstimate (fall back to statC.newValue - statC.oldValue so a story-point-statistic board still works)."
    - "Add timeC?: { oldEstimate?: number; newEstimate?: number; timeSpent?: number } to BurndownChangeEntry and the inline param type."
    - "Add a dashboardMetrics.test.ts case asserting a timeC-shaped .changes record produces a rising/non-zero remaining series."
  debug_session: "inline (live curl diagnosis 2026-06-15)"
  live_sample: |
    statisticField = { typeId:'field', fieldId:'timeestimate', name:'Remaining Time Estimate', renderer:'duration' }
    changes['1738108800000'][0] = { key:'ESHOP-13731', timeC:{ oldEstimate:0, newEstimate:0, timeSpent:1800 } }
