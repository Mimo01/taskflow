---
phase: quick-260618-efy
plan: "01"
subsystem: my-tasks
tags: [bug-fix, tdd, time-tracking, my-tasks]
key-decisions:
  - "Decouple aggregation from display via showSubtaskRows param rather than a separate aggregation call"
  - "accumulateTime always receives full subtask list; subtasks prop to MyTaskRow gated by flag"
key-files:
  modified:
    - taskflow/src/routes/my-tasks/MyTasksPage.tsx
    - taskflow/src/routes/my-tasks/MyTasksPage.test.tsx
metrics:
  completed: "2026-06-18"
  tasks: 3
  files: 2
---

# Phase quick-260618-efy Plan 01: My Tasks Done-Parent Time Rollup Fix Summary

**One-liner:** Decoupled `renderFlatRows` aggregation from subtask-row display so done parents show combined parent+subtask time while still rendering zero subtask rows.

## What Was Built

The My Tasks page (`renderMyDayList`) was passing an empty subtask array `[]` to `renderFlatRows` for DONE-category parents in order to suppress subtask row display. This same `[]` also fed `accumulateTime`, zeroing the time rollup for done parents.

The fix adds a `showSubtaskRows = true` parameter to `renderFlatRows`. `accumulateTime` now always receives the full subtask list for correct aggregation, while `subtasks={showSubtaskRows ? subtasks : []}` on `<MyTaskRow>` controls row display independently. The `renderMyDayList` call site now passes the full list plus `!isParentDone` as the display flag. `renderBySprintList` is untouched.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing regression test for done-parent time rollup | `50e83580` | MyTasksPage.test.tsx |
| 2 (GREEN) | Decouple time aggregation from subtask-row display | `72ada5c1` | MyTasksPage.tsx |
| 3 | Verify full check (lint + typecheck + targeted tests) | `ae5fa61f` | MyTasksPage.tsx (biome fmt) |

## Verification Results

- `npx vitest run src/routes/my-tasks/` — 11/11 tests pass (8 in MyTasksPage.test.tsx + 3 in MyTaskRow.test.tsx)
- `npx tsc --noEmit` — clean (no errors)
- `npx biome check` on both files — clean (no errors, 0 fixes needed)

## Deviations from Plan

**1. [Rule 1 - Style] Biome formatter collapsed renderFlatRows call to one line**
- **Found during:** Task 3 verification
- **Issue:** The multi-line `renderFlatRows(parent, subtasksByKey.get(parent.key) ?? [], !isParentDone)` call triggered a biome formatter error
- **Fix:** Applied `npx biome check --write` to collapse to one line; no logic change
- **Files modified:** `taskflow/src/routes/my-tasks/MyTasksPage.tsx`
- **Commit:** `ae5fa61f`

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `taskflow/src/routes/my-tasks/MyTasksPage.tsx` exists and contains `showSubtaskRows` param
- `taskflow/src/routes/my-tasks/MyTasksPage.test.tsx` exists and contains `260618-efy` describe block
- Commits `50e83580`, `72ada5c1`, `ae5fa61f` present in worktree history
