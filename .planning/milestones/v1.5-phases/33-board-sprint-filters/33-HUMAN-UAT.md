---
status: partial
phase: 33-board-sprint-filters
source: [33-VERIFICATION.md]
started: 2026-03-23T10:30:00Z
updated: 2026-03-23T10:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sprint goal banner renders at runtime
expected: A compact inline strip with Target icon and truncated goal text appears above the filter bar when the active sprint has a goal field set; no banner renders when goal is absent
result: [pending]

### 2. Quick filter chip toggle narrows the board
expected: Clicking a Jira board quick filter chip applies client-side JQL evaluation and removes non-matching cards from swimlanes; all active chips AND together
result: [pending]

### 3. Saved filter click-to-apply constrains the sprint board
expected: Clicking a saved filter in the Sidebar or selecting one in the command palette sets activeFilterId, the SprintBoardTab parses the JQL, and only matching issues remain visible; an active-filter chip appears with an X to dismiss
result: [pending]

### 4. Save Filter dialog creates a Jira filter
expected: Activating filters in the filter bar shows a Save Filter button; clicking it opens the dialog; submitting calls createJiraFilter; the new filter appears in the Saved Filters sidebar section immediately
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
