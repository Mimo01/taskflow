---
status: complete
phase: 80-subtask-templates-and-bulk-creation
source: [80-01-SUMMARY.md, 80-02-SUMMARY.md, 80-03-SUMMARY.md, 80-04-SUMMARY.md]
started: 2026-06-06T22:49:57Z
updated: 2026-06-06T22:55:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Settings → Subtask Templates Section
expected: Open Settings. A new "Subtask Templates" nav item (template icon) appears in the left nav after "Workflow". Clicking it shows an empty state with "No templates yet" heading and an outline "New Template" CTA.
result: pass

### 2. Create, Rename, Delete a Template
expected: Click "New Template" — a card appears named "Untitled Template" with the row editor open. Click the name and type a new name; clicking away (blur) saves it. Clearing the name and blurring restores the previous name (never saves empty). The Trash2 delete icon removes the template immediately.
result: pass

### 3. Edit Rows — Fields, Subtask Type, Advanced Expand
expected: With a template's "Edit Rows" open, "+ Add row" appends a blank row (assignee defaults to @inherit). Each row has inline Title, Assignee, Priority, Labels, Due Date, Estimate, Story Points. The subtask-type selector lists only subtask issue types. Clicking "Advanced" expands a panel with Components and any project custom fields.
result: issue
reported: "fields are there but the row layout is broken, it overflows to the right; subtask type shows id instead of the name of the type; the name is squished and with 0 width; the layout overall is broken"
severity: major

### 4. Drag to Reorder Templates and Rows
expected: Grab a template card's drag handle and drop it elsewhere — order updates on drop (no jumpy live reordering, a fixed-height ghost follows the cursor). Same for reordering rows within a template's editor.
result: pass

### 5. Template Persistence Across Restart
expected: Create 2 templates with different names and rows. Quit the app completely and reopen, then return to Settings → Subtask Templates. Both templates appear with their original names, row counts, and field values unchanged.
result: pass

### 6. Bulk Create Subtasks Entry Point
expected: Open any parent issue's detail view. Near "Add subtask" there is a "Bulk Create Subtasks" button (list icon). Clicking it opens a modal titled "Bulk Create Subtasks" with a "Parent: {KEY}" subtitle, a template selector ("No template (ad-hoc)" + saved templates), and a subtask-type selector.
result: issue
reported: "the button is there but it has different styling than the single subtask button, make them match; the modal works but has similar layout problems as the settings"
severity: major

### 7. Placeholder Chip Rendering in Modal
expected: Open a parent issue with assignee + priority set; open Bulk Create and select a template with @inherit / @current / @unassigned assignee rows. @inherit shows a blue chip "@inherit → {Parent Assignee Name}"; @current shows a violet chip "@current → {Your Display Name}"; @unassigned shows a muted "@unassigned" chip.
result: pass

### 8. Skipped-Fields Badge
expected: Select a template that includes a custom field not supported by the target project's subtask type. An amber "N field(s) skipped" badge appears in the toolbar; the unsupported field(s) are dropped from the rows. The badge is hidden when nothing is skipped.
result: skipped
reason: "can't test"

### 9. End-to-End Bulk Creation (Full Success)
expected: Apply a template, reorder a couple of rows, click "Create Subtasks". Progress shows "Creating N subtasks…" per row; rows complete in the displayed (reordered) order. On full success the modal closes and the parent's subtask list refreshes showing the new subtasks.
result: skipped
reason: "can't test"

### 10. Partial Failure and Retry (no duplicates)
expected: Force one middle row to fail (rows 0,1 succeed, row 2 fails). The modal stays open; the failed row shows a red icon with an error naming THAT row's title; succeeded rows show green icons. "Retry Failed" re-attempts only the failed row and never duplicates the already-created ones.
result: skipped
reason: "can't test"

## Summary

total: 10
passed: 5
issues: 2
pending: 0
skipped: 3
blocked: 0

## Gaps

- truth: "Settings row editor lays out inline fields cleanly within the panel width; the Title field is readable (non-zero width) and rows do not overflow horizontally."
  status: failed
  reason: "User reported: row layout is broken, it overflows to the right; the (title) name is squished and with 0 width; the layout overall is broken"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "The Bulk Create Subtasks rows in the modal lay out cleanly within the modal width — same row layout fix as the Settings editor (shared SubtaskTemplateRow component)."
  status: failed
  reason: "User reported: the modal works but has similar layout problems as the settings"
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "The 'Bulk Create Subtasks' button visually matches the single 'Add subtask' button styling (same variant/size)."
  status: failed
  reason: "User reported: the button is there but it has different styling than the single subtask button, make them match"
  severity: cosmetic
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "The subtask-type selector in the Settings row editor displays the human-readable issue-type name, not the raw type id."
  status: failed
  reason: "User reported: subtask type shows id instead of the name of the type"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
