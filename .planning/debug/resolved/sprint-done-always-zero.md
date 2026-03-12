---
status: resolved
trigger: "Sprint progress shows done count and story points as 0 everywhere, while todo and in-progress have correct values."
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — JQL in fetchSprintIssues includes `AND resolution = Unresolved` which filters out all done issues (done issues in Jira have a resolution value set)
test: Remove resolution = Unresolved from the JQL
expecting: Done issues will appear in API response, done count/points will be correct
next_action: Awaiting human verification that done count and story points now appear correctly

## Symptoms

expected: Sprint progress shows correct done story count and done story points
actual: Done count and done story points always show 0 everywhere done appears (progress bar, summary, all locations)
errors: none (silent data correctness bug)
reproduction: Open sprint view — todo and in-progress have values, done is always 0
started: Always been 0; never worked

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-12T00:00:00Z
  checked: jira.ts fetchSprintIssues JQL (line 189-191)
  found: JQL contains `AND resolution = Unresolved` — this is a Jira filter that returns only issues with no resolution set. Done issues in Jira have a resolution value set (e.g., "Fixed", "Done"), so they are excluded.
  implication: The API never returns done issues to the component. The component aggregation logic is correct but receives no done issues to count.

- timestamp: 2026-03-12T00:00:00Z
  checked: SprintProgressTab.tsx aggregation logic (lines 69-94)
  found: Component checks statusCategory.key === 'done' correctly. The component logic is correct.
  implication: The bug is entirely at the data-fetching layer (JQL filter), not the display layer.

- timestamp: 2026-03-12T00:00:00Z
  checked: fetchMyTasksHierarchy JQL (line 289-291)
  found: Same `AND resolution = Unresolved` in the myStoriesJql — MyTasksTab also affected.
  implication: Same bug affects the My Tasks view.

## Resolution

root_cause: fetchSprintIssues and fetchMyTasksHierarchy both include `AND resolution = Unresolved` in their JQL queries. In Jira, resolved/done issues have a non-null resolution value and therefore do not match `resolution = Unresolved`. All done sprint issues are silently excluded from the API response, making done count and story points always 0.
fix: Remove `AND resolution = Unresolved` from the sprint JQL in both fetchSprintIssues and fetchMyTasksHierarchy. Sprint scoping (sprint in openSprints()) already bounds the result set — the resolution filter is unnecessary and harmful.
verification: All jira.test.ts and SprintProgressTab.test.tsx tests pass. Pre-existing unrelated failures in MyTasksTab.test.tsx, ReleasesTab.test.tsx, WorkloadTab.test.tsx are confirmed pre-existing (same failures on unmodified code).
files_changed:
  - taskflow/src/services/jira.ts
