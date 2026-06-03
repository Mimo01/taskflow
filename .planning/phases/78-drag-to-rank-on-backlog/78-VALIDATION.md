---
phase: 78
slug: drag-to-rank-on-backlog
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
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
| rank.ts fix | 01 | 1 | RANK-02 | — | LexoRank midpoint always strictly between neighbors | unit | `npm test -- --run src/services/jira/rank.test.ts` | ✅ (strengthen) | ⬜ pending |
| rank API mutation | 02 | 2 | RANK-03 | — | Mutation body carries integer `rankCustomFieldId` from cache, never hardcoded | unit | `npm test -- --run src/services/jira/rank-api.test.ts` | ❌ W0 | ⬜ pending |
| render in rank order | 03 | 2 | RANK-01 | — | Backlog renders issues in server rank order on load | unit | `npm test -- --run src/routes/dashboard/__tests__/BacklogPage.network.test.tsx` | ✅ existing | ⬜ pending |
| optimistic rollback | 03 | 2 | RANK-04 | — | Failed mutation rolls back local order + shows inline banner | unit | `npm test -- --run src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` | ❌ W0 | ⬜ pending |
| flicker mitigation | 03 | 2 | RANK-05 | — | `cancelQueries` in `onMutate`; local order not overwritten while dragging | unit | `npm test -- --run src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/jira/rank-api.test.ts` — unit test for the rank mutation; asserts body passes integer `rankCustomFieldId` from fixture (not hardcoded)
- [ ] `src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` — integration test for optimistic mutation behavior (cancelQueries, rollback, error banner)
- [ ] `src/test/package-deps.guard.test.ts` — remove the `@dnd-kit` absence guard describe block (D-12 pre-step), then install the four `@dnd-kit` packages
- [ ] Strengthen `src/services/jira/rank.test.ts` — every case (E1–E9) asserts `rankLt(before, result) && rankLt(result, after)` with bucket-aware `rankLt`; add E10 (12-char precision), E11 (CR-01 cross-bucket), E12 (repeated midpoint)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag ghost + insertion line visual feedback (D-07) | RANK-02 | dnd-kit pointer drag + `DragOverlay` rendering not reliably exercisable in jsdom | Drag a row in the running app; confirm semi-transparent ghost follows cursor and a primary-colored insertion line marks the drop position |
| No snap-back flicker during background refetch (D-08) | RANK-05 | Requires real refetch timing + pointer drag overlap | Begin a drag, trigger a window-focus refetch mid-drag; confirm list order does not jump |
| Cross-section confirm dialog + sprint-membership move (D-03/D-04) | RANK-02 | Full drag-across-sections + dialog + dual API requires live board | Drag a row into a different sprint section; confirm dialog copy, Confirm fires membership + rank, "Keep Position" rolls back |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (quick run)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
