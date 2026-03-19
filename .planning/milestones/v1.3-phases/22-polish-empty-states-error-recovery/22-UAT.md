---
status: complete
phase: 22-polish-empty-states-error-recovery
source: 22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md
started: 2026-03-16T18:00:00Z
updated: 2026-03-16T18:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. MyTasksTab Empty State
expected: Navigate to Dashboard > My Tasks tab with no tasks assigned to you (or no active sprint). Should show a ClipboardList icon with "You're all caught up!" message instead of an empty table.
result: skipped
reason: User has tasks assigned, cannot trigger empty state

### 2. SprintBoardTab Empty State
expected: Navigate to Dashboard > Sprint Board tab when there are no sprint issues. Should show a Columns3 icon with "No sprint issues" message.
result: skipped
reason: User has tasks assigned, cannot trigger empty state

### 3. BacklogPage Empty State with Create Issue CTA
expected: Navigate to Backlog page when backlog is empty. Should show an Inbox icon with "Backlog is empty" message and a "Create Issue" button that opens the issue creation flow.
result: skipped
reason: Backlog has tasks, cannot trigger empty state

### 4. MrAttentionTab Empty State
expected: Navigate to Dashboard > MR Attention tab when there are no merge requests needing attention. Should show a GitMerge icon with "No merge requests need attention" message. If GitLab is not connected, should show a "Connect GitLab" CTA.
result: pass

### 5. Error State with Reconnect CTA
expected: Simulate an auth error (e.g., disconnect Jira/GitLab credentials or trigger a 401/403). The affected view should show an ErrorState with a "Reconnect" button that navigates to /settings.
result: skipped

### 6. Stale Data Banner with Retry
expected: Load a dashboard view with data, then trigger an error on the next fetch (e.g., briefly disconnect network). Should show a dismissible banner at the top saying data may be stale, with a "Retry" button. Clicking Retry re-fetches. Clicking Dismiss hides the banner.
result: skipped

### 7. EpicsPage Empty State with Create CTA
expected: Navigate to Epics page when no epics exist. Should show a Layers icon with empty state message and a "Create Epic" button that opens the epic creation dialog.
result: skipped

### 8. NotificationPopover Error State
expected: Open the notification popover when notification fetching has failed. Should show an error state with a retry option instead of an empty list.
result: skipped

### 9. CommandPalette No Results
expected: Open the Command Palette (Mod+K) and type a search query that matches nothing. Should show a SearchX icon with a "no results" message instead of a blank list.
result: pass

## Summary

total: 9
passed: 2
issues: 0
pending: 0
skipped: 7

## Gaps

[none yet]
