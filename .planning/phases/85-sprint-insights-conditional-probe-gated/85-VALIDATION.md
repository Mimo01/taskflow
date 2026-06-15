---
phase: 85
slug: sprint-insights-conditional-probe-gated
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 85 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/dashboard/dashboardMetrics.test.ts --reporter=verbose` |
| **Full suite command** | `cd taskflow && npm test` |
| **Estimated runtime** | ~5 seconds (single file); ~60s full suite |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/routes/dashboard/dashboardMetrics.test.ts --reporter=verbose`
- **After every plan wave:** Run `cd taskflow && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds (quick), ~60 seconds (full)

---

## Per-Task Verification Map

> Pure-function logic lives in `src/routes/dashboard/dashboardMetrics.ts`; all unit tests extend the existing `dashboardMetrics.test.ts` (shared `makeIssue` factory). Task IDs are provisional — the planner assigns final plan/task numbering; the *behaviors* below are the binding contract.

| Behavior | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Tail-first ordering — last 6 closed sprints selected, never first page (Probe A ascending landmine) | 0/1 | INSIGHT-01 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "tail"` | ❌ W0 | ⬜ pending |
| `!subtask` SP-sum filter — parent(5)+2 subtasks(2ea)=5, not 9 | 0/1 | INSIGHT-01 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "subtask exclusion"` | ❌ W0 | ⬜ pending |
| Personal displayName filter — other users' SP excluded | 0/1 | INSIGHT-01 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "personal velocity"` | ❌ W0 | ⬜ pending |
| `<3 qualifying sprints` guard — chart hidden + explanatory message | 0/1 | INSIGHT-01 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "qualifying sprints"` | ❌ W0 | ⬜ pending |
| "committed" = sum all my issues; "completed" = sum my DONE issues | 0/1 | INSIGHT-01 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "committed vs completed"` | ❌ W0 | ⬜ pending |
| `parseBurndownChanges` — ascending-timestamp series; malformed `.changes` defended (`?? {}`, `Math.max(0, …)`) | 0/1 | INSIGHT-02 | V5 Input Validation | Type-safe parse of external GreenHopper data; null/negative clamps | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "parseBurndownChanges"` | ❌ W0 | ⬜ pending |
| Burndown Y-axis formatter emits hours (`h` suffix), never SP (Probe C `timeestimate` unit) | 0/1 | INSIGHT-02 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "burndown hours"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routes/dashboard/dashboardMetrics.ts` — add pure functions `computePersonalVelocitySeries(sprints, issueMap, displayName, spKey)` and `parseBurndownChanges(changes, sprintStartTs)` (no DOM; node/jsdom-testable)
- [ ] `src/routes/dashboard/dashboardMetrics.test.ts` — add `describe('computePersonalVelocitySeries')` covering Tests 1–4 (tail ordering, subtask exclusion, personal filter, qualifying-sprints guard)
- [ ] `src/routes/dashboard/dashboardMetrics.test.ts` — add `describe('parseBurndownChanges')` (Test 5: ascending series + sprint-start anchor + non-negative remaining)
- [ ] Hours-axis tick formatter — unit-test the formatter function (reuse `formatHoursMinutes` from `WeeklyTrendChart.tsx`) asserting `h` suffix, not `SP`

*No new test files or framework install needed — the existing `dashboardMetrics.test.ts` harness + `makeIssue` factory cover all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Independent degradation — one insight section's error never blanks the other or the rest of the Dashboard | INSIGHT-01 + INSIGHT-02 | Requires live Tauri WebKit + induced mid-session endpoint failure; not unit-observable | UAT: load Dashboard with both sections; simulate burndown endpoint failure (e.g. revoke/break the rapid-charts path), confirm velocity chart + all Phase 84 sections still render; repeat inverting which section fails |
| Velocity chart renders correctly in real Tauri WebKit (no 0×0 collapse; bars/colors via `--chart-N`) | INSIGHT-01 | WebKit-specific layout (Phase 81 ChartWrapper guard) only observable in the real runtime | UAT: open Dashboard in built app, confirm velocity bars have height, correct committed/completed encoding, sprint-name X axis |
| Burndown chart renders with hours Y axis + guideline series in real WebKit | INSIGHT-02 | Same WebKit layout + live `.changes`/`workRateData` shape only confirmable against the DC | UAT: open Dashboard, confirm burndown line/area renders, Y axis reads hours, axis/tooltip use `formatHoursMinutes` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
