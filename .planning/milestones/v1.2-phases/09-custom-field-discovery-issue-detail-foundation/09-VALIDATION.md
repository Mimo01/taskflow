---
phase: 9
slug: custom-field-discovery-issue-detail-foundation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-13
audited: 2026-03-15
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
| 9-01-01 | 01 | 0 | ISSUE-01 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx` | ✅ | ✅ green |
| 9-01-02 | 01 | 0 | ISSUE-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/WikiRenderer.test.tsx` | ✅ | ✅ green |
| 9-01-03 | 01 | 0 | ISSUE-03 | unit | `cd taskflow && npx vitest run src/services/jira.test.ts -t "fetchIssueDetail"` | ✅ | ✅ green |
| 9-01-04 | 01 | 0 | ISSUE-03 | unit | `cd taskflow && npx vitest run src/services/jira.test.ts -t "discoverCustomFields"` | ✅ | ✅ green |
| 9-02-01 | 02 | 1 | ISSUE-01 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx` | ✅ | ✅ green |
| 9-02-02 | 02 | 1 | ISSUE-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/WikiRenderer.test.tsx` | ✅ | ✅ green |
| 9-02-03 | 02 | 1 | ISSUE-03 | unit | `cd taskflow && npx vitest run src/services/jira.test.ts -t "fetchIssueDetail"` | ✅ | ✅ green |
| 9-03-01 | 03 | 1 | ISSUE-04 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "optimistic"` | ✅ | ✅ green |
| 9-03-02 | 03 | 1 | ISSUE-05 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "subtask"` | ✅ | ✅ green |
| 9-03-03 | 03 | 1 | ISSUE-06 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "linked"` | ✅ | ✅ green |
| 9-04-01 | 04 | 2 | ISSUE-07 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "comments"` | ✅ | ✅ green |
| 9-04-02 | 04 | 2 | ISSUE-08 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "post comment"` | ✅ | ✅ green |
| 9-04-03 | 04 | 2 | ISSUE-09 | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "open in jira"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx` — full behavioral tests for ISSUE-01, ISSUE-04, ISSUE-05, ISSUE-06, ISSUE-07, ISSUE-08, ISSUE-09 (20 tests, all green)
- [x] `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` — full behavioral tests for ISSUE-02 (7 tests, all green)
- [x] New tests in `taskflow/src/services/jira.test.ts` for `fetchIssueDetail` and `discoverCustomFields` — covers ISSUE-03 (8 tests, all green)
- [x] Package install: `npm install jira2md react-markdown remark-gfm @tailwindcss/typography` — installed
- [x] shadcn Sheet install: `cd taskflow && npx shadcn@latest add sheet` — installed at `taskflow/src/components/ui/sheet.tsx`

*Wave 0 complete — all test files exist with passing behavioral tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sheet opens from sprint board, my tasks, search results, and notifications without leaving screen | ISSUE-01 | Requires live UI interaction across 4 entry points | Click an issue from each of the 4 views; confirm sheet slides in without navigation |
| Wiki markup renders correctly for Orange-instance exotic macros (color, mentions) | ISSUE-02 | Orange-instance macro variants unknown until runtime | Open 3 real issues with rich descriptions; verify no raw markup leaks through |
| Assignee typeahead returns correct users from Orange instance | ISSUE-04 | Requires live Jira connection to test latency and results | Click assignee field; type 2+ characters; verify suggestions appear within 1s |
| "Open in Jira" opens browser tab to correct issue URL | ISSUE-09 | Requires OS-level browser launch (Tauri openUrl) | Click "Open in Jira"; confirm browser tab opens to correct Jira issue |

---

## Nyquist Audit Results (2026-03-15)

Audited by gsd-nyquist-auditor. All test files were already present with full behavioral tests (not stubs). No gaps found.

| Requirement | Tests | Result |
|-------------|-------|--------|
| ISSUE-01 | 3 tests: open, closed, onClose | ✅ green |
| ISSUE-02 | 6 tests: bold, italic, code, list, null/undefined, plain text | ✅ green |
| ISSUE-03 | 8 tests: fetchIssueDetail (3) + discoverCustomFields (5) | ✅ green |
| ISSUE-04 | 7 tests: optimistic updates, rollback, invalidation, assignee format | ✅ green |
| ISSUE-05 | 2 tests: render subtasks, click subtask | ✅ green |
| ISSUE-06 | 2 tests: inward links, outward links | ✅ green |
| ISSUE-07 | 3 tests: ordering, author display, wiki render | ✅ green |
| ISSUE-08 | 2 tests: postComment call, clear compose box | ✅ green |
| ISSUE-09 | 1 test: openUrl with correct URL | ✅ green |

Full suite: 367 tests passed across 32 test files.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — all ISSUE-01..09 requirements covered with passing behavioral tests
