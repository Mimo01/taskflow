---
status: resolved
trigger: "workload-tab-pagination"
created: 2026-03-13T00:00:00Z
updated: 2026-03-13T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED — Pass 2 in WorkloadTab.tsx only attached subtasks to a person's drill-down when that person also had a worklog on the parent STORY. Subtask-only contributors never saw their subtasks. Fixed by extending the secondary subtask loop to also attach subtasks visually.
test: 24/24 WorkloadTab.test.tsx pass including new regression test "subtask-only contributor: person with worklog only on subtask (not parent story) sees subtask in drill-down"
expecting: Human verification that a person who logs time only on a subtask now sees that subtask in their Workload tab drill-down
next_action: Human verify

## Symptoms

expected: All stories, subtasks, and worklogs for the sprint are loaded regardless of count
actual: For users with many items, data is truncated — some stories/subtasks/worklogs are missing because the API limit was hit and no further pages were fetched. After pagination fix, some subtasks are STILL missing from a person's drill-down.
errors: None — silent truncation
reproduction: User with many sprint items or many worklogs. Also: any person who logged time on a subtask but not on its parent story will see their subtask missing from the drill-down.
started: Likely always been this way — pagination was never implemented; subtask-without-story-worklog gap also always present

## Eliminated

- hypothesis: Only one call site had a hard limit
  evidence: All three search calls in fetchSprintIssues use maxResults=200; fetchMyTasksHierarchy has four calls also at maxResults=200 (one without it, using the Jira default of 50); fetchIssueWorklogs uses no maxResults at all (uses Jira default)
  timestamp: 2026-03-13

- hypothesis: Pagination fix fully resolved the issue
  evidence: After pagination fix, user still sees only some subtasks. Root cause is now in WorkloadTab.tsx grouping logic, not in fetch truncation.
  timestamp: 2026-03-13T01:00:00Z

## Evidence

- timestamp: 2026-03-13
  checked: jira.ts line 192
  found: fetchSprintIssues parent query: `maxResults=200` — no pagination loop; response `total` field never checked
  implication: Sprints with >200 parent stories silently truncate

- timestamp: 2026-03-13
  checked: jira.ts line 241
  found: fetchSprintIssues subtask chunk query: `maxResults=200` — no pagination loop per chunk
  implication: A single chunk of 50 parents could have >200 subtasks; they would be silently dropped

- timestamp: 2026-03-13
  checked: jira.ts line 302
  found: fetchMyTasksHierarchy myStoriesJql call: NO maxResults param — uses Jira default (50)
  implication: Users with >50 assigned stories see only the first 50

- timestamp: 2026-03-13
  checked: jira.ts line 303
  found: fetchMyTasksHierarchy mySubtasksJql call: `maxResults=200`
  implication: Users with >200 subtasks lose items

- timestamp: 2026-03-13
  checked: jira.ts line 340
  found: fetchMyTasksHierarchy extraParents call: `maxResults=200`
  implication: Low risk (extra parents can't exceed parent count already seen) but still not paginated

- timestamp: 2026-03-13
  checked: jira.ts line 361
  found: fetchMyTasksHierarchy allSubtasks chunk call: `maxResults=200`
  implication: Same as fetchSprintIssues subtask chunk — >200 subtasks per chunk silently dropped

- timestamp: 2026-03-13
  checked: jira.ts line 671
  found: fetchIssueWorklogs: no maxResults at all — uses Jira default (probably 1000 but API-version-specific); response structure is `{ worklogs, total, startAt, maxResults }` — pagination fields exist but are ignored
  implication: Issues with >1000 worklogs (or whatever the Jira default cap is) lose older entries

- timestamp: 2026-03-13
  checked: jira.test.ts line 449
  found: Existing regression test asserts maxResults=200 in parent query URL — this test must be kept passing
  implication: New pagination must preserve the 200 page-size value; test checks URL contains `maxResults=200` (startAt=0 page will still contain it)

- timestamp: 2026-03-13T01:00:00Z
  checked: WorkloadTab.tsx lines 184-253 (Pass 2 worklog overlay)
  found: |
    The story loop (lines 184-238) iterates `storyAuthors = worklogMap.get(story.key) ?? []`.
    For each author in storyAuthors, it collects filteredSubtasks (subtasks where that author also
    has worklogs) and attaches them to the story row.

    CRITICAL GAP: If Person X has a worklog on subtask P-1-1 but NOT on its parent story P-1,
    then X is NOT in storyAuthors for P-1. The inner loop never runs for X, so P-1-1 is never
    attached to X's story row. The secondary subtask time loop (lines 243-253) does add X's time
    totals to their summary row, but the subtask is never added to any story's subtasks[] in X's
    drill-down. X sees their time total is non-zero, but the expanded view shows no subtasks.

    Additionally, if X has no story worklogs at all (subtask-only contributor), they may not even
    have a story row to attach the subtask to (their stories[] could be empty or missing the
    relevant story entirely).
  implication: |
    Anyone who logs time only on subtasks (not on parent stories) will see their subtasks
    completely absent from the drill-down. This is a common workflow: developers work on subtasks
    and log time there, not on the parent story.

## Resolution

root_cause: |
  WorkloadTab.tsx Pass 2 attaches subtasks to person rows only when the person has a worklog on
  the PARENT STORY. The loop `for (const authorName of storyAuthors)` uses story-level worklog
  authors. Subtask-only contributors (who logged time on a subtask but not on the parent story)
  are never iterated, so their subtask is never added to any story row in their drill-down.
  The secondary subtask loop (lines 243-253) correctly accumulates their TIME totals, but never
  attaches the subtask visually.

fix: |
  Extended the secondary subtask loop in Pass 2 (WorkloadTab.tsx, previously lines 243-253).
  The loop already accumulated time for each subtask's authors. The fix adds visual attachment:
  for each subtask author, find or create the parent story row in their stories[], then push
  the subtask into that story's subtasks[] if not already present. This uses a deduplication
  guard (`!storyRow.subtasks.some((st) => st.key === sub.key)`) to avoid double-adding subtasks
  for people who also have a story-level worklog (already handled by the story loop).

  If the parent story isn't in the author's stories[] at all (subtask-only contributor, not
  assigned to the story), a new story row is created using the parent story's fields and pushed
  into the author's stories[].

verification: 24/24 WorkloadTab.test.tsx pass (was 23 + 1 new regression test)

files_changed:
  - taskflow/src/routes/dashboard/WorkloadTab.tsx
  - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
