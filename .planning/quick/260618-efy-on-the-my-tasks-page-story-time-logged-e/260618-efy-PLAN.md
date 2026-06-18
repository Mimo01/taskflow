---
phase: quick-260618-efy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/my-tasks/MyTasksPage.tsx
  - taskflow/src/routes/my-tasks/MyTasksPage.test.tsx
autonomous: true
requirements: [QUICK-260618-efy]
must_haves:
  truths:
    - "A DONE-category parent's time rollup includes its subtasks' time logged and estimate even though the subtask rows are not displayed"
    - "DONE-category parents still render NO subtask rows (display behavior unchanged)"
    - "IN-PROGRESS/non-done parents still render subtask rows and still roll up subtask time"
  artifacts:
    - path: "taskflow/src/routes/my-tasks/MyTasksPage.tsx"
      provides: "Time aggregation decoupled from subtask-row display in renderMyDayList"
    - path: "taskflow/src/routes/my-tasks/MyTasksPage.test.tsx"
      provides: "Regression test proving done-parent rollup includes hidden subtask time"
  key_links:
    - from: "renderMyDayList sortedParents.map"
      to: "renderFlatRows"
      via: "always passes full subtask list for aggregation, plus a separate show-rows flag"
      pattern: "renderFlatRows\\("
---

<objective>
Fix the My Tasks page time rollup so a story's aggregated "time logged" and "time estimated" include ALL its subtasks' values regardless of whether the subtask rows are displayed in that section.

Purpose: In the "Current Sprint / My Day" view (renderMyDayList), DONE-category parents intentionally hide their subtask rows. The current code achieves that hiding by passing an empty subtask array to renderFlatRows — which ALSO feeds the time-aggregation helper, so done parents lose all their subtask time. The two concerns (display vs. aggregation) must be decoupled.

Output: A done parent row whose time bar reflects parent + subtask time, while still rendering zero subtask rows.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# ── ROOT CAUSE (confirmed by investigation) ──────────────────────────────────
#
# File: taskflow/src/routes/my-tasks/MyTasksPage.tsx
#
# `renderFlatRows(parent, subtasks)` does TWO things with the same `subtasks` arg:
#   1. accumulateTime(parent, subtasks)  → rolls up time logged + estimate
#      (MyTasksPage.tsx ~line 489-507, 511-515)
#   2. passes `subtasks={subtasks}` to <MyTaskRow>, which renders one indented
#      row per subtask (MyTaskRow.tsx ~line 404-409)
#
# In renderMyDayList (the "Current Sprint" view), the call site at ~line 585-591
# does:
#     isParentDone ? [] : (subtasksByKey.get(parent.key) ?? [])
# i.e. for a DONE-category parent it passes `[]` to suppress subtask ROWS
# (intentional behavior introduced by prior quick task 260618-ckn, covered by the
# test suite "DONE parent subtask suppression (260618-ckn)").
#
# BUG: that same `[]` also zeroes the time aggregation. The subtask DATA IS
# PRESENT (subtasksByKey already holds the real subtasks for the done parent —
# it is fetched, not missing), it is merely being filtered out before the rollup.
#
# So this is a present-but-filtered case, NOT a not-fetched case. The fix is to
# stop filtering the aggregation array — feed renderFlatRows the FULL subtask
# list and suppress the DISPLAY of rows separately.
#
# Note: renderBySprintList (~line 677-678) already passes the full subtask list
# and is NOT affected; do not change its behavior.

