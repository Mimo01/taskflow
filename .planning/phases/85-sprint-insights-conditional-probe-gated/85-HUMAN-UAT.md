---
status: partial
phase: 85-sprint-insights-conditional-probe-gated
source: [85-VERIFICATION.md]
started: 2026-06-15
updated: 2026-06-15
---

## Current Test

[awaiting human testing on a live Jira DC instance]

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

- [ ] **UAT-1 — Sprint Insights row layout.** The two cards (Personal Velocity,
      Sprint Burndown) render at the bottom of the Dashboard below the Activity &
      Releases section, side-by-side on wide screens, and degrade independently
      (one erroring does not blank the other or the rest of the Dashboard).

- [ ] **UAT-2 — Velocity chart with real data.** Personal Velocity shows committed
      vs completed story points across the last (up to 6) closed sprints, personal-scoped
      to your displayName. With fewer than 3 qualifying sprints it shows the explanatory
      "not enough data" message (not an error). Grouped bars: faint committed behind,
      solid completed front.

- [ ] **UAT-3 — Burndown Y-axis unit.** Sprint Burndown Y-axis is labelled in **hours**
      (e.g. `8h`), never story points (Probe C: `statisticField = timeestimate`). Tooltip
      shows `Xh Ym` remaining.

- [ ] **UAT-4 — Burndown curve + ideal guideline (validates the MEDIUM-confidence model).**
      The remaining-work area reads sensibly against the live `.changes` timeline and the
      dashed **ideal** guideline (peak scope → 0 at sprint end) is visible. If the curve
      looks wrong against real DC data, the `.changes` `statC` field names / unit may differ
      from the probe assumption — re-run `probe.sh` Probe C and adjust `BurndownChangeEntry`
      + `parseBurndownChanges` together (see 85-02 SUMMARY follow-up note).

- [ ] **UAT-5 — Independent error/retry.** Force a fetch failure (e.g. revoke the PAT or
      block one endpoint) and confirm the affected chart shows its own error state with a
      working Retry, while the other chart and the rest of the Dashboard stay functional.
      The velocity card must surface a per-sprint fan-out failure as an error/retry — NOT
      as a misleading "not enough data" message (CR-02 regression guard).

## How to close

When all items pass, mark this file `status: passed` and re-run phase verification
(or `/gsd-verify-work 85`) so the phase flips from `human_needed` → `passed`.
If UAT-4 surfaces a data-shape mismatch, file a small gap-closure fix for
`parseBurndownChanges` / `BurndownChangeEntry` before closing.
