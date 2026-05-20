---
phase: 60
slug: static-dashboard-welcome-screen
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Testing Library React |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose src/routes/dashboard/DashboardSprintCard.test.tsx src/routes/dashboard/DashboardInProgressCard.test.tsx src/routes/dashboard/DashboardReleaseCard.test.tsx` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

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
| 60-W0-01 | W0 | 0 | DASH-02 | — | N/A | unit stub | `cd taskflow && npx vitest run src/routes/dashboard/DashboardSprintCard.test.tsx` | ❌ W0 | ⬜ pending |
| 60-W0-02 | W0 | 0 | DASH-03 | — | N/A | unit stub | `cd taskflow && npx vitest run src/routes/dashboard/DashboardInProgressCard.test.tsx` | ❌ W0 | ⬜ pending |
| 60-W0-03 | W0 | 0 | DASH-04 | — | N/A | unit stub | `cd taskflow && npx vitest run src/routes/dashboard/DashboardReleaseCard.test.tsx` | ❌ W0 | ⬜ pending |
| 60-01-01 | 01 | 1 | DASH-01 | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardSprintCard.test.tsx` | ❌ W0 | ⬜ pending |
| 60-01-02 | 01 | 1 | DASH-02 | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardSprintCard.test.tsx` | ❌ W0 | ⬜ pending |
| 60-02-01 | 02 | 1 | DASH-03 | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardInProgressCard.test.tsx` | ❌ W0 | ⬜ pending |
| 60-03-01 | 03 | 1 | DASH-04 | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardReleaseCard.test.tsx` | ❌ W0 | ⬜ pending |
| 60-04-01 | 04 | 2 | DASH-01, DASH-05 | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/dashboard/DashboardSprintCard.test.tsx` — stubs for DASH-02
- [ ] `taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx` — stubs for DASH-03
- [ ] `taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx` — stubs for DASH-04

*All test files need Wave 0 creation before implementation tasks begin.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No drag handles, no widget picker, no resize grips visible in DOM | DASH-05 | Visual/structural inspection | Open dashboard, inspect DOM for `.drag-handle`, `[data-drag]`, widget-picker, resize-grip elements — none should be present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
