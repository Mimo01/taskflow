---
status: complete
phase: 06-workload-sprint-progress-enrichment
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md
started: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. WorkloadTab table layout
expected: Open the Workload tab on the dashboard. The assignee list should render as a proper table with column headers: Assignee, Tasks, and Pts (story points). Each row shows an assignee with their task count and point total.
result: pass

### 2. WorkloadTab excludes done stories and subtasks from point totals
expected: In the Workload tab, story point totals for each assignee should only count open (non-done) parent stories. Subtasks do not contribute to the Pts column. A done story's points do not appear in the total.
result: issue
reported: "The workload should show all assigned tasks in current sprint, even the ones in done"
severity: major

### 3. WorkloadTab time columns graceful hide
expected: If none of the sprint issues have time estimates, the Est / Spent / Remaining columns should not appear at all. If at least one issue has time data, those three columns appear with formatted time values.
result: pass

### 4. WorkloadTab expand/collapse per-assignee stories
expected: Each assignee row starts collapsed (no story sub-rows visible). Clicking an assignee row reveals per-story sub-rows showing individual story names and their point values. Clicking again collapses them.
result: pass

### 5. SprintProgressTab stacked bar
expected: Open the Sprint Progress tab. The progress bar is now three-colored: a gray segment for To Do, a blue segment for In Progress, and a green segment for Done. Each segment shows its percentage inline (e.g. "33% to do").
result: pass

### 6. SprintProgressTab time summary row
expected: In the Sprint Progress tab, if any sprint issue has time tracking data, a summary row appears showing Total Est / Spent / Remaining totals. If no issues have time data, this row is hidden entirely.
result: pass

### 7. SprintProgressTab per-assignee breakdown table
expected: Below the progress bar in Sprint Progress, a table shows each assignee with three columns: To Do pts, In Progress pts, and Done pts. Rows are sorted alphabetically; issues with no assignee appear as "Unassigned".
result: pass

### 8. SprintProgressTab counts stories only (subtasks excluded)
expected: In the Sprint Progress tab, point totals and bucket counts only reflect parent stories. Subtasks are not counted toward any bucket or point metric (though their time may roll into the time summary row).
result: pass

## Summary

total: 8
passed: 7
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Workload tab shows all assigned stories in the current sprint, including done ones"
  status: failed
  reason: "User reported: The workload should show all assigned tasks in current sprint, even the ones in done"
  severity: major
  test: 2
  artifacts: []
  missing: []
