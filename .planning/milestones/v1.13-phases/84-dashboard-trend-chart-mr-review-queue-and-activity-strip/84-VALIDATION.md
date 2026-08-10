---
phase: 84
slug: dashboard-trend-chart-mr-review-queue-and-activity-strip
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-15
validated: 2026-06-15
---

# Phase 84 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | taskflow/vitest.config.ts (or vite config test block — planner to confirm path) |
| **Quick run command** | `cd taskflow && npx vitest run <new test file>` |
| **Full suite command** | `cd taskflow && npm run check && npx vitest run` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite + `npm run check` (biome + tsc) must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Test File | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-----------|-------------------|--------|
| trend-bucketing | 84-02 | W0 | DASH-04 | — | N/A | unit | `dashboardMetrics.test.ts` (6 `buildWeekBuckets` tests incl. mandated `'2026-06-14T23:00:00'` ⇒ Friday bucket) | `npx vitest run src/routes/dashboard/dashboardMetrics.test.ts` | ✅ green |
| activity-shared-key | 84-03 | W1 | DASH-05 | — | N/A | unit/integration | `ActivityStrip.test.tsx` (criterion-2 seeded cache reuse: renders w/o queryFn) + `dashboardMetrics.test.ts` (`mergeActivityEntries` order/cap) | `npx vitest run src/routes/dashboard/ActivityStrip.test.tsx src/routes/dashboard/dashboardMetrics.test.ts` | ✅ green |
| mr-queue-grouping | 84-02 | — | DASH-06 | — | N/A | — | *DESCOPED — UAT 2026-06-15, component removed* | n/a | ⛔ descoped |
| independent-degrade | 84-03 | W1 | DASH-07 | — | N/A | component | `ActivityStrip.test.tsx` (jira error + commits succeed → rows still render) + `WeeklyTrendChart.test.tsx` (Tempo-not-connected empty state, not error) | `npx vitest run src/routes/dashboard/ActivityStrip.test.tsx src/routes/dashboard/WeeklyTrendChart.test.tsx` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ⛔ descoped. 42/42 tests pass (validated 2026-06-15). Full cross-section runtime degradation, zero-duplicate-network, and config-gated empty states remain Manual-Only (below).*

---

## Wave 0 Requirements

- [x] Timezone-safe weekly-bucketing helper extracted as a pure, importable function (`buildWeekBuckets` in `dashboardMetrics.ts`) — DASH-04
- [x] Shared-query-key reuse proven via `ActivityStrip.test.tsx` criterion-2 seeded-cache test; byte-identical keys verified in 84-VERIFICATION.md — DASH-05
- [x] MR-grouping — N/A, DASH-06 descoped (component + tests deleted during UAT 2026-06-15)

*If existing test infrastructure (vitest) is already configured, no framework install is needed — only the pure-function seams above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "No duplicate network request when both Standup and Dashboard visited same session" | DASH-05 | Requires live cache + network observation across two route visits | Visit Standup Notes, then Dashboard in the same session; confirm zero new Jira-activity/commits requests fire (DevTools Network / TanStack Query devtools) |
| Independent section degradation — Dashboard never goes fully blank | DASH-07 | Requires simulating per-source failure at runtime | Force one section's query to error; confirm the other sections + tiles still render their own state |
| "Tempo not connected" / "GitLab not connected" empty states | DASH-04, DASH-06 | Config-gated runtime states | Toggle `tempoEnabled` off / unconfigure GitLab; confirm graceful empty states (not errors) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s (3 files run in ~0.9s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-15

---

## Validation Audit 2026-06-15

Retroactive Nyquist audit of the completed phase (State A — existing VALIDATION.md was a pre-execution draft with `TBD` task IDs). Cross-referenced the 3 in-scope requirements against shipped test files; all run green; no auditor spawn needed (no MISSING gaps).

| Metric | Count |
|--------|-------|
| In-scope requirements | 3 (DASH-04, DASH-05, DASH-07) |
| COVERED | 3 |
| MISSING / Escalated | 0 |
| Descoped | 1 (DASH-06) |
| Tests passing | 42/42 |
