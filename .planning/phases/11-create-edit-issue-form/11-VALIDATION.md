---
phase: 11
slug: create-edit-issue-form
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
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
| 11-W0-01 | 01 | 0 | CREATE-01,02,03,04 | unit | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ W0 | ⬜ pending |
| 11-W0-02 | 01 | 0 | CREATE-01,02,03,04 | unit | `npx vitest run src/services/jira.test.ts` | ✅ extend | ⬜ pending |
| 11-01-01 | 01 | 1 | CREATE-01 | unit | `npx vitest run src/services/jira.test.ts` | ✅ extend | ⬜ pending |
| 11-01-02 | 01 | 1 | CREATE-01 | unit | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | CREATE-02 | unit | `npx vitest run src/services/jira.test.ts` | ✅ extend | ⬜ pending |
| 11-02-02 | 02 | 1 | CREATE-02 | unit | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | CREATE-03 | unit | `npx vitest run src/services/jira.test.ts` | ✅ extend | ⬜ pending |
| 11-03-02 | 03 | 2 | CREATE-03 | unit | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ W0 | ⬜ pending |
| 11-04-01 | 04 | 2 | CREATE-04 | unit | `npx vitest run src/services/jira.test.ts` | ✅ extend | ⬜ pending |
| 11-04-02 | 04 | 2 | CREATE-04 | unit | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routes/dashboard/CreateEditIssueModal.test.tsx` — stubs for CREATE-01, CREATE-02, CREATE-03, CREATE-04 component behavior
- [ ] Extend `src/services/jira.test.ts` — stubs for fetchCreatemeta, bulkUpdateIssue, fetchIssueLinkTypes, createIssueLink

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

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
