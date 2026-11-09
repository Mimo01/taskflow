---
status: resolved
trigger: "On my tasks page in the all assigned and all reported, the stories do not show the time progress correctly."
created: 2026-11-09
updated: 2026-11-09
---

## Symptoms
- expected: story time bar in All assigned / All reported covers the story and its subtasks (as in Current sprint)
- actual: story time bar shows only the story's own logged/estimated time
- reproduction: My Tasks → All assigned or All reported → any story whose time is on subtasks

## Current Focus
- next_action: none — resolved

## Evidence
- timestamp: 2026-11-09 — fetchAllAssignedHierarchy / fetchAllReportedHierarchy (src/services/jira.ts) fetch parents only (no subtask query) with `timetracking` but no `aggregatetime*` fields.
- timestamp: 2026-11-09 — MyTasksPage renderBySprintList passes empty timeSubtasks; timeBarIssues (src/lib/time-bar.ts) then has no aggregates and falls back to ownTimed(issue) = story's own time only.
- timestamp: 2026-11-09 — Current sprint (fetchMyTasksHierarchy) fetches all subtasks, so its bars are correct.

## Eliminated
- hypothesis: time-bar math wrong — timeBarIssues already handles the "no subtasks, aggregates present" path correctly.

## Resolution
- root_cause: All-assigned/All-reported fetchers omit Jira aggregate time fields while also not fetching subtasks, so story bars ignore subtask time.
- fix: request aggregatetimespent, aggregatetimeoriginalestimate, aggregatetimeestimate in both fetchers.
- verification: new regression test (jira.test.ts "time fields") failed pre-fix, passes post-fix; jira/my-tasks/time-bar suites 210/210; tsc + biome clean.
- files_changed: taskflow/src/services/jira.ts, taskflow/src/services/jira.test.ts
- note: bar is a single segment coloured by the story's status (no per-subtask status split), since these scopes don't load subtasks.
