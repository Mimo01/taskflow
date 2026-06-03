---
phase: 77
slug: universal-peek-slideover-and-issue-detail-refinements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 77 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| PEEK-01 | Body click opens peek (peekIssueKey set) | unit | `vitest run src/components/app/PeekPanel.test.tsx` | ❌ W0 | ⬜ pending |
| PEEK-02 | Peek renders full detail for story/subtask/bug/epic | unit | `vitest run src/components/app/PeekPanel.test.tsx` | ❌ W0 | ⬜ pending |
| PEEK-03 | No focus trap, no backdrop; underlying stays clickable | unit/smoke | `vitest run src/components/app/PeekPanel.test.tsx` | ❌ W0 | ⬜ pending |
| PEEK-04 | Body click while peek open swaps key (no remount flash) | unit | `vitest run src/components/app/PeekPanel.test.tsx` | ❌ W0 | ⬜ pending |
| PEEK-05 | Key click navigates full-page, no peek opened | unit | `vitest run src/routes/dashboard/TaskCard.test.tsx` | ❌ W0 | ⬜ pending |
| PEEK-06 | "Open full page" button navigates to `/issue/:key` | unit | `vitest run src/components/app/PeekPanel.test.tsx` | ❌ W0 | ⬜ pending |
| PEEK-07 | Escape + X dismiss peek (peekIssueKey null) | unit | `vitest run src/components/app/PeekPanel.test.tsx` | ❌ W0 | ⬜ pending |
| DETAIL-01 | Parent breadcrumb above title, removed from sidebar | unit | `vitest run src/routes/dashboard/IssueDetailContent.test.tsx` | ❌ W0 | ⬜ pending |
| DETAIL-02 | All clickable detail areas carry `cursor-pointer` | smoke | `vitest run src/routes/dashboard/IssueDetailContent.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/components/app/PeekPanel.test.tsx` — stubs for PEEK-01, PEEK-02, PEEK-03, PEEK-04, PEEK-06, PEEK-07
- [ ] `taskflow/src/routes/dashboard/TaskCard.test.tsx` — stub for PEEK-05 (key click navigates, mock navigate)
- [ ] `taskflow/src/routes/dashboard/IssueDetailContent.test.tsx` — stubs for DETAIL-01, DETAIL-02
- [ ] Confirm `issue.fields.parent` declared on `JiraIssueDetail` in `src/services/jira/types.ts` (Assumption A1) — add type if missing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag divider resizes peek and width persists across app restart | PEEK-03 / D-03 | Requires Tauri Store persistence + real pointer drag | Open peek, drag divider to ~600px, restart app, reopen peek — width is ~600px (clamped 360–720) |
| Underlying view fully scrollable/clickable while peek open | PEEK-03 | Requires real browser layout | Open peek on board; scroll board, drag a card, click another card — all work; peek does not block |
| Route-change closes peek; in-view swap keeps it open | PEEK-04 / D-07 | Requires react-router navigation context | Open peek on board → click sidebar nav (backlog): peek closes. Open peek → click another card same view: peek swaps, stays open |
| In-peek parent/subtask/linked click swaps peek; same click on full page navigates | D-13 | Requires both render contexts live | In peek, click parent link → peek swaps. On `/issue/:key`, click parent link → full-page navigate |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
