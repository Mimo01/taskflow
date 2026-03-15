---
phase: 14
slug: fix-wiring-credential-bugs
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-15
audited: 2026-03-15
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
| 14-01-01 | 01 | 1 | BOARD-04 | unit | `cd taskflow && npx vitest run SprintBoardTab` | ✅ SprintBoardTab.test.tsx (BOARD-04 describe block, 2 tests) | ✅ green |
| 14-02-01 | 02 | 1 | BACK-03 | unit | `cd taskflow && npx vitest run BacklogPage` | ✅ BacklogPage.test.tsx (BACK-03 describe block, 1 test) | ✅ green |
| 14-03-01 | 03 | 1 | EPIC-04 | unit | `cd taskflow && npx vitest run CreateEpicDialog` | ✅ CreateEpicDialog.test.tsx (2 EPIC-04 tests) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` — BOARD-04 test added: `describe('BOARD-04 QuickCreateInput wiring')` with 2 tests (renders 3 "+ Add" buttons; statusId regression). GREEN.
- [x] `taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx` — Mocks updated: `useSettingsStore` provides only `epicNameFieldKey`; `useAuthStore` mock added; `readSecret` mock added. GREEN.

*BacklogPage.test.tsx already had BACK-03 coverage — no Wave 0 gap.*

*Audit run: 2026-03-15 — all 34 targeted tests passed (SprintBoardTab: 12+2=14 incl. BOARD-04 x2, BacklogPage: 16 incl. BACK-03, CreateEpicDialog: 2 incl. EPIC-04 x2).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QuickCreateInput submits issue on live Jira instance | BOARD-04 | Requires real Jira connection | Open sprint board, type in `+ Add` field, verify issue appears |
| Backlog refreshes visibly after create | BACK-03 | Requires real Jira + React Query cache state | Create story from backlog modal, verify list refreshes without page reload |
| Epic created with correct project and auth | EPIC-04 | Requires real Jira credentials in Stronghold | Open epic dialog, submit, verify epic appears in Jira |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — all 34 targeted tests passing (2026-03-15 audit)
