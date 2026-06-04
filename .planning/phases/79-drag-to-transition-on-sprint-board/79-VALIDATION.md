---
phase: 79
slug: drag-to-transition-on-sprint-board
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
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
| (D-08 adapter) | 01 | 1 | TRAN-03 | T-79-01 | Transitions sourced from server workflow envelope only | unit | `npx vitest run src/services/jira/greenhopper/transitions.test.ts` | ✅ extend | ⬜ pending |
| (dropModel build) | 02 | 2 | TRAN-02 | — | N/A | unit | `npx vitest run src/routes/dashboard/sprintBoardDragHelpers.test.ts` | ❌ W0 | ⬜ pending |
| (transition filter) | 02 | 2 | TRAN-03 | T-79-02 | Screen/validator transitions excluded from drop targets | unit | same helper test | ❌ W0 | ⬜ pending |
| (drop resolution) | 02 | 2 | TRAN-01 | — | N/A | unit | same helper test | ❌ W0 | ⬜ pending |
| (optimistic rollback) | 03 | 3 | TRAN-04 | — | Failed transition rolls back, no privilege change | unit (component) | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ extend | ⬜ pending |
| (success refresh) | 03 | 3 | TRAN-05 | — | N/A | unit (component) | same SprintBoardTab test | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders — the planner assigns concrete `{NN-NN-NN}` IDs; rows map to the requirement/seam, not final numbering.*

---

## Wave 0 Requirements

- [ ] `src/routes/dashboard/sprintBoardDragHelpers.ts` + `sprintBoardDragHelpers.test.ts` — pure drop-logic seam covering TRAN-01/02/03 (`buildDropModel`, `filterDroppableTransitions`, `resolveDropTransitionId`)
- [ ] Extend `src/services/jira/greenhopper/transitions.test.ts` — assert D-08 `hasScreen`/`hasValidators` round-trip (fixture already carries the fields)
- [ ] Extend `src/routes/dashboard/SprintBoardTab.test.tsx` — optimistic rollback (TRAN-04) + invalidate-on-success (TRAN-05)
- [ ] Framework install: none — vitest + RTL already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full pointer drag gesture across columns | TRAN-01 | jsdom cannot drive a real dnd-kit pointer drag | Drag a card across columns; confirm split zones appear at drag start, hover highlight tracks, drop fires the correct transition, dimmed/invalid columns reject and snap back silently |
| Windows / Tauri WebView2 mouseup-loss | D-13 | Platform-specific (cannot reproduce in jsdom/CI) | On Windows + Tauri WebView2, drag a card and release with the pointer near/over the window edge; confirm the drag completes and the ghost detaches (no stranded ghost). Repeat with a fast flick. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (new `sprintBoardDragHelpers` seam)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
