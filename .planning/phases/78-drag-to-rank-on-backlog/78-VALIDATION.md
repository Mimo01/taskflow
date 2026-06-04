---
phase: 78
slug: drag-to-rank-on-backlog
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-03
validated: 2026-06-04
---

# Phase 78 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `78-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `npm test -- --run src/services/jira/rank.test.ts` |
| **Full suite command** | `npm test` (from `taskflow/`) |
| **Estimated runtime** | ~2s quick (pure fn) · full suite ~minutes |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run src/services/jira/rank.test.ts` (pure unit, fast)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~2s per-task; full suite per wave

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| rank.ts fix | 01 | 1 | RANK-02 | — | LexoRank midpoint always strictly between neighbors | unit | `npm test -- --run src/services/jira/rank.test.ts` | ✅ (12 cases E1–E12) | ✅ green |
| rank API mutation | 02 | 2 | RANK-03 | — | Mutation body carries integer `rankCustomFieldId` from cache, never hardcoded | unit | `npm test -- --run src/services/jira/rank-api.test.ts` | ✅ (5 cases) | ✅ green |
| render in rank order | 03 | 2 | RANK-01 | — | Backlog renders issues in server rank order on load | unit | `npm test -- --run src/routes/dashboard/__tests__/BacklogPage.network.test.tsx` | ✅ existing | ✅ green |
| optimistic rollback | 03 | 2 | RANK-04 | — | Failed mutation rolls back local order + shows inline banner | unit | `npm test -- --run src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` | ✅ (7 cases) | ✅ green |
| flicker mitigation | 03 | 2 | RANK-05 | — | `cancelQueries` in `onMutate`; local order not overwritten while dragging | unit | `npm test -- --run src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` | ✅ (7 cases) | ✅ green |
| drag helpers | 04 | 2 | RANK-02 | — | Container resolution, live-reorder, intra-section rank derivation | unit | `npm test -- --run src/routes/dashboard/__tests__/backlogDragHelpers.test.ts` | ✅ (35 cases) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/services/jira/rank-api.test.ts` — unit test for the rank mutation; asserts body passes integer `rankCustomFieldId` from fixture (not hardcoded) — **5 tests green**
- [x] `src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` — integration test for optimistic mutation behavior (cancelQueries, rollback, error banner) — **7 tests green (RANK-03/04/05)**
- [x] `src/test/package-deps.guard.test.ts` — `@dnd-kit` absence guard removed (grep count 0); four `@dnd-kit` packages installed
- [x] Strengthen `src/services/jira/rank.test.ts` — E1–E12 all assert bucket-aware `rankLt(before, result) && rankLt(result, after)`; E10 (12-char precision), E11 (CR-01 cross-bucket), E12 (repeated midpoint) added — **12 tests green**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag ghost + insertion line visual feedback (D-07) | RANK-02 | dnd-kit pointer drag + `DragOverlay` rendering not reliably exercisable in jsdom | Drag a row in the running app; confirm semi-transparent ghost follows cursor and a primary-colored insertion line marks the drop position |
| No snap-back flicker during background refetch (D-08) | RANK-05 | Requires real refetch timing + pointer drag overlap | Begin a drag, trigger a window-focus refetch mid-drag; confirm list order does not jump |
| ~~Cross-section confirm dialog + sprint-membership move (D-03/D-04)~~ | RANK-02 | **Removed** — cross-section drag was DISABLED per user request (commit `0d8ef8ea`). A cross-section drop is now a no-op; sprint-membership changes are handled via the right-click "Move to Sprint / Move to Backlog" context menu, not drag. No longer a validation target for this phase. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s (quick run: 5 files / 64 tests in ~0.8s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-04 (audit run)

---

## Validation Audit 2026-06-04

| Metric | Count |
|--------|-------|
| Requirements audited | 5 (RANK-01..05) |
| COVERED (green automated) | 5 |
| Gaps found | 0 |
| Resolved | 0 (no gaps — Wave 0 tests already authored during execution) |
| Escalated | 0 |
| Manual-Only (jsdom-structural) | 2 active + 1 removed (cross-section drag disabled) |

**Result:** Phase 78 is **Nyquist-compliant**. All five RANK requirements have green automated verification (64 tests across 5 files). The draft VALIDATION.md predated execution; this audit reconciles it to the executed reality — every Wave 0 test file was authored and passes. The remaining Manual-Only items (pointer-drag visual, focus-refetch flicker) are structurally outside jsdom's reach and tracked in 78-VERIFICATION.md / 78-UAT.md, not coverage gaps.
