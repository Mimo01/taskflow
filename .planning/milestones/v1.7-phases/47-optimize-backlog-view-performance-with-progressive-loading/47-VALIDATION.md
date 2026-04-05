---
phase: 47
slug: optimize-backlog-view-performance-with-progressive-loading
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-31
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + Testing Library React 16.x |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx src/services/jira/backlog.test.ts` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx src/services/jira/backlog.test.ts`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 01 | 1 | D-04/D-05 | unit | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ✅ — needs mock update | ⬜ pending |
| 47-01-02 | 01 | 1 | D-01/D-03 | unit | `npx vitest run src/services/jira/backlog.test.ts` | ✅ — needs new test | ⬜ pending |
| 47-02-01 | 02 | 2 | LOAD-04 | unit | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ❌ W0 | ⬜ pending |
| 47-02-02 | 02 | 2 | D-01/D-02 | unit | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ✅ — needs mock update | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update all `BacklogPage.test.tsx` mocks: replace `fetchBacklogView` mock with `fetchSprintStories` + `fetchSprintList` + `fetchBacklogIssues` mocks
- [ ] New test case: per-row Skeleton appears when `epicsLoading=true` and issue has epic key (LOAD-04)
- [ ] New test case: no Skeleton when `epicsLoading=true` and issue has NO epic key
- [ ] New test case: div-based row renders correctly (no `<tr>` in DOM)
- [ ] New test for `fetchSprintList` in `backlog.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smooth scrolling with 500+ issues | D-04/D-06 | Browser rendering perf not testable in jsdom | Open backlog with large board, scroll rapidly, verify no jank |
| Progressive section rendering visible | D-01 | Visual timing requires real network latency | Throttle network in devtools, verify sections appear independently |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
