---
phase: 83
slug: dashboard-stat-tiles-and-sprint-health-chart
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 83 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (jsdom) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `npm run test -- dashboardMetrics` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5–15 seconds (quick); full suite per existing baseline |

Setup file: `taskflow/src/test/setup.ts`.

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- dashboardMetrics` (fast, pure unit tests only)
- **After every plan wave:** Run `npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| W0-stub | 00 | 0 | DASH-02/03 | — | N/A | unit | `npm run test -- dashboardMetrics` | ❌ W0 | ⬜ pending |
| SP-done excl. subtasks | — | — | DASH-02 (crit 2) | — | N/A | unit | `npm run test -- dashboardMetrics` | ❌ W0 | ⬜ pending |
| SP-total excl. subtasks | — | — | DASH-02 (crit 2) | — | N/A | unit | `npm run test -- dashboardMetrics` | ❌ W0 | ⬜ pending |
| Open tile count | — | — | DASH-02 | — | N/A | unit | `npm run test -- dashboardMetrics` | ❌ W0 | ⬜ pending |
| In Progress tile count | — | — | DASH-02 | — | N/A | unit | `npm run test -- dashboardMetrics` | ❌ W0 | ⬜ pending |
| Overdue tile count | — | — | DASH-02 | — | N/A | unit | `npm run test -- dashboardMetrics` | ❌ W0 | ⬜ pending |
| getDaysRemaining | — | — | DASH-03 | — | N/A | unit | `npm run test -- dashboardMetrics` | ❌ W0 | ⬜ pending |
| Donut data (zero-SP excl.) | — | — | DASH-03 | — | N/A | unit | `npm run test -- dashboardMetrics` | ❌ W0 | ⬜ pending |
| SprintHealthSection render | — | — | DASH-03 | — | N/A | component | `npm run test -- SprintHealthSection` | ❌ W0 | ⬜ pending |
| Section independent degradation | — | — | DASH-07 | — | N/A | component | `npm run test -- StatTiles` | ❌ W0 | ⬜ pending |
| Widget removal guard | — | — | DASH-01 | — | N/A | unit | `npm run test -- widget-removal` | ⚠ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs finalized by the planner; this map binds requirements → behaviors → automated commands.*

---

## Wave 0 Requirements

- [ ] `src/routes/dashboard/dashboardMetrics.ts` — pure derivation functions (no React deps): `computeSpDone`, `computeSpTotal`, tile counts, `getDaysRemaining`, donut-data builder
- [ ] `src/routes/dashboard/dashboardMetrics.test.ts` — subtask-exclusion (parent 5 + 2×2 subtasks ⇒ 5, not 9), tile counts, donut data, getDaysRemaining
- [ ] `src/routes/dashboard/widget-removal.guard.test.ts` — extend to assert `SmokeTestChart`, `DashboardSprintCard`, `DashboardInProgressCard` (as standalone cards) are not imported in `index.tsx`
- [ ] Vitest 4.x already installed — no framework install required

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zero new API calls on Dashboard load | DASH-03 (crit 3) | Network behavior depends on warm TanStack cache state across routes; hard to assert deterministically in jsdom | Open Network tab (or Tauri devtools), navigate to Dashboard from a route that warmed the sprint-board + active-sprint caches, confirm no new `/sprint`/`/search` requests fire. Verify the warm-cache read uses `enabled:false` (or prefetch + `enabled:false`), not an unconditional fetch. |
| Donut/status CSS-var colors render correctly per theme | DASH-03 (crit 3) | Visual; OKLCH var resolution across light/dark themes | Visually confirm To Do/In Progress/Done segments use `var(--chart-1..3)`; no hardcoded hex in segment fills (grep the component) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
