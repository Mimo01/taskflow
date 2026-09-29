---
phase: quick-260929-fnq
verified: 2026-09-29T00:00:00Z
status: human_needed
score: 6/6 must-have truths verified (1 minor lint warning)
human_verification:
  - test: "Open My Tasks, My Day view, with a foreign in-review story that has a subtask of mine"
    expected: "Band 'In Review — my subtasks' with an indigo dot appears between 'In Review with my MR' and 'In Progress'"
    why_human: "Visual rendering and live Jira data; the plan lists this as manual UAT"
---

# Quick 260929-fnq Verification

Goal: On My Tasks, add a section "In Review — my subtasks" for stories in review that are not mine but contain a subtask of mine.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Foreign review story with my subtask lands in the new band | VERIFIED | `isForeignReviewWithMySubtask` and the lift in `groupByMyDay` Pass 3 (`my-tasks-sort.ts`). Tests cover subtask In Progress, To Do and Done. |
| 2 | Band sits between in-review-my-mr and in-progress | VERIFIED | `MY_DAY_BANDS` has 7 entries in the required order. An ordering test exists. |
| 3 | Lift applies whatever the state of my subtask (subtree-min) | VERIFIED | `Math.min(bandIndex, IN_REVIEW_MY_SUBTASKS_BAND)`, `it.each` test. |
| 4 | Flagged, overdue, my-MR still win | VERIFIED | Min-based lift; four precedence tests (overdue subtask, flagged subtask, my-MR parent, flagged parent). |
| 5 | Own in-review stories without my MR stay in In Progress | VERIFIED | The predicate returns false when `myIssueKeys.has(parent.key)`. D-05 regression test. |
| 6 | Done-category "Reviewed" parent stays Done | VERIFIED | `parentBand !== DONE_BAND` guard. Test present. |

Other checks:
- Indices are shifted correctly. `classifyBand` returns 4 for in-progress, 5 for to-do and 6 for done, and never returns 3. `subtreeBand` caps at `DONE_BAND`. There are no leftover `return 3` or `, 5)` literals.
- `MyTasksPage.tsx` types `MY_DAY_BAND_LABELS` and `MY_DAY_BAND_DOT` as `Record<MyDayBand, string>`. The label is "In Review — my subtasks" with an em dash. The dot is `bg-indigo-500`. That differs from purple, blue and green.
- The `groupByMyDay` call site is unchanged, as planned.

## Spot-checks run

- `npx vitest run src/lib/my-tasks-sort.test.ts src/routes/my-tasks`: 3 files, 53 tests passed.
- `npx tsc --noEmit -p .`: clean.
- `npx biome check` on the 3 touched files: 1 error, 17 warnings.
  - The error is an import-sort error in `MyTasksPage.tsx` L33, introduced by commit 58f2c9c4.
  - Biome wants `{ groupByMyDay, type MyDayBand }`, but the code has `{ type MyDayBand, groupByMyDay }`.
  - The plan's done criterion says "no new diagnostics", so this is a WARNING (cosmetic, one-line fix). It is not a goal blocker.

## Anti-patterns

No TODO, FIXME or stub markers in the diff. No debt markers.

## Gaps

None blocking. The remaining item is the manual UAT above, plus the trivial biome import-order fix.
