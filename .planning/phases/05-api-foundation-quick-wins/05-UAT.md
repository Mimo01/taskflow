---
status: complete
phase: 05-api-foundation-quick-wins
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md
started: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
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
  status: failed
  reason: "User reported: I only see subtasks, there are no stories"
  severity: major
  test: 2
  artifacts: []
  missing: []
- truth: "Releases tab shows fix versions from the currently selected Jira project, sorted newest-to-oldest"
  status: failed
  reason: "User reported: I see releases but ther don't seem to be from my selected project"
  severity: major
  test: 3
  artifacts: []
  missing: []
