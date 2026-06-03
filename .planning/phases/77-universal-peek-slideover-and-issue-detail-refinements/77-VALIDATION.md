---
phase: 77
slug: universal-peek-slideover-and-issue-detail-refinements
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-03
validated: 2026-06-03
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
| PEEK-01 | Body click opens peek (onOpenIssue called with key) | unit | `vitest run src/routes/dashboard/TaskCard.test.tsx` | ✅ | ✅ green |
| PEEK-02 | Peek renders full detail for story/subtask/bug/epic | unit / manual | `vitest run src/components/app/PeekPanel.test.tsx` | ✅ | ✅ green (live render → manual) |
| PEEK-03 | No focus trap, no backdrop (queryByRole dialog null) | unit | `vitest run src/components/app/PeekPanel.test.tsx` | ✅ | ✅ green (runtime layout → manual) |
| PEEK-04 | Swap key updates header (no remount flash) | unit | `vitest run src/components/app/PeekPanel.test.tsx` | ✅ | ✅ green |
| PEEK-05 | Key click navigates full-page, no peek opened | unit | `vitest run src/routes/dashboard/TaskCard.test.tsx` | ✅ | ✅ green |
| PEEK-06 | "Open full page" button calls onNavigateFull | unit | `vitest run src/components/app/PeekPanel.test.tsx` | ✅ | ✅ green |
| PEEK-07 | Escape + X dismiss peek (onClose called) | unit | `vitest run src/components/app/PeekPanel.test.tsx` | ✅ | ✅ green |
| DETAIL-01 | Parent breadcrumb above title, removed from sidebar | unit | `vitest run src/routes/dashboard/IssueDetailContent.test.tsx` | ✅ | ✅ green |
| DETAIL-02 | Subtask rows carry `cursor-pointer` | unit | `vitest run src/routes/dashboard/IssueDetailContent.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `taskflow/src/components/app/PeekPanel.test.tsx` — 7 real `it()` cases (PEEK-02/03/04/06/07) ✅ green
- [x] `taskflow/src/routes/dashboard/TaskCard.test.tsx` — PEEK-01 (body click) + PEEK-05 (key click) ✅ green
- [x] `taskflow/src/routes/dashboard/IssueDetailContent.test.tsx` — DETAIL-01, DETAIL-02 (3 cases) ✅ green
- [x] `issue.fields.parent` confirmed on `JiraIssueDetail` (Assumption A1 resolved — breadcrumb renders from it)

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

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-03 — all 9 requirements have green automated tests; runtime-only aspects (CSS squeeze, Tauri persistence, cmdk event model) are documented Manual-Only and confirmed by UAT (7/7 passed).

---

## Validation Audit 2026-06-03

| Metric | Count |
|--------|-------|
| Requirements | 9 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated (manual-only) | 4 |

**Result:** NYQUIST-COMPLIANT. All 9 requirements carry automated coverage across 3 test files (15 `it()` cases, all green: `PeekPanel.test.tsx` 7, `TaskCard.test.tsx` 6, `IssueDetailContent.test.tsx` 3). The VALIDATION.md was authored pre-execution as Wave-0 stubs; this audit reconciled it to the executed state — no new tests required. Manual-Only items are inherent runtime/visual checks already cleared by UAT.
