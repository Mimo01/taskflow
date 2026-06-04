---
phase: 79-drag-to-transition-on-sprint-board
plan: 02
subsystem: sprint-board
tags: [dnd, tdd, pure-helpers, transitions, typescript]

# Dependency graph
requires:
  - plan: 79-01
    provides: "JiraTransition.hasScreen? and JiraTransition.hasValidators? (D-08)"
provides:
  - "sprintBoardDragHelpers.ts: filterDroppableTransitions, buildDropModel, resolveDropTransitionId"
  - "Unit-tested pure drop-model seam (jsdom-assertable, no React/dnd-kit imports)"
  - "D-07 regression-guarded: hasScreen/hasValidators transitions excluded from drop targets"
affects:
  - 79-drag-to-transition-on-sprint-board (plan 03 — DndContext wiring reads DropModel and calls resolveDropTransitionId)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sprintBoardDragHelpers pattern: pure-function test seam mirroring backlogDragHelpers; filterTransitionsForStatus wrapped with D-07 screen/validator exclusion"
    - "DropModel: Map<CategoryKey, ColumnDropModel> — split/single/invalid discriminated union keyed by to.statusCategory.key"
    - "Droppable id scheme: zone:<transitionId> for split sub-zones, col:<categoryKey> for single columns"

key-files:
  created:
    - taskflow/src/routes/dashboard/sprintBoardDragHelpers.ts
    - taskflow/src/routes/dashboard/sprintBoardDragHelpers.test.ts
  modified: []

key-decisions:
  - "DropModel is built for all three category keys — categories with 0 transitions get kind:'invalid' (explicit sentinel, not absent) so resolveDropTransitionId can always look up any over.id against the model"
  - "resolveDropTransitionId validates zone:<id> against the model (T-79-03): a forged/unknown transitionId resolves to null, not to an arbitrary transition"

requirements-completed: [TRAN-01, TRAN-02, TRAN-03]

# Metrics
duration: 2min
completed: 2026-06-04
---

# Phase 79 Plan 02: Sprint Board Drag Helpers (Test Seam) Summary

**Pure drop-logic seam `sprintBoardDragHelpers.ts` with `filterDroppableTransitions` (D-05+D-07), `buildDropModel` (D-01/D-02/D-06), and `resolveDropTransitionId` (TRAN-01) — 14/14 tests green, no React/dnd-kit imports**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-04T15:52:33Z
- **Completed:** 2026-06-04T15:54:37Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files created:** 2

## Accomplishments

- Created `sprintBoardDragHelpers.ts` as a pure-function test seam mirroring `backlogDragHelpers.ts` (Phase 78 precedent)
- `filterDroppableTransitions`: wraps `filterTransitionsForStatus` then `.filter(t => !t.hasScreen && !t.hasValidators)` — D-05 reachability + D-07 screen/validator exclusion
- `buildDropModel`: buckets filtered transitions by `to.statusCategory.key` into `split` (>=2), `single` (==1), `invalid` (0) per D-01/D-02/D-06; zones labelled by transition NAME per D-03
- `resolveDropTransitionId`: decodes `zone:<transitionId>` (split sub-zone) and `col:<categoryKey>` (single column) back to transitionId; returns null for invalid/unknown/null (snap-back per D-06, T-79-03 spoofing guard)
- Full 14-test suite including 2 REGRESSION-prefixed D-07 tests (hasScreen, hasValidators) and 5 null/unknown snap-back tests

## Task Commits

1. **Task 1 RED: Failing tests for all three helpers** — `bf8ac09e` (test)
2. **Task 2 GREEN: Implement sprintBoardDragHelpers.ts** — `1fd22dcf` (feat)

## Files Created

- `taskflow/src/routes/dashboard/sprintBoardDragHelpers.ts` — Pure helper module (168 lines); exports `CategoryKey`, `DropZone`, `ColumnDropModel`, `DropModel`, `filterDroppableTransitions`, `buildDropModel`, `resolveDropTransitionId`
- `taskflow/src/routes/dashboard/sprintBoardDragHelpers.test.ts` — Full unit test suite (207 lines); 3 describe blocks, 14 it cases, 2 REGRESSION-prefixed D-07 guards

## Decisions Made

- `kind:'invalid'` is always emitted for all three category keys (never absent from the map) — this lets `resolveDropTransitionId` do a simple `model.get(key)` without undefined checks, and the invalid sentinel produces a clean snap-back
- `resolveDropTransitionId` validates `zone:<id>` against actual model zones before returning — T-79-03 spoofing mitigation: a fabricated transitionId not in the model resolves to null

## Deviations from Plan

None — plan executed exactly as written. The TDD RED/GREEN cycle completed cleanly in 2 tasks.

## Known Stubs

None — the helpers are fully implemented and exercised by unit tests.

## Self-Check

- [x] `taskflow/src/routes/dashboard/sprintBoardDragHelpers.ts` exists (168 lines, 3 named exports)
- [x] `taskflow/src/routes/dashboard/sprintBoardDragHelpers.test.ts` exists (207 lines, 3 describe blocks)
- [x] `grep -c "from '@dnd-kit"` = 0 (pure seam)
- [x] `grep -c "from 'react'"` = 0 (pure seam)
- [x] Commits bf8ac09e and 1fd22dcf present in git log
- [x] 14/14 tests green
- [x] `tsc --noEmit` exits 0

## Self-Check: PASSED

---
*Phase: 79-drag-to-transition-on-sprint-board*
*Completed: 2026-06-04*
