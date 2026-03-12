---
status: complete
phase: 05-api-foundation-quick-wins
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md, 05-06-SUMMARY.md
started: 2026-03-12T16:00:00Z
updated: 2026-03-12T16:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. GitLab MR Search Shows Only Open MRs
expected: Open the search overlay and search for a GitLab MR by name or keyword. Only open (not merged, not closed) MRs appear in the results. Previously merged or closed MRs should not show up.
result: pass

### 2. Sprint Issues Include Both Stories and Subtasks
expected: Navigate to My Tasks or the sprint view. You should see both parent issues (stories/tasks) and their subtasks together in the list — not just one or the other. If your sprint has subtasks, they should appear alongside parent issues.
result: issue
reported: "I see a flat list of tasks(stories) and subtasks together. I see my assigned tasks but also some subtasks that are not assigned to me"
severity: major

### 3. Releases Tab Sort Order
expected: Open the Releases tab. Fix versions should be sorted newest-to-oldest by release date (most recent date at the top). Versions without a release date should appear at the bottom of the list.
result: issue
reported: "released are first, unreleased then. But This are not the correct releases from my selected project. I see some releases but I do not recognize them. I want to see releases from my jira project In standard Jira I see them as Releases or FixVersion"
severity: major

### 4. Release Status Badges
expected: In the Releases tab, each row shows a color-coded status badge next to the version name: green "Released" for released versions, amber/yellow "Unreleased" for future ones. Overdue unreleased versions (past release date, not released) show a red "Overdue" badge, versions due today show a blue "Due today" badge, and upcoming ones show "In N days".
result: skipped
reason: Cannot verify — releases shown are from wrong project (blocked by Test 3 issue)

### 5. Releases Tab Shows Correct Project
expected: In the Releases tab, the fix versions shown belong to your currently selected Jira project. If you previously had a bug where releases from a different (or unknown) project appeared, restarting the app should now clear that and show the correct project's releases (or prompt you to re-select your project).
result: issue
reported: "the problem persists"
severity: major

## Summary

total: 5
passed: 1
issues: 3
pending: 0
skipped: 1

## Gaps

- truth: "Sprint issues list shows only issues assigned to the current user (both parent stories and their subtasks)"
  status: failed
  reason: "User reported: I see a flat list of tasks(stories) and subtasks together. I see my assigned tasks but also some subtasks that are not assigned to me"
  severity: major
  test: 2
  artifacts: []
  missing: []
- truth: "Releases tab shows fix versions from the currently selected Jira project"
  status: failed
  reason: "User reported: released are first, unreleased then. But This are not the correct releases from my selected project. I see some releases but I do not recognize them. I want to see releases from my jira project In standard Jira I see them as Releases or FixVersion"
  severity: major
  test: 3
  artifacts: []
  missing: []
- truth: "Releases tab shows fix versions from the currently selected Jira project after app restart"
  status: failed
  reason: "User reported: the problem persists"
  severity: major
  test: 5
  artifacts: []
  missing: []
