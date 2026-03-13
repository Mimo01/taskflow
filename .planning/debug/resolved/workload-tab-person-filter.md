---
status: resolved
trigger: "workload-tab-person-filter — clicking on a person shows wrong subtasks"
created: 2026-03-13T00:00:00Z
updated: 2026-03-13T00:00:00Z
---

## Current Focus

hypothesis: The WorkloadTab builds the stories drill-down list by grouping stories by their assignee field. When a worklog-only person expands their row, they see no stories (empty). Worse, the subtasks shown under a story are ALL subtasks under that parent — they are not filtered to only those where the person has worklogs. Additionally, the time aggregation on the parent row for subtasks uses sub.fields.assignee, not worklog authorship. So the summary row spentSecs is based on assignment, not who actually logged time.
test: Read WorkloadTab.tsx useMemo logic carefully — specifically how stories and subtasks are attributed to rows, and how the expanded drill-down is built.
expecting: Confirm that stories are bucketed by assignee (not by worklog author), and subtasks are shown based on parentage (not worklog authorship).
next_action: confirmed — proceed to fix

## Symptoms

expected: Clicking a person in the Workload tab should show all issues/subtasks where THAT PERSON logged time (worklogs), regardless of who is assigned.
actual: The drill-down shows subtasks/stories based on assignment, not on who actually logged time. It shows subtasks that someone else spent time on (but the person is assigned), and misses subtasks the person DID spend time on (but is not assigned to them).
errors: No error messages — silent data correctness bug.
reproduction: Open Workload tab, see time per person. Click on a person. The subtask list is wrong — filtered by assignee, not by worklog author.
timeline: Unknown — may never have worked correctly.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-13T00:00:00Z
  checked: WorkloadTab.tsx useMemo (lines 109-204)
  found: |
    Story rows are built by iterating `stories` (issues where issuetype.subtask=false) and bucketing them by `story.fields.assignee?.displayName` (line 139). The `worklogMap` is only used AFTER this loop to ensure worklog-only authors appear as rows at all (lines 183-199), but those rows have empty `stories: []`. The worklogMap is NEVER used to determine which stories/subtasks appear in the drill-down.

    Subtask time aggregation (lines 172-180) also uses `sub.fields.assignee?.displayName` — so spentSecs on an assignee row reflects what's assigned to them, not what they actually worked on.

    The subtasksByParent map (lines 115-130) contains ALL subtasks under each parent, regardless of who worked on them. These are attached wholesale to each story row (line 166), so expanding a person's story shows ALL subtasks of that story, not just the ones that person has worklogs on.
  implication: |
    Three layers of the bug:
    1. Stories in the drill-down are attributed by assignee, not by worklog author.
    2. Subtasks shown under a story are ALL subtasks (no worklog filter).
    3. Subtask time totals per-person row are based on subtask assignment, not worklog authorship.

- timestamp: 2026-03-13T00:00:00Z
  checked: fetchIssueWorklogs (jira.ts lines 665-686)
  found: Returns string[] of unique displayNames who have worklogs on an issue. worklogMap in the component maps issueKey → string[].
  implication: The worklogMap already has per-issue worklog author data. The fix can use it to filter which stories/subtasks a person's row shows, and to compute correct spentSecs.

- timestamp: 2026-03-13T00:00:00Z
  checked: WorkloadTab tests — worklog attribution tests (lines 415-469)
  found: Tests only verify that a worklog-only person appears as a row (count=0, pts=0). There are NO tests that verify the drill-down content when expanded — specifically no tests that check whether the stories/subtasks shown are filtered by worklog authorship vs assignment.
  implication: The missing behavior is untested; adding tests is part of the fix.

## Resolution

root_cause: |
  WorkloadTab.tsx builds the per-person drill-down (stories + subtasks shown when a row is expanded) based on issue ASSIGNMENT (fields.assignee), not on worklog authorship. The worklogMap is fetched but only used to ensure worklog-only people appear as rows — it is never consulted when building the stories list or subtask lists. This means:
  - A person sees stories/subtasks they are assigned to (whether or not they logged time)
  - A person does NOT see stories/subtasks they worked on (logged time) if someone else is assigned
  - Subtask time totals per-person row also use assignment, not worklog authorship

fix: |
  Restructure the useMemo to use worklogMap as the primary source for story/subtask attribution:
  1. Build worklogMap-indexed lookup: for each issueKey, which authors have worklogs?
  2. For each story, add it to the row of EVERY person who has a worklog on it (not just the assignee).
     - If nobody has worklogs on a story, fall back to the assignee (so assigned stories with no time logged still appear).
     - Actually the correct behaviour per spec: show issues where the person logged time. So stories with no worklogs don't appear in anyone's drill-down (they may still contribute to the summary row via assignment for count/pts purposes).
  3. For subtasks: attach a subtask to a person's story only if that person has a worklog on the subtask.
  4. Subtask time aggregation per-person: sum only subtasks where person has worklogs.

  Concrete plan:
  - Keep assignment-based aggregation for count and pts (that is summary data about "what are you responsible for")
  - Change the stories drill-down to be worklog-based: a story appears in person X's expanded view if worklogMap has X for that story key
  - Subtasks shown under a story in person X's expanded view: only subtasks where worklogMap has X for that subtask key
  - spentSecs at summary level: aggregate from worklogs (use timetracking on issues where the person has a worklog)

verification: All 23 tests pass including 4 new regression tests for worklog-driven drill-down behavior.
files_changed:
  - taskflow/src/routes/dashboard/WorkloadTab.tsx
  - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
