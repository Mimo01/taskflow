---
phase: 85
slug: sprint-insights-conditional-probe-gated
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-15
audited: 2026-06-15
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
| Tail-first ordering — last 6 closed sprints selected, never first page (Probe A ascending landmine) | 0/1 | INSIGHT-01 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "tail-first ordering"` | ✅ | ✅ green |
| `!subtask` SP-sum filter — parent(5)+2 subtasks(2ea)=5, not 9 | 0/1 | INSIGHT-01 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "subtask exclusion"` | ✅ | ✅ green |
| Personal displayName filter — other users' SP excluded | 0/1 | INSIGHT-01 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "excludes other users"` | ✅ | ✅ green |
| `<3 qualifying sprints` guard — chart hidden + explanatory message | 0/1 | INSIGHT-01 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "qualifying sprints filter"` | ✅ | ✅ green |
| "committed" = sum all my issues; "completed" = sum my DONE issues | 0/1 | INSIGHT-01 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "committed vs completed"` | ✅ | ✅ green |
| `parseBurndownChanges` — ascending-timestamp series; live `timeC` shape + malformed `.changes` defended (`?? {}`, clamp ≥0, non-finite keys filtered) | 0/1 | INSIGHT-02 | V5 Input Validation | Type-safe parse of external GreenHopper data; null/negative clamps | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "parseBurndownChanges"` | ✅ | ✅ green |
| Burndown Y-axis formatter emits hours (`h` suffix), never SP (Probe C `timeestimate` unit) | 0/1 | INSIGHT-02 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "burndown hours suffix"` | ✅ | ✅ green |
| Ideal guideline anchors at peak scope → 0 at endTime, held FLAT across weekends (UAT-4d) | 0/1 | INSIGHT-02 | — | N/A | unit | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts -t "buildIdealGuideline"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/routes/dashboard/dashboardMetrics.ts` — pure functions `computePersonalVelocitySeries(sprints, issueMap, displayName, spKey)`, `parseBurndownChanges(changes, startTs, endTs?)` and `buildIdealGuideline(peak, startTs, endTs?)` (no DOM; jsdom-testable)
- [x] `src/routes/dashboard/dashboardMetrics.test.ts` — `describe('computePersonalVelocitySeries')` covers Tests 1–5 (tail ordering, subtask exclusion, personal filter, qualifying-sprints guard, committed-vs-completed)
- [x] `src/routes/dashboard/dashboardMetrics.test.ts` — `describe('parseBurndownChanges')` covers ascending series + sprint-start anchor + non-negative clamp + live `timeC` shape + pre-start fold-in + null input
- [x] Hours-axis tick formatter — `describe('formatHoursMinutes — burndown hours suffix')` asserts `h`/`m` suffix, never `SP`
- [x] `describe('buildIdealGuideline')` — peak→0 anchor, weekend-flat ideal, empty-window guard (added during UAT-4d)

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-15 — all 8 contract behaviors COVERED & green (51/51 in `dashboardMetrics.test.ts`)

---

## Validation Audit 2026-06-15

State A audit reconciling the pre-execution draft against the implemented test suite. No gaps — every contract behavior already has a passing automated test; the auditor agent was not needed.

| Metric | Count |
|--------|-------|
| Behaviors in contract | 8 |
| COVERED (green) | 8 |
| PARTIAL | 0 |
| MISSING | 0 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Notes:
- Draft `-t` filters were corrected to match actual test names.
- `buildIdealGuideline` behavior (weekend-flat ideal) was added to the contract — it landed during UAT-4d and carries 3 dedicated tests.
- Suite: `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts` → 51 passed (Phase 85 owns 16 of these across velocity, burndown, ideal, and hours-formatter blocks).
- Manual-only items unchanged — they require live Tauri WebKit + induced endpoint failure and remain covered by Phase 85 Human UAT (closed 2026-06-15, UAT-5 accepted-skipped).
