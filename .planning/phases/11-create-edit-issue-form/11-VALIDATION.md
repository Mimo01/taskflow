---
phase: 11
slug: create-edit-issue-form
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-14
updated: 2026-03-15
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| **Config file** | `/taskflow/vitest.config.ts` |
| **Quick run command** | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx src/services/jira.test.ts` |
| **Full suite command** | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx src/services/jira.test.ts`
- **After every plan wave:** Run `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-W0-01 | 01 | 0 | CREATE-01,02,03,04 | unit | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ✅ | ✅ green |
| 11-W0-02 | 01 | 0 | CREATE-01,02,03,04 | unit | `npx vitest run src/services/jira.test.ts` | ✅ | ✅ green |
| 11-01-01 | 01 | 1 | CREATE-01 | unit | `npx vitest run src/services/jira.test.ts` | ✅ | ✅ green |
| 11-01-02 | 01 | 1 | CREATE-01 | unit | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ✅ | ✅ green |
| 11-02-01 | 02 | 1 | CREATE-02 | unit | `npx vitest run src/services/jira.test.ts` | ✅ | ✅ green |
| 11-02-02 | 02 | 1 | CREATE-02 | unit | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ✅ | ✅ green |
| 11-03-01 | 03 | 2 | CREATE-03 | unit | `npx vitest run src/services/jira.test.ts` | ✅ | ✅ green |
| 11-03-02 | 03 | 2 | CREATE-03 | unit | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ✅ | ✅ green |
| 11-04-01 | 04 | 2 | CREATE-04 | unit | `npx vitest run src/services/jira.test.ts` | ✅ | ✅ green |
| 11-04-02 | 04 | 2 | CREATE-04 | unit | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/routes/dashboard/CreateEditIssueModal.test.tsx` — behavioral tests for CREATE-01, CREATE-02, CREATE-03, CREATE-04 component behavior (8 tests, all green)
- [x] Extend `src/services/jira.test.ts` — tests for fetchCreatemeta, bulkUpdateIssue, fetchIssueLinkTypes, createIssueLink, extended createIssue (13 tests, all green)

*No new framework install needed — Vitest + @testing-library/react already present.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Create Issue modal opens from sidebar button | CREATE-01 | Requires rendered Electron app with sidebar visible | Click "Create Issue" in sidebar; verify modal opens centered |
| Custom Account field appears from createmeta | CREATE-02 | Requires live Orange Jira instance | Open create form; verify Account field appears after skeleton resolves |
| Edit modal pre-fills from real issue data | CREATE-03 | Requires live Jira issue | Open any issue → click Edit; verify summary/description/fields pre-filled |
| Issue links created after save | CREATE-04 | Requires real issue creation | Create issue with a link; verify link appears in new issue detail view |

---

## Nyquist Gap Closure (2026-03-15)

The following gaps were filled by the Nyquist auditor:

| Gap | Old Status | New Status | Tests Added |
|-----|-----------|------------|-------------|
| CREATE-01 component tests (3 stubs) | `it.todo()` | ✅ green | renders type switcher; Subtask shows Parent/hides Epic Link; Story shows Epic Link/hides Parent |
| CREATE-02 component test (1 stub) | `it.todo()` | ✅ green | submit disabled when required custom field empty |
| CREATE-03 component test (1 stub) | `it.todo()` | ✅ green | edit mode pre-fills summary + assignee + Save button |

Service-layer tests (jira.test.ts) were already green for all CREATE-01..04 behaviors.

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all requirements
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** nyquist-auditor 2026-03-15