@taskflow/src/routes/my-tasks/MyTasksPage.tsx
@taskflow/src/routes/my-tasks/MyTaskRow.tsx
@taskflow/src/routes/my-tasks/MyTasksPage.test.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add failing regression test for done-parent rollup including hidden subtask time</name>
  <files>taskflow/src/routes/my-tasks/MyTasksPage.test.tsx</files>
  <behavior>
    - In the existing "DONE parent subtask suppression (260618-ckn)" describe block
      (or a new sibling describe in the same file), add a test:
      "rolls up subtask time into a DONE parent even though subtask rows are hidden".
    - Extend the makeIssue fixture helper so a `timetracking` object can be supplied
      via opts (e.g. opts.timeSpentSeconds / opts.originalEstimateSeconds) — currently
      timetracking is hardcoded `null`. Keep the default `null` when not supplied so
      existing tests are unaffected.
    - Fixtures: one DONE parent STORY-1 with parent timetracking
      { timeSpentSeconds: 3600, originalEstimateSeconds: 7200 } and one DONE subtask
      SUB-1 (subtask:true, parentKey:'STORY-1') with timetracking
      { timeSpentSeconds: 1800, originalEstimateSeconds: 3600 }. myIssueKeys includes both.
    - Assert: the STORY-1 row is present; the SUB-1 row is ABSENT (suppression kept);
      AND the parent row's time caption reflects the COMBINED total
      (spent 3600+1800 = 5400s, estimate 7200+3600 = 10800s). The caption text is
      produced by formatDuration (see MyTaskRow StackedTimeBar: `${formatDuration(spent)} / ${formatDuration(est)}`),
      so import formatDuration from '@/services/jira/duration' and assert the rendered
      text equals `${formatDuration(5400)} / ${formatDuration(10800)}` scoped within the
      STORY-1 row (query by testid `my-task-row-STORY-1` then within() for the text).
    - This test MUST fail against current code (current rollup shows parent-only:
      `${formatDuration(3600)} / ${formatDuration(7200)}`).
  </behavior>
  <action>Write the regression test as described in <behavior>. Reuse the existing useQuery mock pattern from the surrounding tests (return sprintData for queryKey ['jira-issues','my-tasks', ...], NO_DATA_RESPONSE otherwise). Use within() from @testing-library/react to scope the caption assertion to the parent row so it cannot accidentally match a subtask row. Do NOT modify production code in this task — confirm the test fails for the right reason (parent-only total rendered).</action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/my-tasks/MyTasksPage.test.tsx -t "rolls up subtask time into a DONE parent" 2>&1 | tail -20</automated>
  </verify>
  <done>New test exists and FAILS, with failure showing the parent-only duration rather than the combined duration.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Decouple time aggregation from subtask-row display in renderMyDayList</name>
  <files>taskflow/src/routes/my-tasks/MyTasksPage.tsx</files>
  <behavior>
    - renderFlatRows must aggregate over the FULL subtask list (accumulateTime
      receives all real subtasks) while the <MyTaskRow subtasks=...> rows can be
      independently suppressed.
    - DONE-category parents: aggregated time INCLUDES subtasks; ZERO subtask rows rendered.
    - Non-done parents: unchanged — subtask rows rendered AND time aggregated.
    - renderBySprintList behavior unchanged.
  </behavior>
  <action>Modify renderFlatRows to take a separate flag controlling row display, e.g. `renderFlatRows(parent, subtasks, showSubtaskRows = true)`. Inside, call accumulateTime(parent, subtasks) over the full list as today, but pass `subtasks={showSubtaskRows ? subtasks : []}` to <MyTaskRow>. Then update the renderMyDayList call site (currently `renderFlatRows(parent, isParentDone ? [] : (subtasksByKey.get(parent.key) ?? []))`) to ALWAYS pass the full list and gate display via the flag: `renderFlatRows(parent, subtasksByKey.get(parent.key) ?? [], !isParentDone)`. Leave the renderBySprintList call site untouched (it already passes the full list and renders rows). Do not change any other behavior, props, or display logic. This fix filters the correct array (display only) rather than the aggregation array — the subtask data is already present, never refetch.</action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/my-tasks/MyTasksPage.test.tsx 2>&1 | tail -25</automated>
  </verify>
  <done>The Task 1 regression test passes; the existing "260618-ckn" suppression tests (done parent hides subtask rows, in-progress parent shows subtask rows) still pass.</done>
</task>

<task type="auto">
  <name>Task 3: Verify full check (lint + typecheck + targeted tests) is green</name>
  <files>taskflow/src/routes/my-tasks/MyTasksPage.tsx, taskflow/src/routes/my-tasks/MyTasksPage.test.tsx</files>
  <action>Run the project quality gate to confirm no regressions in lint, types, or the my-tasks test suite. If biome reports formatting issues in the touched files, apply `npx biome check --write` on the two modified files only. Do not introduce unrelated changes.</action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/my-tasks/ 2>&1 | tail -15 && npx tsc --noEmit 2>&1 | tail -10</automated>
  </verify>
  <done>my-tasks test suite passes and `tsc --noEmit` reports no errors introduced by this change.</done>
</task>

</tasks>

<verification>
- Done-category parent in Current Sprint view: subtask rows hidden, time bar reflects parent + subtask totals.
- In-progress parent: subtask rows shown, time bar reflects parent + subtask totals (unchanged).
- renderBySprintList (All Assigned / All Reported) unchanged.
- No subtask data is refetched — the fix only changes which array is used for display vs. aggregation.
</verification>

<success_criteria>
- The aggregation (time logged + time estimated) on a story is independent of whether its subtasks are displayed.
- Display behavior (which sections show subtasks) is byte-for-byte unchanged: done parents still show zero subtask rows.
- `npx vitest run src/routes/my-tasks/` passes; `npx tsc --noEmit` clean.
</success_criteria>

<output>
Create `.planning/quick/260618-efy-on-the-my-tasks-page-story-time-logged-e/260618-efy-SUMMARY.md` when done.
</output>
