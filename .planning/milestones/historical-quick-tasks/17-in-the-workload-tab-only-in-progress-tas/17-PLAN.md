---
phase: quick-17
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/WorkloadTab.tsx
  - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
autonomous: true
requirements:
  - QUICK-17
must_haves:
  truths:
    - "WorkloadTab Tasks column shows total story count including done stories"
    - "Done stories are visually distinguished in the expanded sub-rows"
    - "Story points column (Pts) on summary row still excludes done stories (per locked decision)"
  artifacts:
    - path: "taskflow/src/routes/dashboard/WorkloadTab.tsx"
      provides: "Updated count logic + done badge on story sub-rows"
  key_links:
    - from: "WorkloadRow.count"
      to: "story loop"
      via: "increment removed isDone guard"
      pattern: "existing.count \\+= 1"
---

<objective>
Include done/closed stories in the WorkloadTab Tasks column count. Currently only non-done stories are counted; the user wants all stories (in-progress + done) counted in the Tasks total.

Purpose: Give a complete picture of each assignee's workload including completed work in the sprint.
Output: Updated WorkloadTab where count includes all stories; done sub-rows get a visual "Done" badge to distinguish them; Pts column remains non-done only (locked decision).
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Count all stories in Tasks column and badge done sub-rows</name>
  <files>taskflow/src/routes/dashboard/WorkloadTab.tsx, taskflow/src/routes/dashboard/WorkloadTab.test.tsx</files>
  <behavior>
    - Test: Alice has 1 in-progress + 1 done story → Tasks column shows "2 tasks" (not "1 task")
    - Test: Done story sub-rows render with a visual "Done" indicator/badge (data-testid="done-badge" or class containing "done")
    - Test: Pts on summary row still shows only non-done points (e.g. Alice 5 pts for in-progress P-1, not 8 pts for done P-2)
    - Test: Existing tests that assert "0 tasks" for Carol (only-done stories) must be updated — Carol now shows "1 task"
    - Test: Existing test "sums story points per assignee (unresolved only)" still passes — pts unchanged
  </behavior>
  <action>
In `WorkloadTab.tsx`, in the `useMemo` story loop (around line 150-153):

BEFORE:
```
if (!isDone) {
  existing.points += pts;
  existing.count += 1;
}
```

AFTER:
```
existing.count += 1;          // count ALL stories regardless of status
if (!isDone) {
  existing.points += pts;     // points remain non-done only (locked decision)
}
```

In the story sub-row render (around line 289-301), add a visual "Done" badge when the story is done. To do this, pass `isDone` through to `WorkloadStoryRow`:

1. Add `isDone: boolean` field to the `WorkloadStoryRow` interface.
2. In the story accumulation loop, set `isDone: isDone` when pushing to `existing.stories`.
3. In the JSX story sub-row, render a small badge after the summary when `story.isDone`:
   ```tsx
   {story.isDone && (
     <span data-testid="done-badge" className="ml-1 text-xs text-green-600 font-medium">Done</span>
   )}
   ```

Update `WorkloadTab.test.tsx`:
- Update the "shows assignee row for person with only done stories" test: Carol now shows "1 task" (not "0 tasks"). Adjust assertion from `/0\s*tasks?/i` to `/1\s*task/i`.
- Add a new test: "counts done stories in task total" — Alice with 1 in-progress + 1 done shows "2 tasks" but "5 pts" (not 8).
- Add a new test: "done story sub-row has Done badge" — expand Alice's row, verify `data-testid="done-badge"` present for done story only.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <done>
    All WorkloadTab tests pass. Tasks column counts all stories (including done). Done story sub-rows show a "Done" badge. Pts column still excludes done stories.
  </done>
</task>

</tasks>

<verification>
Run full test suite to confirm no regressions:
`cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20`
</verification>

<success_criteria>
- WorkloadTab Tasks column shows total story count (in-progress + done)
- Done stories render with a visible "Done" badge in expanded sub-rows
- Story points on summary row unchanged (non-done only, per locked decision)
- All WorkloadTab tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/17-in-the-workload-tab-only-in-progress-tas/17-SUMMARY.md`
</output>
