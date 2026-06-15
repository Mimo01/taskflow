---
status: partial
phase: 85-sprint-insights-conditional-probe-gated
source: [85-VERIFICATION.md]
started: 2026-06-15
updated: 2026-06-15
runtime_verified: "UAT-1..4 confirmed live (board 6708 / sprint 19562); burndown fixed via 4 gap-closure commits. UAT-5 outstanding."
---

## Current Test

[UAT-1..4 verified live; UAT-5 (forced-failure error/retry) still to exercise]

## Context

Phase 85 (Sprint Insights — probe-gated velocity + burndown charts) passed all 5
success criteria in automated verification (5/5), and both code-review blockers
(CR-01 burndown ideal guideline, CR-02 velocity fan-out error handling) are resolved
and committed (f8a3faba). `npm run check` is clean and all 2029 unit tests pass.

The remaining items are **runtime-only** — they require the app pointed at the real
Jira DC instance (`https://jira.corp.sk`, board 6708) because the data shapes
(`.changes` field semantics, SP population on closed sprints) are MEDIUM-confidence
from the probe and cannot be exercised in unit tests.

## Human Verification Items

- [x] **UAT-1 — Sprint Insights row layout.** ✅ Verified — both cards render side-by-side;
      the burndown's blank plot did not blank velocity or the Dashboard (independent degradation).

- [x] **UAT-2 — Velocity chart with real data.** ✅ Verified against live data — grouped
      committed-vs-completed bars, personal-scoped.

- [x] **UAT-3 — Burndown Y-axis unit.** ✅ Verified — hours axis, after the burndown was fixed
      (it was initially blank; same root cause as UAT-4).

- [x] **UAT-4 — Burndown curve + ideal guideline.** ✅ Verified after **4 inline gap-closure
      fixes**, each confirmed against live board 6708 / sprint 19562. The MEDIUM-confidence
      probe assumption was indeed wrong, and three further live-data issues surfaced once the
      curve rendered:
      - `8917b763` (UAT-4)  — live `.changes` uses `timeC{oldEstimate,newEstimate}` (seconds),
        not the assumed `statC{newValue,oldValue}` → parser read zero deltas → flat-zero blank plot.
        Also corrected `statisticField` type (object, not string).
      - `a54ed5e4` (UAT-4b) — `.changes` carries each issue's full estimate history (a year+ of
        pre-sprint edits) → bounded to `[startTime,endTime]`, pre-start folded into the baseline.
      - `d03c5928` (UAT-4c) — anchored at `startTime` (planning) + categorical x-axis (93 day-1
        planning changes hogged half the chart) → anchor at `activatedTime` + time-proportional axis.
      - `3c36b03d` (UAT-4d) — dashed ideal sloped through weekends → dedicated `buildIdealGuideline`,
        a working-day staircase that stays flat across Sat/Sun.

- [ ] **UAT-5 — Independent error/retry.** ⏭️ SKIPPED this session (could not easily force a
      fetch failure). Partial evidence: the live blank-burndown degraded without blanking velocity
      or the Dashboard. Still worth a deliberate forced-failure check (incl. the CR-02 guard that a
      velocity fan-out failure surfaces as error/retry, not "not enough data").

## How to close

UAT-1..4 pass (4 burndown fixes committed & user-verified). Only **UAT-5** (forced-failure
error/retry) remains — exercise it when convenient, then mark this file `status: passed` and
re-run `/gsd-verify-work 85` so the phase flips `human_needed` → `passed`.
