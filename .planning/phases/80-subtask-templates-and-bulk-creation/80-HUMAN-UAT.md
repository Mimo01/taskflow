---
status: partial
phase: 80-subtask-templates-and-bulk-creation
source: [80-VERIFICATION.md]
started: 2026-06-05T10:22:36Z
updated: 2026-06-05T10:22:36Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Template Persistence Across Restart
expected: Open Settings > Subtask Templates; create 2 templates with different names and rows; quit the app completely and reopen; navigate back. Both templates appear with their original names, row counts, and field values unchanged.
result: [pending]

### 2. Placeholder Chip Rendering in Modal
expected: Open a parent issue with assignee + priority set; click "Bulk Create Subtasks"; select a template with @inherit, @current, @unassigned assignee rows. @inherit shows blue chip "@inherit → {Parent Assignee Name}"; @current shows violet chip "@current → {Your Display Name}"; @unassigned shows muted chip "@unassigned".
result: [pending]

### 3. End-to-End Bulk Creation (Full Success Path)
expected: Apply a template; reorder rows; click "Create Subtasks". Progress shows "Creating N subtasks…" per row; rows complete in displayed (reordered) order; on full success modal closes; parent subtask list refreshes showing the new subtasks.
result: [pending]

### 4. Partial Failure and Retry (validates CR-01 fix)
expected: Force a failure on one middle row (rows 0,1 succeed, row 2 fails); create. Modal stays open; the failed row shows a red icon and an error message naming THAT row's title specifically (not row 0); already-created rows show green icons; "Retry Failed" re-attempts only the failed row and never duplicates the succeeded ones.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
