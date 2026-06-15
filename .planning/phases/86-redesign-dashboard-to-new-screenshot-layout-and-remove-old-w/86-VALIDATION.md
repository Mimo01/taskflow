---
phase: 86
slug: redesign-dashboard-to-new-screenshot-layout-and-remove-old-w
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 86 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `taskflow/vite.config.ts` (vitest config embedded) |
| **Quick run command** | `npm run test -- src/routes/dashboard/` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds (full suite); ~5s (dashboard dir) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- src/routes/dashboard/`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green AND `npm run check` GREEN (biome + tsc — no unreferenced exports)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Seeded from RESEARCH §Validation Architecture. The planner refines Task IDs/waves to match the final PLAN.md task breakdown.

| Behavior | Decision | Test Type | Automated Command | File | Status |
|----------|----------|-----------|-------------------|------|--------|
| `toDo + inProgress + done === total` (statusCategory bucketing sums to total) | D-03 | unit | `npm run test -- dashboardMetrics` | `dashboardMetrics.test.ts` (add cases) | ⬜ pending |
| Personal `!subtask` filter buckets only my active-sprint issues | D-02/D-04 | unit/render | `npm run test -- MyIssuesCard` | `MyIssuesCard.test.tsx` (new) | ⬜ pending |
| 0 issues → empty state (not error) | D-05 | render | `npm run test -- MyIssuesCard` | `MyIssuesCard.test.tsx` (new) | ⬜ pending |
| <3 releases → render only existing dots; no due date excluded | D-06/D-08 | render | `npm run test -- UpcomingReleasesTimeline` | `UpcomingReleasesTimeline.test.tsx` (new) | ⬜ pending |
| `donePct` readiness + "Tomorrow" (daysUntil===1) label | D-07/D-08 | unit/render | `npm run test -- UpcomingReleasesTimeline` | `UpcomingReleasesTimeline.test.tsx` (new) | ⬜ pending |
| All-zero week → flat bars with "0h"/"0" labels, NOT empty state | D-12 | unit/render | `npm run test -- HoursCommitsChart` | `HoursCommitsChart.test.tsx` (new) | ⬜ pending |
| Rolling-7-day local-date bucketing (no UTC shift) | D-09/D-11 | unit | `npm run test -- HoursCommitsChart` | `HoursCommitsChart.test.tsx` (new) | ⬜ pending |
| No active sprint → no sprint clause in hero subline | D-13 | render | `npm run test -- dashboard/index` | `index.test.tsx` (rewrite) | ⬜ pending |
| Deleted widgets do not exist on disk + index.tsx imports none of them | REMOVE / D-01 | fs/source | `npm run test -- widget-removal.guard` | `widget-removal.guard.test.ts` (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routes/dashboard/MyIssuesCard.test.tsx` — covers D-02/D-03/D-04/D-05
- [ ] `src/routes/dashboard/UpcomingReleasesTimeline.test.tsx` — covers D-06/D-07/D-08
- [ ] `src/routes/dashboard/HoursCommitsChart.test.tsx` — covers D-09/D-10/D-11/D-12
- [ ] `src/routes/dashboard/dashboardMetrics.test.ts` — extend for D-03 sum-to-total invariant; prune cases for removed helpers
- [ ] Extend `src/routes/dashboard/widget-removal.guard.test.ts` — file-absence assertions per deleted file + one import-absence assertion on `index.tsx`

*Vitest infrastructure already exists — no framework install needed. New test files are scaffolded as part of the relevant plan waves.*

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Chart renders correctly in real Tauri WebKit (dual-axis grouped bars, today pill, dashed gridline at max, explicit-height no 0×0 collapse) | D-10/D-14 | Recharts + WebKit rendering cannot be asserted in jsdom; `foreignObject` today-pill tick is WebKit-compat-sensitive | Launch app, open Dashboard, confirm: blue hours bars (left axis) + green commits bars (right axis) side-by-side per day; today highlighted (pill + stroke); 0-value days flat with "0h"/"0" labels; dashed line at max hours |
| Visual match to approved screenshots (hero, MY ISSUES segmented bar, 3-dot timeline) | UI-SPEC | Pixel/layout fidelity is visual | Compare rendered dashboard against the two source screenshots referenced in DESIGN-INTENT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
