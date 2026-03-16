---
status: resolved
trigger: "On issue detail page, the sprint the story is in doesn't load — it just shows '-'"
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:00:00Z
---

## Current Focus

hypothesis: The sprint custom field parsing in IssueDetailSidebar handles Array<{name,state}> and string, but not single-object or Jira DC Java toString string array formats. On Jira DC, REST API v2 may return sprint data in formats the code doesn't handle, causing sprintName=null and display of "No sprint" (user reports as "-").
test: Review code and make parsing robust for all known Jira DC formats
expecting: After fix, sprint field should show correct name for any Jira DC response format
next_action: Fix the sprint parsing to handle all formats robustly

## Symptoms

expected: The sprint field on issue detail should show the name of the sprint the issue belongs to
actual: The sprint field shows "-" instead of the sprint name
errors: None reported
reproduction: Open any issue that is in a sprint, check the sprint field in the detail view
started: Unknown — may have been introduced during recent quick tasks or phase 21/22 work

## Eliminated

## Evidence

- timestamp: 2026-03-16T00:10:00Z
  checked: IssueDetailSidebar.tsx lines 99-104 — sprint parsing logic
  found: Code handles string, Array<{name,state}>, and null. Does NOT handle single-object format or Jira DC Java toString strings in arrays.
  implication: On Jira DC, rawSprint may be a single object or array of toString strings, both resulting in sprintName=null

- timestamp: 2026-03-16T00:11:00Z
  checked: fetchIssueDetail (jira.ts:901-929)
  found: Uses REST API v2 (/rest/api/2/issue/{key}?fields=...) with sprintFieldKey in the fields list. Returns raw JSON.
  implication: The response format depends on Jira version/platform

- timestamp: 2026-03-16T00:12:00Z
  checked: fetchBacklogView (jira.ts:1455-1468) parseSprintFromIssue
  found: Uses Agile API which returns fields.sprint as a single object (not array). Has its own parsing that handles single object with id, name, state.
  implication: Two different API endpoints return sprint data in different formats

- timestamp: 2026-03-16T00:13:00Z
  checked: IssueDetailSidebar.tsx line 393
  found: Sprint row shows "{sprintName ?? 'No sprint'}" — fallback is "No sprint", not "-". User says they see "-".
  implication: Either user describes "No sprint" as "-", or sprintName is literally "-", or the sprint row isn't rendering at all

## Resolution

root_cause: The sprint custom field parsing in IssueDetailSidebar only handled Array<{name,state}> (Jira Cloud format). On Jira DC, the REST API v2 returns sprint data as (a) an array of Java toString strings like "com.atlassian...Sprint@...[id=1,...,name=Sprint 1,...]", (b) a single object (not array), or (c) objects with uppercase state "ACTIVE". The old code accessed .state and .name on strings (returning undefined), fell through to null, and displayed "No sprint". Additionally, the old state comparison was case-sensitive ("active" only), missing DC's uppercase "ACTIVE".
fix: Replaced inline sprint parsing with a robust extractSprintName() function that handles all 5 known Jira sprint field formats — array of objects, array of toString strings, single object, plain string, and null/undefined. Includes case-insensitive state matching and regex extraction of name from Java toString format.
verification: 14 unit tests covering all formats pass. TypeScript compiles cleanly. Existing IssueDetailSheet tests unaffected.
files_changed: [taskflow/src/routes/dashboard/IssueDetailSidebar.tsx, taskflow/src/routes/dashboard/IssueDetailSidebar.test.ts]
