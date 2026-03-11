---
status: testing
phase: 02-developer-dashboard
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md
started: 2026-03-11T14:30:00Z
updated: 2026-03-11T14:31:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 2
name: My Tasks: Loading State
expected: |
  When the My Tasks tab first loads (or data is stale), a loading skeleton or spinner appears
  while Jira data is being fetched. It does not show a blank screen.
awaiting: user response

## Tests

### 1. Dashboard Tab Navigation
expected: Open the app to the Dashboard. Three tabs are visible: "My Tasks", "Sprint Board", and "MR Attention". Clicking each tab switches the view without a page reload.
result: issue
reported: "the app is missing styles"
severity: major

### 2. My Tasks: Loading State
expected: When the My Tasks tab first loads (or data is stale), a loading skeleton or spinner appears while Jira data is being fetched. It does not show a blank screen.
result: [pending]

### 3. My Tasks: Task List
expected: Sprint issues appear as rows with a status badge (e.g. "In Progress"), story points if set, and assignee info. Each row has a comment button on the right.
result: [pending]

### 4. My Tasks: Last-Refreshed Timestamp
expected: Below or near the task list there is a "Last refreshed" timestamp that shows the time of the most recent successful fetch. It updates automatically every 60 seconds.
result: [pending]

### 5. Sprint Board: Kanban Columns
expected: The Sprint Board tab shows tasks organized into columns by their Jira status (e.g. "To Do", "In Progress", "Done"). If there are many columns, the board scrolls horizontally. Each task appears as a card with a compact layout.
result: [pending]

### 6. MR Attention: Stale Badge
expected: The MR Attention tab lists your assigned and reviewer MRs. MRs older than the configured threshold show a "Stale" badge. MRs below the threshold do not show the badge.
result: [pending]

### 7. Settings: Stale MR Threshold Selector
expected: In Settings there is a "Stale MR Threshold" selector (or similar label) with options for 1, 2, 3, 5, and 7 days. Changing the value and reloading the app shows the same value was persisted.
result: [pending]

### 8. MR Health Chips on Task Rows
expected: Task rows in My Tasks that are linked to a GitLab MR show one or more "MR !{iid}" chips. Each chip has a colored dot: green = approved, yellow = waiting for review, red = changes requested. Tasks with no linked MR show no chips (or a neutral placeholder).
result: [pending]

### 9. MR Attention: Linked Task Badge
expected: In the MR Attention tab, each MR row that is linked to a Jira issue shows the issue key (e.g. "PROJ-7") as a badge or label next to the MR title.
result: [pending]

### 10. Status Transition via Popover
expected: In My Tasks, clicking the status badge on a task row opens a popover with available Jira transitions (e.g. "Start Progress", "Done"). Selecting a transition immediately updates the status badge optimistically, and the change is sent to Jira. If the request fails, the badge reverts with an error message inline.
result: [pending]

### 11. Inline Comment on Task
expected: Clicking the comment button on a task row expands an inline textarea below the row. The textarea is auto-focused. Typing a comment and clicking Submit posts it to Jira. The composer then collapses. Clicking Cancel collapses it without posting. Submit is disabled when the textarea is empty.
result: [pending]

## Summary

total: 11
passed: 0
issues: 1
pending: 10
skipped: 0

## Gaps

- truth: "Dashboard renders with full Tailwind/CSS styling — tabs, badges, layout all visually styled"
  status: failed
  reason: "User reported: the app is missing styles"
  severity: major
  test: 1
  artifacts: []
  missing: []
