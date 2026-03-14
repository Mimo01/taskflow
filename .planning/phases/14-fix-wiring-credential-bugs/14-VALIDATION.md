---
phase: 14
slug: fix-wiring-credential-bugs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom environment) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose 2>&1 \| tail -20` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -10`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green (≥365 passing)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | BOARD-04 | unit | `cd taskflow && npx vitest run SprintBoardTab` | ✅ (needs BOARD-04 test — Wave 0) | ⬜ pending |
| 14-02-01 | 02 | 1 | BACK-03 | unit | `cd taskflow && npx vitest run BacklogPage` | ✅ BacklogPage.test.tsx | ⬜ pending |
| 14-03-01 | 03 | 1 | EPIC-04 | unit | `cd taskflow && npx vitest run CreateEpicDialog` | ✅ (needs mock update — Wave 0) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` — add BOARD-04 test: render SprintBoardTab with data, assert `+ Add` button visible in each column
- [ ] `taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx` — update mocks: replace `useSettingsStore` credential fields with `useAuthStore` + `readSecret` mocks

*BacklogPage.test.tsx already has BACK-03 coverage — no Wave 0 gap.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QuickCreateInput submits issue on live Jira instance | BOARD-04 | Requires real Jira connection | Open sprint board, type in `+ Add` field, verify issue appears |
| Backlog refreshes visibly after create | BACK-03 | Requires real Jira + React Query cache state | Create story from backlog modal, verify list refreshes without page reload |
| Epic created with correct project and auth | EPIC-04 | Requires real Jira credentials in Stronghold | Open epic dialog, submit, verify epic appears in Jira |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
