---
phase: 9
slug: custom-field-discovery-issue-detail-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react 16.x |
| **Config file** | `taskflow/vitest.config.ts` (jsdom environment, globals: true) |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=dot` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=dot`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 0 | ISSUE-01 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx` | ❌ W0 | ⬜ pending |
| 9-01-02 | 01 | 0 | ISSUE-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/WikiRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 9-01-03 | 01 | 0 | ISSUE-03 | unit | `cd taskflow && npx vitest run src/services/jira.test.ts -t "fetchIssueDetail"` | ❌ W0 | ⬜ pending |
| 9-01-04 | 01 | 0 | ISSUE-03 | unit | `cd taskflow && npx vitest run src/services/jira.test.ts -t "discoverCustomFields"` | ❌ W0 | ⬜ pending |
| 9-02-01 | 02 | 1 | ISSUE-01 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx` | ❌ W0 | ⬜ pending |
| 9-02-02 | 02 | 1 | ISSUE-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/WikiRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 9-02-03 | 02 | 1 | ISSUE-03 | unit | `cd taskflow && npx vitest run src/services/jira.test.ts -t "fetchIssueDetail"` | ❌ W0 | ⬜ pending |
| 9-03-01 | 03 | 1 | ISSUE-04 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "optimistic"` | ❌ W0 | ⬜ pending |
| 9-03-02 | 03 | 1 | ISSUE-05 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "subtask"` | ❌ W0 | ⬜ pending |
| 9-03-03 | 03 | 1 | ISSUE-06 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "linked"` | ❌ W0 | ⬜ pending |
| 9-04-01 | 04 | 2 | ISSUE-07 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "comments"` | ❌ W0 | ⬜ pending |
| 9-04-02 | 04 | 2 | ISSUE-08 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "post comment"` | ❌ W0 | ⬜ pending |
| 9-04-03 | 04 | 2 | ISSUE-09 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "open in jira"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx` — stubs for ISSUE-01, ISSUE-04, ISSUE-05, ISSUE-06, ISSUE-07, ISSUE-08, ISSUE-09
- [ ] `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` — stubs for ISSUE-02
- [ ] New tests in `taskflow/src/services/jira.test.ts` for `fetchIssueDetail` and `discoverCustomFields` — covers ISSUE-03
- [ ] Package install: `npm install jira2md react-markdown remark-gfm @tailwindcss/typography` — required before WikiRenderer can be tested
- [ ] shadcn Sheet install: `cd taskflow && npx shadcn@latest add sheet` — required before IssueDetailSheet tests can render

*All test files are new — Wave 0 must create them before any other wave runs tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sheet opens from sprint board, my tasks, search results, and notifications without leaving screen | ISSUE-01 | Requires live UI interaction across 4 entry points | Click an issue from each of the 4 views; confirm sheet slides in without navigation |
| Wiki markup renders correctly for Orange-instance exotic macros (color, mentions) | ISSUE-02 | Orange-instance macro variants unknown until runtime | Open 3 real issues with rich descriptions; verify no raw markup leaks through |
| Assignee typeahead returns correct users from Orange instance | ISSUE-04 | Requires live Jira connection to test latency and results | Click assignee field; type 2+ characters; verify suggestions appear within 1s |
| "Open in Jira" opens browser tab to correct issue URL | ISSUE-09 | Requires OS-level browser launch (Tauri openUrl) | Click "Open in Jira"; confirm browser tab opens to correct Jira issue |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
