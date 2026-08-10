---
phase: 83
slug: dashboard-stat-tiles-and-sprint-health-chart
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-15
audited: 2026-06-15
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

| Behavior | Requirement | Test Type | Test File | Automated Command | Status |
|----------|-------------|-----------|-----------|-------------------|--------|
| SP-done excludes subtasks (parent 5 + 2×2 ⇒ 5) | DASH-02 (crit 2) | unit | `dashboardMetrics.test.ts` | `npm run test -- dashboardMetrics` | ✅ green |
| SP-total excludes subtasks | DASH-02 (crit 2) | unit | `dashboardMetrics.test.ts` | `npm run test -- dashboardMetrics` | ✅ green |
| Open / In Progress / Overdue tile counts | DASH-02 | unit | `dashboardMetrics.test.ts` | `npm run test -- dashboardMetrics` | ✅ green |
| `getDaysRemaining` | DASH-03 | unit | `dashboardMetrics.test.ts` | `npm run test -- dashboardMetrics` | ✅ green |
| Donut data (zero-SP excluded, CSS-var fills) | DASH-03 | unit | `dashboardMetrics.test.ts` | `npm run test -- dashboardMetrics` | ✅ green |
| StatTile static display (`role="region"`, no click) | DASH-02 | component | `StatTile.test.tsx` | `npm run test -- StatTile` | ✅ green |
| SprintHealthSection render (warm-cache key, donut) | DASH-03 | component | `SprintHealthSection.test.tsx` | `npm run test -- SprintHealthSection` | ✅ green |
| Dashboard composition (hero, tiles, sections) | DASH-01/02/03 | component | `index.test.tsx` | `npm run test -- "dashboard/index"` | ✅ green |
| Section independent degradation (skeleton/error) | DASH-07 | component | `index.test.tsx`, `SprintHealthSection.test.tsx` | `npm run test -- "dashboard/index"` | ✅ green |
| Widget removal guard (3 old cards not imported) | DASH-01 | unit | `widget-removal.guard.test.ts` | `npm run test -- widget-removal` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Audited 2026-06-15: 65/65 tests passing across 5 files (dashboardMetrics 22, StatTile 11, SprintHealthSection 10, dashboard/index 12, widget-removal 10).*

---

## Wave 0 Requirements

- [x] `src/routes/dashboard/dashboardMetrics.ts` — pure derivation functions (no React deps): `computeSpDone`, `computeSpTotal`, tile counts, `getDaysRemaining`, donut-data builder
- [x] `src/routes/dashboard/dashboardMetrics.test.ts` — subtask-exclusion (parent 5 + 2×2 subtasks ⇒ 5, not 9), tile counts, donut data, getDaysRemaining
- [x] `src/routes/dashboard/widget-removal.guard.test.ts` — asserts `SmokeTestChart`, `DashboardSprintCard`, `DashboardInProgressCard` are not imported in `index.tsx`
- [x] Vitest 4.x already installed — no framework install required

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zero new API calls on Dashboard load | DASH-03 (crit 3) | Network behavior depends on warm TanStack cache state across routes; hard to assert deterministically in jsdom | Open Network tab (or Tauri devtools), navigate to Dashboard from a route that warmed the sprint-board + active-sprint caches, confirm no new `/sprint`/`/search` requests fire. Verify the warm-cache read uses `enabled:false` (or prefetch + `enabled:false`), not an unconditional fetch. |
| Donut/status CSS-var colors render correctly per theme | DASH-03 (crit 3) | Visual; OKLCH var resolution across light/dark themes | Visually confirm To Do/In Progress/Done segments use `var(--chart-1..3)`; no hardcoded hex in segment fills (grep the component) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (audited 2026-06-15)

---

## Validation Audit 2026-06-15

| Metric | Count |
|--------|-------|
| Requirements audited | 4 (DASH-01/02/03/07) |
| Gaps found | 0 |
| Resolved | 0 (already covered) |
| Escalated | 0 |
| Automated tests | 65 across 5 files (all green) |
| Manual-only | 2 (zero-new-API-calls determinism; OKLCH theme colors) |

State A audit: VALIDATION.md was a stale planning-time draft. All Phase 83 tests were authored during execution and verified green in 83-VERIFICATION.md. No gaps to fill; no auditor spawn or test generation needed. Updated statuses to reflect the live green state.
