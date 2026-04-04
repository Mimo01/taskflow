---
phase: 48
slug: restore-backlog-progressive-loading
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `npx vitest`) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx` |
| **Full suite command** | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx`
- **After every plan wave:** Run `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 48-01-01 | 01 | 1 | LOAD-01 | unit | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ✅ existing | ⬜ pending |
| 48-01-02 | 01 | 1 | LOAD-05 | unit | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ✅ existing | ⬜ pending |
| 48-01-03 | 01 | 1 | LOAD-04 | unit | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ❌ W0 | ⬜ pending |
| 48-01-04 | 01 | 1 | QOPT-02 | unit | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New test case in `BacklogPage.test.tsx` — covers LOAD-04 (per-row epic Skeleton when allEpics is pending)
- [ ] Updated mock structure in `BacklogPage.test.tsx` — replace `fetchBacklogView` mock with `fetchSprintStories` + `fetchSprintList` + `fetchBacklogIssues` mocks

*Existing infrastructure is otherwise sufficient — no new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Context menu right-click works unchanged | SC-7 | UI interaction | Right-click backlog row → verify all menu items appear and function |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
