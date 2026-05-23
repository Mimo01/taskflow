---
phase: quick-7
plan: 7
subsystem: sprint-progress
tags: [ui, table, jira, sprint, assignee]
dependency_graph:
  requires: []
  provides: [QUICK-7]
  affects: [SprintProgressTab]
tech_stack:
  added: []
  patterns: [issuetype.subtask boolean check, two-loop assignee map pattern]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/SprintProgressTab.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.test.tsx
decisions:
  - "Use issuetype.subtask boolean (not name comparison) — consistent with existing project convention"
  - "Second loop over all issues for subtask counts (not inline in stories loop) — clean separation"
  - "Stories column counts parent stories (issuetype.subtask=false), all statuses included"
metrics:
  duration: ~5 min
  completed: 2026-03-12
  tasks_completed: 1
  files_changed: 2
---

# Quick Task 7: Add Stories and Subtasks Columns to Sprint Progress Assignee Table

**One-liner:** Assignee breakdown table gains Stories and Subtasks count columns using issuetype.subtask boolean to distinguish issue types.

## What Was Built

The per-assignee breakdown table in SprintProgressTab now has 6 columns:
**Assignee | Stories | Subtasks | To Do pts | In Progress pts | Done pts**

Previously the table only showed the 4 pts columns. The new Stories column counts parent stories (issuetype.subtask === false) assigned to each person regardless of status. The Subtasks column counts subtasks (issuetype.subtask === true) assigned to each person.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| RED  | Add failing SPPG-07 tests + update SPPG-03 cell indices | 2c96abc |
| GREEN | Implement stories/subtasks fields + JSX columns | ded80fa |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing tests broke due to ambiguous text matches**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Adding Stories column (value=2) alongside To Do count (value=2) caused `screen.findByText('2')` to throw "Found multiple elements". Same for `findByText('1')`.
- **Fix:** Changed `findByText('2')` and `findByText('1')` to `findAllByText('2')` / `findAllByText('1')` — these tests just verify data loaded, not specific cell values.
- **Files modified:** taskflow/src/routes/dashboard/SprintProgressTab.test.tsx
- **Commit:** ded80fa (included in implementation commit)

## Self-Check

### Files exist:
- taskflow/src/routes/dashboard/SprintProgressTab.tsx — FOUND
- taskflow/src/routes/dashboard/SprintProgressTab.test.tsx — FOUND

### Commits exist:
- 2c96abc — RED state (failing tests)
- ded80fa — GREEN state (implementation)

## Self-Check: PASSED
