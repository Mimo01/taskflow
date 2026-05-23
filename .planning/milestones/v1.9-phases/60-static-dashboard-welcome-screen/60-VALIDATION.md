---
phase: 60
slug: static-dashboard-welcome-screen
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
audited: 2026-05-23
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Testing Library React |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose src/routes/dashboard/DashboardSprintCard.test.tsx src/routes/dashboard/DashboardInProgressCard.test.tsx src/routes/dashboard/DashboardReleaseCard.test.tsx src/routes/dashboard/index.test.tsx` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~1 second for phase-60 files; ~15s for full dashboard suite |

---

## Sampling Rate

- **After every task commit:** Run the specific new test file added in that task
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 60-01-01 | 01 | 1 | DASH-02 (infra) | T-60-SC | shadcn install from `taskflow/` | install | `test -f taskflow/src/components/ui/progress.tsx && grep -q Progress taskflow/src/components/ui/progress.tsx` | ✓ | ✅ green |
| 60-01-02 | 01 | 1 | DASH-02 | — | N/A | unit (TDD red) | `cd taskflow && npx vitest run src/routes/dashboard/DashboardSprintCard.test.tsx` | ✓ | ✅ green |
| 60-01-03 | 01 | 1 | DASH-02 | T-60-01, T-60-02, T-60-03 | XSS-safe JSX; zero-denominator guard | unit (TDD green) | `cd taskflow && npx vitest run src/routes/dashboard/DashboardSprintCard.test.tsx` | ✓ | ✅ green (5 tests) |
| 60-02-01 | 02 | 1 | DASH-03 | — | N/A | unit (TDD red) | `cd taskflow && npx vitest run src/routes/dashboard/DashboardInProgressCard.test.tsx` | ✓ | ✅ green |
| 60-02-02 | 02 | 1 | DASH-03 | T-60-04, T-60-05, T-60-06, T-60-07 | XSS-safe; open-redirect bounded by `/issue/:key` route | unit (TDD green) | `cd taskflow && npx vitest run src/routes/dashboard/DashboardInProgressCard.test.tsx` | ✓ | ✅ green (6 tests) |
| 60-03-01 | 03 | 1 | DASH-04 | — | N/A | unit (TDD red) | `cd taskflow && npx vitest run src/routes/dashboard/DashboardReleaseCard.test.tsx` | ✓ | ✅ green |
| 60-03-02 | 03 | 1 | DASH-04 | T-60-08, T-60-09, T-60-10 | timezone-safe YYYY-MM-DD compare | unit (TDD green) | `cd taskflow && npx vitest run src/routes/dashboard/DashboardReleaseCard.test.tsx` | ✓ | ✅ green (8 tests incl. plan 06) |
| 60-04-01 | 04 | 2 | DASH-01, DASH-05 | — | N/A | unit (TDD red) | `cd taskflow && npx vitest run src/routes/dashboard/index.test.tsx` | ✓ | ✅ green |
| 60-04-02 | 04 | 2 | DASH-01, DASH-05 | T-60-11, T-60-12, T-60-13, T-60-14 | single PAT load; locale pinned; DOM negative-asserts widget controls | unit (TDD green) | `cd taskflow && npx vitest run src/routes/dashboard/index.test.tsx` | ✓ | ✅ green (10 tests) |
| 60-05-01 | 05 | 1 | DASH-03 | T-60-05-01 | callback from trusted Outlet context | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardInProgressCard.test.tsx` | ✓ | ✅ green |
| 60-05-02 | 05 | 1 | DASH-03 | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/index.test.tsx` | ✓ | ✅ green |
| 60-05-03 | 05 | 1 | DASH-03 | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardInProgressCard.test.tsx` | ✓ | ✅ green |
| 60-06-01 | 06 | 1 | DASH-04 | T-60-06-01, T-60-06-02 | JQL via encodeURIComponent; status-only fields | unit | `cd taskflow && npx tsc --noEmit --project taskflow/tsconfig.json` | ✓ | ✅ green |
| 60-06-02 | 06 | 1 | DASH-04 | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardReleaseCard.test.tsx` | ✓ | ✅ green |
| 60-06-03 | 06 | 1 | DASH-04 | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardReleaseCard.test.tsx` | ✓ | ✅ green (8 tests) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Aggregate:** 29 tests across 4 files, 0 failures, ~600ms.

---

## Requirement Coverage Matrix

| Requirement | Covered By | Status |
|-------------|------------|--------|
| DASH-01 (hero with greeting + date) | `index.test.tsx` tests 1-6, 9-10 | ✅ |
| DASH-02 (sprint health card) | `DashboardSprintCard.test.tsx` (5 tests) | ✅ |
| DASH-03 (my in-progress card) | `DashboardInProgressCard.test.tsx` (6 tests, plan 05 onIssueClick) | ✅ |
| DASH-04 (release countdown + progress) | `DashboardReleaseCard.test.tsx` (8 tests incl. plan 06 progress bar) | ✅ |
| DASH-05 (no drag/picker/resize controls) | `index.test.tsx` Test 7 — DOM negative assertions | ✅ (now automated) |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Breadcrumb back-arrow chain after subtask click | DASH-03 (plan 05) | Integration with main.tsx `handleIssueClick` + `breadcrumbStore`; covered structurally by `onIssueClick` unit test but end-to-end navigation requires browser | Navigate to Dashboard, click an in-progress subtask, confirm header shows back-arrow → Dashboard |
| Live release progress bar against real Jira | DASH-04 (plan 06) | Requires a real Jira fix version with tagged issues to validate JQL response shape | Open Dashboard with a project that has an upcoming release; confirm "N% complete · X / Y issues" matches Jira's release view |

*DASH-05 was previously manual-only; now automated via `index.test.tsx` Test 7 (negative DOM assertions on `react-grid-layout`, `react-resizable-handle`, widget-picker, drag-handle markers).*

---

## Validation Sign-Off

- [x] All tasks have automated verify
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covered all MISSING references (TDD-red tests created before impl)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (current: ~600ms)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (2026-05-23)

---

## Validation Audit 2026-05-23

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tests passing | 29 / 29 |
| Doc drift fixed | per-task map (8 → 15 rows incl. plans 05/06); DASH-05 promoted from manual to automated |
