---
phase: quick-261105-fav
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/standup-notes/filterSprintItems.ts
  - taskflow/src/routes/standup-notes/filterSprintItems.test.ts
autonomous: true
requirements: [QUICK-261105-fav]

must_haves:
  truths:
    - "When a story is shown in Standup Today (In Progress or Up Next), every subtask of that story assigned to me is nested under it, done ones included"
    - "Subtasks of a shown story assigned to someone else are still not nested under it"
    - "Which stories appear, and whether each is in In Progress or Up Next, is exactly the same as before"
    - "A done subtask of mine never makes a story appear on its own, and never decides which bucket the story goes in"
    - "Done subtasks render with the existing IssueRow (same row height, done key styling, Done status pill) in Jira's subtask order"
  artifacts:
    - path: "taskflow/src/routes/standup-notes/filterSprintItems.ts"
      provides: "Parent rows nest all of my subtasks (any status); selection + placement still use active subtasks only"
      contains: "allSubtasksByParent"
    - path: "taskflow/src/routes/standup-notes/filterSprintItems.test.ts"
      provides: "Regression tests: done subtask of mine nested, others' subtask excluded, selection unchanged"
  key_links:
    - from: "taskflow/src/routes/standup-notes/filterSprintItems.ts"
      to: "SprintRow.subtasks"
      via: "orderSubtasks(all of my subtasks for the parent, parent.fields.subtasks)"
      pattern: "orderSubtasks\\("
---

<objective>
In Standup Notes → Today, a story that is already shown should also list ALL of my subtasks under it, including done ones, in addition to the subtasks shown today (no duplicates). Which stories are picked and which bucket they land in must not change.

Purpose: during standup the user wants to see everything they did/own on a story, not only the open pieces.
Output: a change in `filterSprintItems.ts` plus updated/new unit tests. No fetch, query-key, or rendering change.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/routes/standup-notes/filterSprintItems.ts
@taskflow/src/routes/standup-notes/filterSprintItems.test.ts

