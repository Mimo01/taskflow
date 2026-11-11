---
phase: quick-261111-un4
plan: 01
subsystem: ui/empty-states
tags: [empty-state, sprint, copy, layout]
requires: [261111-uao]
provides: [EmptyState fill prop, NO_ACTIVE_SPRINT_SUBTITLE]
affects: [SprintBoardTab, MyTasksPage, MyIssuesCard, TodayColumn]
tech-stack:
  added: []
  patterns: ["opt-in `fill` on EmptyState for page/pane-sized parents (h-full min-h-fit flex-1)"]
key-files:
  created: []
  modified:
    - taskflow/src/components/ui/empty-state.tsx
    - taskflow/src/components/ui/empty-state.test.tsx
    - taskflow/src/lib/sprint-empty-state.ts
    - taskflow/src/lib/sprint-empty-state.test.ts
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
    - taskflow/src/routes/my-tasks/MyTasksPage.tsx
    - taskflow/src/routes/my-tasks/MyTasksPage.test.tsx
    - taskflow/src/routes/dashboard/MyIssuesCard.tsx
    - taskflow/src/routes/dashboard/MyIssuesCard.test.tsx
    - taskflow/src/routes/standup-notes/TodayColumn.tsx
    - taskflow/src/routes/standup-notes/TodayColumn.test.tsx
decisions:
  - "EmptyState centring is opt-in via `fill`, so other callers render exactly as before"
  - "Canonical no-sprint subtitle 'Start a sprint in Jira and its issues will appear here.' Sites may append one sentence but must not reword it"
  - "Standup and MyIssuesCard states stay in flow (only their copy changes) so the Standup Today and Yesterday columns line up"
metrics:
  duration: ~6min
  completed: 2026-11-11
---

# Quick 261111-un4: Centred, consistent sprint empty states Summary

EmptyState gained an opt-in `fill` prop (`h-full min-h-fit flex-1`). The Sprint Board and My Tasks list-area empty states now use it, so they sit centred in their pane instead of at the top. Every "No active sprint" state uses the CalendarOff icon and the canonical `NO_ACTIVE_SPRINT_SUBTITLE`.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | EmptyState `fill` prop + canonical no-sprint subtitle | 32318ef6 |
| 2 | Centre Sprint Board + My Tasks empty states; unify no-sprint copy | ac107d8f |

## Changes

- **Sprint Board:** "No active sprint" and "No sprint issues" both use `fill`. The no-sprint state uses the constant. The no-issues subtitle now reads "Issues added to the active sprint will appear here."
- **My Tasks:** all five list-area EmptyStates use `fill` (No active sprint, No matches x2, You're all caught up, No assigned/reported issues). The no-sprint subtitle is the constant plus " Switch to All Assigned to see the rest of your work."
- **MyIssuesCard:** the subtitle is the constant. No `fill`, because the state sits inside a card.
- **TodayColumn:** the compact state uses the constant. The full-column state is the constant plus " No MRs are awaiting review." Neither uses `fill`, so the column stays aligned with YesterdayColumn.
- Tests import the constant rather than copying the string. Both Sprint Board cases check that the EmptyState root has `flex-1`.

## Verification

- The four route test files and two unit test files pass. The full suite in the pre-commit hook passed for both commits (4872 passed).
- `tsc --noEmit` is clean. biome reports no errors on the touched files; the only warnings are existing non-null assertions.
- grep finds no remaining "no open sprint" or "populate when issues" literals in src.
- `git diff --stat` touches only the 12 planned files.

## Deviations from Plan

None. The plan was executed as written.

## Human check pending

In the Tauri dev app:
- Open Sprint Board on a board with no active sprint. The state should be centred in the board area.
- Open My Tasks > Current Sprint. The state should be centred in the same way.
- Check that the Dashboard MY ISSUES card and Standup Today show the same subtitle sentence.

## Self-Check: PASSED

- Both commits (32318ef6, ac107d8f) are in git log.
- All 12 modified files exist and appear in the commit stats.
