---
phase: 2
slug: developer-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-* | 01 | 1 | DEV-01 | unit | `cd taskflow && npx vitest run src/services/jira.test.ts -t "sprint"` | ❌ W0 | ⬜ pending |
| 02-01-* | 01 | 1 | DEV-03 | unit | `cd taskflow && npx vitest run src/services/gitlab.test.ts -t "MR"` | ❌ W0 | ⬜ pending |
| 02-01-* | 01 | 1 | JACT-01 | unit | `cd taskflow && npx vitest run src/services/jira.test.ts -t "transition"` | ❌ W0 | ⬜ pending |
| 02-01-* | 01 | 1 | JACT-02 | unit | `cd taskflow && npx vitest run src/services/jira.test.ts -t "comment"` | ❌ W0 | ⬜ pending |
| 02-02-* | 02 | 2 | UI-02 | component | `cd taskflow && npx vitest run src/routes/dashboard -t "refreshed"` | ❌ W0 | ⬜ pending |
| 02-02-* | 02 | 2 | UI-03 | component | `cd taskflow && npx vitest run src/routes/dashboard -t "loading\|error"` | ❌ W0 | ⬜ pending |
| 02-02-* | 02 | 2 | DEV-02 | unit | `cd taskflow && npx vitest run src/services/linkEngine.test.ts -t "columns"` | ❌ W0 | ⬜ pending |
| 02-03-* | 03 | 2 | LINK-01 | unit | `cd taskflow && npx vitest run src/services/linkEngine.test.ts -t "regex"` | ❌ W0 | ⬜ pending |
| 02-03-* | 03 | 2 | LINK-02 | unit | `cd taskflow && npx vitest run src/services/linkEngine.test.ts -t "commit"` | ❌ W0 | ⬜ pending |
| 02-03-* | 03 | 2 | LINK-03 | component | `cd taskflow && npx vitest run src/routes/dashboard -t "MR chips"` | ❌ W0 | ⬜ pending |
| 02-03-* | 03 | 2 | LINK-04 | component | `cd taskflow && npx vitest run src/routes/dashboard -t "linked task"` | ❌ W0 | ⬜ pending |
| 02-03-* | 03 | 2 | DEV-04 | unit | `cd taskflow && npx vitest run src/services/linkEngine.test.ts -t "health"` | ❌ W0 | ⬜ pending |
| 02-03-* | 03 | 2 | DEV-05 | unit | `cd taskflow && npx vitest run src/services/linkEngine.test.ts -t "stale"` | ❌ W0 | ⬜ pending |
| 02-04-* | 04 | 3 | JACT-01 | component | `cd taskflow && npx vitest run src/routes/dashboard -t "transition"` | ❌ W0 | ⬜ pending |
| 02-04-* | 04 | 3 | JACT-02 | component | `cd taskflow && npx vitest run src/routes/dashboard -t "comment"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/services/jira.test.ts` — extend existing file: add DEV-01 stubs for `fetchSprintIssues`, JACT-01 stubs for `fetchTransitions`/`postTransition`, JACT-02 stubs for `postComment`
- [ ] `taskflow/src/services/gitlab.test.ts` — extend existing file: add DEV-03 stubs for `fetchAssignedMRs`, `fetchReviewerMRs`, `fetchMRCommits`, `fetchMRApprovals`, `fetchMRDiscussions`
- [ ] `taskflow/src/services/linkEngine.test.ts` — NEW file for LINK-01/02 (regex extraction, commit fallback), DEV-02 (column derivation), DEV-04 (`deriveReviewHealth`), DEV-05 (stale detection)
- [ ] `taskflow/src/routes/dashboard/MyTasksTab.test.tsx` — NEW component test file for LINK-03, JACT-01, JACT-02, UI-02, UI-03
- [ ] `taskflow/src/routes/dashboard/MrAttentionTab.test.tsx` — NEW component test file for LINK-04, DEV-03, DEV-05

*Note: Use `renderWithQuery` helper established in `JiraStep.test.tsx` — copy pattern to dashboard test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sprint board horizontal scroll with many columns | DEV-02 | Requires real browser viewport | Open app with >6 sprint statuses; scroll right to verify columns overflow scrolls |
| Stale MR amber badge visible in UI | DEV-05 | Requires real MR with old `updated_at` | Manually set threshold to 0 days in Settings; verify MR shows orange `Stale•Xd` badge |
| Status popover keyboard navigation | JACT-01 | Accessibility behavior requires real browser | Tab to status badge, press Enter to open popover, arrow-key through options, Enter to select |
| Inline comment expand/collapse animation | JACT-02 | Visual behavior | Click comment icon; verify textarea expands inline without layout shift |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
