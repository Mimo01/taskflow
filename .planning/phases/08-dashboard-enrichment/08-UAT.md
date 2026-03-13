---
status: complete
phase: 08-dashboard-enrichment
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md, 08-04-SUMMARY.md, 08-05-SUMMARY.md, 08-06-SUMMARY.md
started: 2026-03-13T12:00:00Z
updated: 2026-03-13T12:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Dashboard Developer Layout
expected: Open the Dashboard as a developer (or tech-lead) role user. You should see a 2×2 grid with four panels: Subtasks (top-left), MR Health (top-right), Sprint Health (bottom-left), Notifications (bottom-right). The old count-card grid (assigned MRs count, sprint issues count, etc.) should be gone.
result: pass

### 2. Dashboard PM Layout
expected: Open the Dashboard as a PM role user. You should see a 2-column grid with only two panels: Sprint Health and Notifications. The Subtasks and MR Health panels should not be visible.
result: pass

### 3. SubtasksPanel — Row Display
expected: The Subtasks panel shows rows where each row has: the Jira issue key (e.g. PROJ-123), the issue title/summary, a status badge (e.g. "In Progress"), and the parent story's name. Clicking a row opens the Jira issue in a new browser tab.
result: pass

### 4. SubtasksPanel — Orphan Filtering
expected: Subtasks whose parent story is NOT in the current sprint are hidden. Only subtasks whose parent key exists in the active sprint board are shown.
result: pass

### 5. SubtasksPanel — Empty State
expected: When there are no open subtasks in the current sprint, the panel shows "No open subtasks in the current sprint" instead of a list.
result: skipped

### 6. SubtasksPanel — Row Cap + View All Link
expected: The panel shows at most 5 subtask rows. When more than 5 exist, a "View all in My Tasks" link appears below the list. Clicking it navigates to the My Tasks route.
result: issue
reported: "Unexpected Application Error! {} is not iterable @http://localhost:1420/src/routes/dashboard/MyTasksTab.tsx:107:19 mountMemo / useMemo / MyTasksTab@...tsx:105:31"
severity: blocker

### 7. MrHealthPanel — Review Health Counts
expected: The MR Health panel shows three counts: "Needs Review", "Approved" (green), and "Changes Requested" (amber). Each count reflects your assigned open MRs categorized by their review status.
result: issue
reported: "i dont see any mr"
severity: major

### 8. MrHealthPanel — Empty State
expected: When you have no open assigned MRs, the panel shows "No open MRs" instead of the count rows.
result: pass

### 9. SprintHealthPanel — Summary Line
expected: The Sprint Health panel shows a summary line like "N days left · N% done · N at-risk". The % done is computed from story points (done points ÷ total points). "Days left" is omitted if there's no active sprint end date.
result: pass

### 10. SprintHealthPanel — At-Risk Items
expected: Below the summary line, the panel lists at-risk stories — these are in-progress stories that have no time logged (timeSpentSeconds == 0). Each entry shows the Jira key and summary title. If no at-risk items exist, the list is hidden.
result: pass

### 11. NotificationsPanel — Last 3 Unread
expected: The Notifications panel shows up to 3 unread notifications, sorted newest-first. Read notifications are not shown in this panel.
result: skipped

### 12. NotificationsPanel — Empty State
expected: When there are no unread notifications, the panel shows "No unread notifications".
result: pass

### 13. NotificationsPanel — Inline Detail Toggle
expected: Clicking a notification row opens an inline detail view within the panel (not a navigation/page change). Clicking the same row again collapses the detail. A different row click opens its detail and collapses the previous.
result: pass

### 14. NotificationsPanel — View All Link
expected: A "View all notifications" link is always visible at the bottom of the panel (even with no notifications). Clicking it navigates to the /notifications route.
result: issue
reported: "Unexpected Application Error! 404 Not Found — React Router error boundary shown, no route matched /notifications"
severity: major

## Summary

total: 14
passed: 7
issues: 3
pending: 0
skipped: 2

## Gaps

- truth: "Clicking 'View all notifications' link navigates to /notifications route without error"
  status: failed
  reason: "User reported: Unexpected Application Error! 404 Not Found — React Router error boundary shown, no route matched /notifications"
  severity: major
  test: 14
  artifacts: []
  missing: []

- truth: "MrHealthPanel shows Needs Review / Approved / Changes Requested counts for assigned open MRs"
  status: failed
  reason: "User reported: i dont see any mr"
  severity: major
  test: 7
  artifacts: []
  missing: []

- truth: "Clicking 'View all in My Tasks' navigates to My Tasks without errors"
  status: failed
  reason: "User reported: Unexpected Application Error! {} is not iterable @MyTasksTab.tsx:107:19 (useMemo / MyTasksTab:105)"
  severity: blocker
  test: 6
  artifacts: []
  missing: []