Findings from planning (verified, so the executor does not need to re-check them):
- Data is already complete. TodayColumn's `sprint-board-today-full` query calls `fetchSprintIssues(..., assignedToMe=false, ...)` (legacy `src/services/jira.ts`, lines ~511-590). Its second JQL `issuetype in subtaskIssueTypes() AND parent in (chunk)` has NO status or assignee clause and pages through ALL results via `fetchAllSearchPages`, so every subtask of every sprint parent (done included, with assignee) is in the flat array already. Do NOT touch `services/jira.ts` or any query key. This is not the fetch-once page-cap pitfall: there is no client-side cap.
- `filterSprintItems` already builds `allSubtasksByParent` from the unfiltered `issues` (it is used for `timeSubtasks`). It then drops done items into `active`; `mySubtasks` (active only) drives (a) `parentKeysWithMySubtask` (selection), (b) `_placementStatusKey` via `mySubtasksForParent[0]` (bucket), (c) orphan rows, and (d) nested `subtasks`. Only (d) should change.
- Rendering already handles done subtasks. `TodayInProgressSection` / `TodayUpNextSection` render each `row.subtasks` entry with the same indented `IssueRow` as other subtasks (`doneSummaryClass` on the key, `statusPillClass` status pill, StackedTimeBar). No component edits needed.
- `generateTodayMarkdown` (TodayColumn.tsx) loops over `row.subtasks`, so Copy Markdown will list the done subtasks too. That matches the request; leave it alone.
- The pre-commit hook runs the full vitest suite + biome. Commit test + implementation together in one commit. App commands run from the inner `taskflow/taskflow/` dir; git runs from the outer `taskflow/`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Nest all of my subtasks (done included) under shown stories, keeping selection unchanged</name>
  <files>taskflow/src/routes/standup-notes/filterSprintItems.ts, taskflow/src/routes/standup-notes/filterSprintItems.test.ts</files>
  <behavior>
    - Story assigned to me (indeterminate) with my done subtask S1 and my active subtask S2: row.subtasks keys are exactly [S1, S2] in parent.fields.subtasks order (status never affects order), with no duplicates.
    - Same story with a done subtask assigned to OTHER: that subtask is NOT in row.subtasks (it is still in timeSubtasks).
    - Story NOT assigned to me whose only subtask of mine is DONE: the story does NOT appear in inProgress or upNext (selection unchanged; done subtasks never select).
    - Story NOT assigned to me, with my DONE subtask plus my active 'new' subtask: the story appears in upNext (placement comes from the active subtask, not the done one, even if the done subtask comes first in the input array and in parent.fields.subtasks), and row.subtasks contains both.
    - Story assigned to me with only a done subtask of mine: the story still shows (it was selected by its own assignment) and the done subtask is nested.
    - Done parent with my active subtask still resurfaces as an orphan row with subtasks=[] (existing test stays green).
  </behavior>
  <action>
    In filterSprintItems.ts, inside the `parentRows` map, keep `mySubtasksForParent` (active only) exactly as it is for `_placementStatusKey`. Add a separate list of every subtask of mine for the parent, taken from `allSubtasksByParent.get(parent.key) ?? []` filtered by `isAssignedToMe`. That list comes from the unfiltered issues, so it includes done ones and is a superset of the active list, so no dedupe is needed. Pass this new list to `orderSubtasks(..., parent.fields.subtasks)` for the row's `subtasks`. Do not change `active`, `mySubtasks`, `parentKeysWithMySubtask`, `includedParents`, the orphan logic, or the placement helper, so the story set and buckets stay byte-for-byte the same. Update the header doc comment's DONE EXCLUSION paragraph: done parents and done subtasks still never select or place a row, but once a story row is shown, all of my subtasks under it (done included) are nested. Update the `SprintRow.subtasks` JSDoc to say "My subtasks (any status, done included) nested under this parent".

    In filterSprintItems.test.ts, flip the existing test "does NOT nest a done subtask under an active parent" (SHOP-40). Rename it to say done subtasks ARE nested and assert both SHOP-40-S1 and SHOP-40-S2 are present, with no duplicate keys. Use the existing `makeIssue` helper, which leaves `fields.subtasks` as generated `-child-N` keys, so ordering falls back to numeric key order. Add new cases for the other behaviors above in a new `describe('filterSprintItems — done subtasks under shown stories (261105-fav)')` block. For the ordering case, build the parent fixture with a real `fields.subtasks` sequence: override `fields.subtasks` on the returned object with `[{ key: S1 }, { key: S2 }]`, or add an optional `subtaskKeys` param to `makeIssue`.

    Write the tests first and run them to confirm the new nested-done assertions fail. Then implement and run again until green. Commit once, with tests and implementation together (the pre-commit hook blocks RED commits): `feat(quick-261105-fav): show all my subtasks (incl. done) under Standup Today stories`. Stage explicitly with `git add -- <paths>` and confirm with `git log -1 --stat`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/standup-notes/ && npx biome check src/routes/standup-notes/filterSprintItems.ts src/routes/standup-notes/filterSprintItems.test.ts && npx tsc --noEmit -p .</automated>
  </verify>
  <done>All standup-notes tests pass, including the new 261105-fav block and the flipped SHOP-40 test. Biome is clean on the two files and tsc passes. Stories that appear and their buckets are unchanged for every pre-existing test. Exactly one commit touches only the two files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API → client | Issue data already fetched by the existing query; this change only regroups it in memory |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261105fav-01 | Information disclosure | filterSprintItems nested subtasks | accept | Only subtasks the user can already see in Jira (same fetch, same auth). No new request, token use, or query key |
| T-261105fav-02 | Tampering | Story selection logic | mitigate | Selection/placement still use the active-only `mySubtasks`; tests assert that a story selected only by a done subtask does not appear and that the bucket comes from the active subtask |
</threat_model>

<verification>
- `npx vitest run src/routes/standup-notes/` is green from taskflow/taskflow.
- `git diff HEAD~1 --stat` shows only filterSprintItems.ts and filterSprintItems.test.ts.
- Manual (optional, UAT): Standup Notes → Today. A story with a done subtask of mine now lists it, with the Done pill and done key styling, in Jira subtask order. The story count line ("N in progress · M up next") is unchanged.
</verification>

<success_criteria>
- Every shown story nests all of my subtasks (open and done) with no duplicates. Others' subtasks are excluded.
- Story selection and In Progress / Up Next placement are identical to before.
- No change to fetchers, query keys, or row components.
</success_criteria>

<output>
Create `.planning/quick/261105-fav-standup-today-show-all-my-subtasks-under/261105-fav-SUMMARY.md` when done
</output>
