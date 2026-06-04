---
phase: 79
slug: drag-to-transition-on-sprint-board
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-04
audited: 2026-06-04
---

# Phase 79 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react 16.x + jsdom |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/services/jira/greenhopper/transitions.test.ts src/routes/dashboard/sprintBoardDragHelpers.test.ts` |
| **Full suite command** | `cd taskflow && npm test` |
| **Estimated runtime** | ~5s quick · full suite ~60s |

---

## Sampling Rate

- **After every task commit:** Run quick command (helper + adapter tests; < 5s)
- **After every plan wave:** Run `cd taskflow && npm test` + `npm run check` (biome + tsc)
- **Before `/gsd-verify-work`:** Full suite green AND both manual UAT steps signed off
- **Max feedback latency:** ~5 seconds (quick), ~60 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (D-08 adapter) | 01 | 1 | TRAN-03 | T-79-01 | Transitions sourced from server workflow envelope only | unit | `npx vitest run src/services/jira/greenhopper/transitions.test.ts` | ✅ 24 tests | ✅ green |
| (dropModel build) | 02 | 2 | TRAN-02 | — | N/A | unit | `npx vitest run src/routes/dashboard/sprintBoardDragHelpers.test.ts` | ✅ 14 tests | ✅ green |
| (transition filter) | 02 | 2 | TRAN-03 | T-79-02 ⚠️reversed | D-07 reversed: all reachable transitions are valid targets; screened/validated transitions KEPT, rejected move rolls back with inline error (no silent snap-back) | unit | same helper test | ✅ asserts kept | ✅ green |
| (drop resolution) | 02 | 2 | TRAN-01 | — | N/A | unit | same helper test | ✅ covered | ✅ green |
| (optimistic rollback) | 03 | 3 | TRAN-04 | — | Failed transition rolls back, no privilege change | unit (component) | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ 16 tests | ✅ green |
| (success refresh) | 03 | 3 | TRAN-05 | — | N/A | unit (component) | same SprintBoardTab test | ✅ covered | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders — the planner assigns concrete `{NN-NN-NN}` IDs; rows map to the requirement/seam, not final numbering.*
*T-79-02 threat was reversed by the D-07 override (user-confirmed 2026-06-04); the helper test now asserts screened/validated transitions are KEPT as drop targets. The "no silent snap-back" guarantee is met by the rollback + inline-error path (TRAN-04). See 79-VERIFICATION.md override block.*

---

## Wave 0 Requirements

- [x] `src/routes/dashboard/sprintBoardDragHelpers.ts` + `sprintBoardDragHelpers.test.ts` — pure drop-logic seam covering TRAN-01/02/03 (`buildDropModel`, `filterDroppableTransitions`, `resolveDropTransitionId`) — 14 tests green
- [x] Extend `src/services/jira/greenhopper/transitions.test.ts` — assert D-08 `hasScreen`/`hasValidators` round-trip (fixture already carries the fields) — 24 tests green
- [x] Extend `src/routes/dashboard/SprintBoardTab.test.tsx` — optimistic rollback (TRAN-04) + invalidate-on-success (TRAN-05) — 16 tests green
- [x] Framework install: none — vitest + RTL already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full pointer drag gesture across columns | TRAN-01 | jsdom cannot drive a real dnd-kit pointer drag | Drag a card across columns; confirm split zones appear at drag start, hover highlight tracks, drop fires the correct transition, dimmed/invalid columns reject and snap back silently |
| Windows / Tauri WebView2 mouseup-loss | D-13 | Platform-specific (cannot reproduce in jsdom/CI) | On Windows + Tauri WebView2, drag a card and release with the pointer near/over the window edge; confirm the drag completes and the ghost detaches (no stranded ghost). Repeat with a fast flick. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (new `sprintBoardDragHelpers` seam)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (audited 2026-06-04)

---

## Validation Audit 2026-06-04

State A — existing VALIDATION.md audited against implemented artifacts. All three planned test files exist and run green (54/54): `transitions.test.ts` (24), `sprintBoardDragHelpers.test.ts` (14), `SprintBoardTab.test.tsx` (16). Every TRAN requirement maps to a passing automated test; no MISSING or PARTIAL gaps found. The T-79-02 threat row was inverted by the user-confirmed D-07 override — the helper test now asserts screened/validated transitions are kept, and the "no silent snap-back" guarantee is carried by the TRAN-04 rollback + inline-error path.

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Auditor not spawned — zero gaps to fill.
