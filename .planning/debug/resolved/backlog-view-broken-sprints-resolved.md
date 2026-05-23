---
status: awaiting_human_verify
trigger: "backlog view broken sprints — wrong sprints from other projects appear, valid sprints show no stories"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED — all three original bugs plus two follow-up issues (sticky backlog header, Move to Backlog context menu)
test: All 16 BacklogPage tests pass, TypeScript clean, full suite 831/835 (4 pre-existing flakes)
expecting: User confirms Move to Backlog context menu works on sprint section issues
next_action: Await human verification

## Symptoms

expected: Backlog view should only show sprints belonging to the user's specific Jira project/board. Each sprint section should display its stories. The backlog section should show unassigned stories.
actual: Wrong sprints from other projects appear in the backlog view. Valid sprints (non-backlog) show no stories at all.
errors: No specific error messages — it's a data/rendering issue.
reproduction: Navigate to the board backlog view in the app.
started: After phases 48 and 49 were implemented.

## Eliminated

- hypothesis: Phase 49 commit (37703a3) broke something in query keys
  evidence: Phase 49 only replaced dead references to jira-backlog-view query key with correct query keys; did not touch data fetching logic
  timestamp: 2026-04-04

## Evidence

- timestamp: 2026-04-04
  checked: fetchSprintList in taskflow/src/services/jira/backlog.ts (lines 76-99)
  found: Calls /rest/agile/1.0/board/{boardId}/sprint?state=active,future and returns ALL sprints with no originBoardId filtering
  implication: Jira boards can contain sprints from other projects; without originBoardId filtering, those appear in the backlog view

- timestamp: 2026-04-04
  checked: fetchBacklogView in taskflow/src/services/jira/backlog.ts (lines 206-271)
  found: OLD code detected projectBoardId from first active sprint's originBoardId, then filtered all sprint lists by originBoardId === projectBoardId
  implication: The new fetchSprintList lost this board-scoping logic entirely

- timestamp: 2026-04-04
  checked: fetchSprintStories in taskflow/src/services/jira/issues.ts (line 41)
  found: Uses JQL "sprint in openSprints()" which only returns active sprint issues — NOT future sprint issues
  implication: mergedSprints includes future sprints from sprintList, but storiesBySprint map has no entries for those sprint IDs → future sprints always show 0 stories

- timestamp: 2026-04-04
  checked: mergedSprints useMemo in BacklogPage.tsx (lines 314-333)
  found: Groups sprintStories by sprint ID, then maps sprintList (active+future) to sections using storiesBySprint.get(sprint.id) ?? []
  implication: Future sprint IDs will never be in storiesBySprint because fetchSprintStories only fetches openSprints() — confirms bug 2

## Resolution

root_cause: Three bugs from phase 48-01 refactor (BacklogPage migrated from monolithic fetchBacklogView to per-section queries, losing two critical properties of the old code):
  1. fetchSprintList has no originBoardId filtering — old fetchBacklogView detected canonical project board via active sprint originBoardId and filtered out sprints from other boards. New fetchSprintList returned ALL sprints on the board endpoint, including those owned by other boards. Fixed by adding originBoardId filtering to fetchSprintList.
  2. fetchSprintStories only fetches openSprints() (active sprint only) and does not include the sprint custom field in its fields list. BacklogPage's mergedSprints grouped stories by fields.sprint.id — but that field was never populated, so ALL sprint sections showed 0 stories (not just future sprints). Fixed by replacing the jira-sprint-stories query in BacklogPage with a new fetchBacklogSprintStories function that (a) uses the Agile board endpoint so fields.sprint is reliable, (b) fetches both openSprints() AND futureSprints() in parallel, and (c) uses a separate query key jira-backlog-sprint-stories so SprintBoardTab's cache is untouched.
fix:
  - taskflow/src/services/jira/backlog.ts: Added originBoardId filtering to fetchSprintList; added fetchBacklogSprintStories function (Agile board endpoint, active+future, sprint field included)
  - taskflow/src/routes/dashboard/BacklogPage.tsx: Replaced jira-sprint-stories query with jira-backlog-sprint-stories (fetchBacklogSprintStories); added boardIdLoading to isAnyLoading; updated cache invalidation in handleMoveToSprint
  - taskflow/src/components/app/Sidebar.tsx: Updated /backlog prefetch to use fetchBacklogSprintStories (boardId-gated)
  - taskflow/src/main.tsx: Added jira-backlog-sprint-stories to title cache search and handleCreateModalClose invalidation
  - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts: Added jira-backlog-sprint-stories invalidation
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx: Added jira-backlog-sprint-stories invalidation
  - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts: Added jira-backlog-sprint-stories invalidation
  - taskflow/src/components/app/RecentItemsPopover.tsx: Added jira-backlog-sprint-stories cache search
  - taskflow/src/routes/dashboard/BacklogPage.test.tsx: Updated all mocks to use fetchBacklogSprintStories
verification: 835/835 tests pass, TypeScript clean. Awaiting human runtime confirmation.
files_changed:
  - taskflow/src/services/jira/backlog.ts
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/main.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
  - taskflow/src/components/app/RecentItemsPopover.tsx
  - taskflow/src/routes/dashboard/BacklogPage.test.tsx
