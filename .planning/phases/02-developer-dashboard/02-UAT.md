---
status: complete
phase: 02-developer-dashboard
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md
started: 2026-03-11T14:30:00Z
updated: 2026-03-11T16:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Dashboard Tab Navigation
expected: Open the app to the Dashboard. Three tabs are visible: "My Tasks", "Sprint Board", and "MR Attention". Clicking each tab switches the view without a page reload.
result: issue
reported: "the app is missing styles"
severity: major

### 2. My Tasks: Loading State
expected: When the My Tasks tab first loads (or data is stale), a loading skeleton or spinner appears while Jira data is being fetched. It does not show a blank screen.
result: pass

### 3. My Tasks: Task List
expected: Sprint issues appear as rows with a status badge (e.g. "In Progress"), story points if set, and assignee info. Each row has a comment button on the right.
result: issue
reported: "The comment button does nothing"
severity: major

### 4. My Tasks: Last-Refreshed Timestamp
expected: Below or near the task list there is a "Last refreshed" timestamp that shows the time of the most recent successful fetch. It updates automatically every 60 seconds.
result: pass

### 5. Sprint Board: Kanban Columns
expected: The Sprint Board tab shows tasks organized into columns by their Jira status (e.g. "To Do", "In Progress", "Done"). If there are many columns, the board scrolls horizontally. Each task appears as a card with a compact layout.
result: pass

### 6. MR Attention: Stale Badge
expected: The MR Attention tab lists your assigned and reviewer MRs. MRs older than the configured threshold show a "Stale" badge. MRs below the threshold do not show the badge.
result: issue
reported: "I can't select active git project in the settings, there is no dropdown"
severity: major

### 7. Settings: Stale MR Threshold Selector
expected: In Settings there is a "Stale MR Threshold" selector (or similar label) with options for 1, 2, 3, 5, and 7 days. Changing the value and reloading the app shows the same value was persisted.
result: skipped
reason: Can't test — no active git project selector in settings

### 8. MR Health Chips on Task Rows
expected: Task rows in My Tasks that are linked to a GitLab MR show one or more "MR !{iid}" chips. Each chip has a colored dot: green = approved, yellow = waiting for review, red = changes requested. Tasks with no linked MR show no chips (or a neutral placeholder).
result: skipped
reason: Can't test — no active git project selector in settings

### 9. MR Attention: Linked Task Badge
expected: In the MR Attention tab, each MR row that is linked to a Jira issue shows the issue key (e.g. "PROJ-7") as a badge or label next to the MR title.
result: skipped
reason: Can't test — no active git project selector in settings

### 10. Status Transition via Popover
expected: In My Tasks, clicking the status badge on a task row opens a popover with available Jira transitions (e.g. "Start Progress", "Done"). Selecting a transition immediately updates the status badge optimistically, and the change is sent to Jira. If the request fails, the badge reverts with an error message inline.
result: issue
reported: "there is no popover on clicking the button"
severity: major

### 11. Inline Comment on Task
expected: Clicking the comment button on a task row expands an inline textarea below the row. The textarea is auto-focused. Typing a comment and clicking Submit posts it to Jira. The composer then collapses. Clicking Cancel collapses it without posting. Submit is disabled when the textarea is empty.
result: issue
reported: "nonthing happens when I clink on the comment button"
severity: major

## Summary

total: 11
passed: 0
issues: 5
pending: 0
skipped: 3
skipped: 0

## Gaps

- truth: "Dashboard renders with full Tailwind/CSS styling — tabs, badges, layout all visually styled"
  status: failed
  reason: "User reported: the app is missing styles"
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "Clicking the comment button on a task row expands an inline composer"
  status: failed
  reason: "User reported: The comment button does nothing"
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "MR Attention tab lists MRs with stale badge based on configured threshold"
  status: failed
  reason: "User reported: I can't select active git project in the settings, there is no dropdown"
  severity: major
  test: 6
  artifacts: []
  missing: []

- truth: "Clicking the status badge opens a popover with available Jira transitions"
  status: failed
  reason: "User reported: there is no popover on clicking the button"
  severity: major
  test: 10
  artifacts: []
  missing: []

- truth: "Clicking the comment button expands an inline textarea below the task row"
  status: failed
  reason: "User reported: nonthing happens when I clink on the comment button"
  severity: major
  test: 11
  artifacts: []
  missing: []
