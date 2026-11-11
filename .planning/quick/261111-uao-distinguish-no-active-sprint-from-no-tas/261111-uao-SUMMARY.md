---
phase: quick-261111-uao
plan: 01
subsystem: ui
tags: [react-query, empty-state, sprint, jira]
requires: []
provides:
  - useActiveSprint hook + activeSprintQueryKey
  - resolveSprintScopeState helper + NO_ACTIVE_SPRINT_TITLE
affects: [dashboard, my-tasks, standup-notes, sprint-board, sidebar]
key-files:
  created:
    - taskflow/src/hooks/useActiveSprint.ts
    - taskflow/src/hooks/useActiveSprint.test.tsx
    - taskflow/src/lib/sprint-empty-state.ts
    - taskflow/src/lib/sprint-empty-state.test.ts
  modified:
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/routes/dashboard/MyIssuesCard.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/my-tasks/MyTasksPage.tsx
    - taskflow/src/routes/standup-notes/TodayColumn.tsx
key-decisions:
  - "Items always win over the no-sprint signal (fetchActiveSprint null can also mean a failed request)"
  - "isResolving gated on enabled so a disabled v5 query never counts as pending"
completed: 2026-11-11
---

# Phase quick-261111-uao Plan 01: No active sprint vs no tasks Summary

Shared `useActiveSprint` hook (same cache entry the Sidebar prefetches, no new requests) plus a pure `resolveSprintScopeState` helper, wired into Dashboard MY ISSUES, My Tasks (Current Sprint), Standup Today and Sprint Board so "no sprint on the board" reads differently from "no tasks".

## Commits
- 981572ce: shared hook + helper + Sidebar key helper (Task 1)
- 84323d29: Dashboard MY ISSUES + My Tasks (Task 2)
- 076966df: Standup Today + Sprint Board (Task 3)

## Behaviour
- MY ISSUES: "No active sprint" (CalendarOff) when no sprint and 0 issues; unchanged "No issues assigned" when a sprint exists; nothing shown while resolving.
- My Tasks Current Sprint: "No active sprint" empty state; stat tiles, pts donut, and the open/done/pts subline hidden (subline becomes "No active sprint"); All Assigned/Reported unaffected.
- Standup Today: compact "No active sprint" replaces In Progress/Up Next, MR sections stay, stat line shows only the MR count; full-column variant when no MRs either. A failed issue query keeps its error UI.
- Sprint Board: "No active sprint" replaces "No sprint issues"; filter chips/bar and zero column counts hidden.

## Deviations from Plan
- [Rule 3 - Blocking] The worktree had no inner `node_modules`; symlinked it to the main checkout's `taskflow/node_modules` (git-ignored, not committed).
- Worktree HEAD was not at the required base; `git reset --hard fc569888` per the startup check.
- [Minor] SprintBoardTab "No sprint issues" now shows when `swimlanes.length === 0` and state is neither no-sprint nor loading (not only 'empty'), so a board whose data has issues but no swimlanes keeps the prior message.
- [Minor] TodayColumn `noSprint` additionally requires `!sprintQuery.isError` so an issue-fetch error is not masked.
- Existing dashboard `index.test` sprint-day test now provides the sprint through the mocked hook (as the plan anticipated). SprintBoardTab.test's `@/services/jira/sprints` fetchActiveSprint mock was replaced by a hook mock since the component no longer imports it.

## Verification
Full vitest suite green (306 files, 4869 tests), `tsc --noEmit` clean, biome check clean of errors on touched files (pre-existing warnings only). The only non-test `'jira-active-sprint'` literals left are the hook's key helper and two invalidations.

## Known Stubs
None.

## Self-Check: PASSED
