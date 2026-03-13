---
phase: 6
slug: workload-sprint-progress-enrichment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx src/routes/dashboard/SprintProgressTab.test.tsx` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx src/routes/dashboard/SprintProgressTab.test.tsx`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | WORK-01 | unit | `cd taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx` | ✅ | ⬜ pending |
| 6-01-02 | 01 | 1 | WORK-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx` | ✅ | ⬜ pending |
| 6-01-03 | 01 | 1 | WORK-03 | unit | `cd taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx` | ✅ | ⬜ pending |
| 6-02-01 | 02 | 2 | SPPG-01 | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintProgressTab.test.tsx` | ✅ | ⬜ pending |
| 6-02-02 | 02 | 2 | SPPG-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintProgressTab.test.tsx` | ✅ | ⬜ pending |
| 6-02-03 | 02 | 2 | SPPG-03 | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintProgressTab.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Both test files exist and use the established `renderWithQuery` + `vi.mock` pattern. The `makeIssue` factory functions in each test file need new fields (`timetracking`, subtask flag set to `true` for subtask fixtures) but the files themselves are present and runnable. No Wave 0 setup needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Time columns hidden when Jira admin has disabled time tracking | WORK-02, SPPG-02 | Requires real Jira instance with time tracking disabled | Connect to Orange Jira instance; open Workload tab; verify Est/Spent/Remaining columns do not appear |
| Expand/collapse animation (if added) | WORK-03 | Visual behavior | Click assignee row toggle; verify stories expand/collapse correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
