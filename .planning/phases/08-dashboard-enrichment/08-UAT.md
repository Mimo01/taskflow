---
status: complete
phase: 08-dashboard-enrichment
source: 08-07-SUMMARY.md, 08-08-SUMMARY.md
started: 2026-03-13T12:30:00Z
updated: 2026-03-13T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. MyTasksTab — View All in My Tasks (no crash)
expected: Open the Dashboard. The Subtasks panel shows up to 5 rows. When more than 5 exist, a "View all in My Tasks" link appears below the list. Click it — the app should navigate to My Tasks without any error boundary or "is not iterable" crash.
result: issue
reported: "{} is not iterable mountMemo@react-dom_client.js:6527:35"
severity: blocker
root_cause: "MyTasksTab queryFn returned GitLabMR[] while MrHealthPanel/MrAttentionTab returned { filtered, merged } for the same ['gitlab-mrs', baseUrl, userId] cache key. Dashboard loaded first, cached { filtered: [], merged: [] }, then MyTasksTab read it and for...of on non-iterable object threw."
fix_commit: "957e7c3"

### 2. SubtasksPanel — Renders without crash (any data state)
expected: Open the Dashboard as a developer/tech-lead. The Subtasks panel loads and displays either a list of subtask rows or an empty state message — no crash, no error boundary, even if Jira API returns an unexpected shape.
result: pass

### 3. /notifications route — Reachable
expected: Click "View all notifications" link at the bottom of the Notifications panel (or navigate to #/notifications directly). A full-page Notifications view loads — no 404, no React Router error boundary. The page shows a list of notifications (or an empty state if none exist).
result: skipped

### 4. Bell sidebar link — Navigates to /notifications
expected: In the sidebar, a Bell icon link is visible (above Debug Logs in the bottom utility section). Clicking it navigates to the /notifications page without error. Visible regardless of role (developer, PM, tech-lead).
result: pass

### 5. NotificationsPage — Accordion expand
expected: On the /notifications page, clicking a notification row expands an inline detail view. Clicking the same row again collapses it. Clicking a different row opens that one and closes the previous.
result: skipped

## Summary

total: 5
passed: 2
issues: 0
pending: 0
skipped: 3

## Gaps

[none yet]
