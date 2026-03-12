---
status: resolved
phase: 05-api-foundation-quick-wins
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md
started: 2026-03-12T00:00:00Z
updated: 2026-03-12T12:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

## Current Test

[testing complete]

## Tests

### 1. GitLab MR Search Shows Only Open MRs
expected: Open the search overlay and search for a GitLab MR by name or keyword. Only open (not merged, not closed) MRs appear in the results. Previously merged or closed MRs should not show up.
result: pass

### 2. Sprint Issues Include Subtasks
expected: Navigate to the sprint board or My Tasks tab. Subtasks should now appear alongside their parent issues in the list (previously only parent stories/tasks appeared — subtasks were excluded by Jira's sprint query). If your sprint has any subtasks, they should be visible.
result: issue
reported: "I only see subtasks, there are no stories"
severity: major

### 3. Releases Tab Sort Order
expected: Open the Releases tab. Fix versions should be sorted newest-to-oldest by release date (most recent date at the top). Versions without a release date should appear at the bottom of the list.
result: issue
reported: "I see releases but ther don't seem to be from my selected project"
severity: major

### 4. Release Status Badges
expected: In the Releases tab, each row shows a color-coded status badge next to the version name: green "Released" for released versions, amber/yellow "Unreleased" for future ones. Overdue unreleased versions (past release date, not released) show a red "Overdue" badge, versions due today show a blue "Due today" badge, and upcoming ones show "In N days".
result: skipped
reason: Cannot verify — releases shown are from wrong project (blocked by Test 3 issue)

## Summary

total: 4
passed: 1
issues: 2
pending: 0
skipped: 1

## Gaps

- truth: "Sprint issues list contains both parent issues (stories/tasks) and subtasks merged together"
  status: resolved
  reason: "User reported: I only see subtasks, there are no stories"
  severity: major
  test: 2
  root_cause: "The first query JQL (`sprint in openSprints() AND resolution = Unresolved`) has no `AND issuetype not in subtaskIssueTypes()` guard. On this Jira DC instance, openSprints() returns subtasks (they have sprint values on this board config). The second query then searches for children of those subtask keys — which have no children — returning nothing. Result: only subtasks appear."
  artifacts:
    - path: "taskflow/src/services/jira.ts"
      issue: "First query JQL missing AND issuetype not in subtaskIssueTypes() guard"
    - path: "taskflow/src/services/jira.test.ts"
      issue: "APIF-02 tests don't cover the case where first query returns subtasks"
  missing:
    - "Add AND issuetype not in subtaskIssueTypes() to first query JQL"
    - "Add APIF-02 test for when first query returns a subtask (guard validation)"
  debug_session: ".planning/debug/sprint-subtasks-only.md"
- truth: "Releases tab shows fix versions from the currently selected Jira project, sorted newest-to-oldest"
  status: resolved
  reason: "User reported: I see releases but ther don't seem to be from my selected project"
  severity: major
  test: 3
  root_cause: "Stale numeric project ID persisted in Tauri Store (auth.json). The GET /rest/api/2/version?projectKey= endpoint silently accepts numeric IDs and returns versions for whatever project has that ID, which may not match what the user sees selected. Likely a prior iteration stored p.id (numeric) instead of p.key (string)."
  artifacts:
    - path: "taskflow/src/routes/settings/TokenSection.tsx"
      issue: "handleProjectChange parameter named projectId but receives p.key — naming mismatch is a refactor trap"
    - path: "taskflow/src/stores/auth.store.ts"
      issue: "activeJiraProject persisted via Tauri Store with no type validation on read"
    - path: "taskflow/src/services/jira.ts"
      issue: "fetchFixVersions uses endpoint that silently accepts numeric IDs"
  missing:
    - "Rename handleProjectChange parameter from projectId to projectKey"
    - "Guard against stale numeric IDs: if activeJiraProject is a pure numeric string on startup, clear it"
    - "Optional: switch fetchFixVersions to GET /rest/api/2/project/{projectKey}/versions (only accepts string keys)"
  debug_session: ".planning/debug/releases-tab-wrong-project.md"
