---
phase: 12
slug: backlog-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + @testing-library/react + @testing-library/jest-dom |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-W0-01 | W0 | 0 | BACK-01..05 | unit stub | `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ❌ W0 | ⬜ pending |
| 12-01-01 | 01 | 1 | BACK-01 | unit | `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | BACK-01 | unit | same | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | BACK-01 | unit | same | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | BACK-02 | unit | same | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | BACK-02 | unit | same | ❌ W0 | ⬜ pending |
| 12-02-03 | 02 | 2 | BACK-02 | unit | same | ❌ W0 | ⬜ pending |
| 12-02-04 | 02 | 2 | BACK-02 | unit | same | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | BACK-03 | unit | same | ❌ W0 | ⬜ pending |
| 12-04-01 | 04 | 2 | BACK-04 | unit | same | ❌ W0 | ⬜ pending |
| 12-04-02 | 04 | 2 | BACK-04 | unit | same | ❌ W0 | ⬜ pending |
| 12-04-03 | 04 | 2 | BACK-04 | unit | same | ❌ W0 | ⬜ pending |
| 12-04-04 | 04 | 2 | BACK-04 | unit | same | ❌ W0 | ⬜ pending |
| 12-05-01 | 05 | 2 | BACK-05 | unit | same | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/dashboard/BacklogPage.test.tsx` — stubs for BACK-01..05 (all requirements)

*Mock pattern mirrors SprintBoardTab.test.tsx:*
- `vi.mock('@/services/jira', ...)` — mock `fetchBacklogIssues`, `addIssuesToSprint`, `fetchActiveSprint`
- `vi.mock('@/services/stronghold', ...)` — mock `readSecret`
- `vi.mock('@/stores/auth.store', ...)` — mock `useAuthStore`
- `vi.mock('@/stores/settings.store', ...)` — mock `useSettingsStore` with all four field keys
- `vi.mock('react-router-dom', ...)` — mock `useOutletContext` with `{ onIssueClick: vi.fn(), openCreateStory: vi.fn() }`
- `vi.mock('lucide-react', ...)` — avoid SVG rendering issues

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| futureSprints() JQL works on Orange instance | BACK-01 | Runtime API validation required | Open Backlog tab on Orange instance; confirm no 400 errors in console; verify backlog excludes future sprint issues |
| Move-to-sprint reflects in Jira UI | BACK-02 | Live API mutation | Select 1+ issues, click Move to Sprint, verify in Jira that issues are now in active sprint |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
