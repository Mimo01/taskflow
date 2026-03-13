---
phase: 06-workload-sprint-progress-enrichment
plan: "01"
subsystem: workload-tab
tags: [tdd, ui, react, table, expand-collapse, time-tracking, story-points]
dependency_graph:
  requires: [Phase 5 two-query subtask strategy, useSettingsStore.storyPointsFieldKey]
  provides: [WorkloadTab with table layout, subtask exclusion, time tracking columns, expand/collapse]
  affects: [taskflow/src/routes/dashboard/WorkloadTab.tsx]
tech_stack:
  added: []
  patterns: [useState Set expand/collapse, useMemo partition stories/subtasks, graceful-hide time columns, formatSeconds utility]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
decisions:
  - "Exclude done stories from points and task count — preserves original behavior and matches test expectations"
  - "Use useState<Set<string>> for expand/collapse instead of @base-ui/react Collapsible — simpler, fully testable, no animation requirement"
  - "Attribute subtask time to subtask's own assignee field — natural reading of aggregate-under-assignee rule"
metrics:
  duration_secs: 203
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_modified: 2
---

# Phase 06 Plan 01: WorkloadTab Rewrite Summary

**One-liner:** WorkloadTab rewritten as a table with subtask exclusion, time tracking graceful-hide, and per-assignee expand/collapse using useState Set pattern.

## What Was Built

Replaced the flat div-row WorkloadTab with a proper HTML table. The useMemo block now partitions issues into stories and subtasks using `issuetype.subtask` boolean, aggregates story points and task counts from stories only (excluding done), and rolls subtask time tracking into the assignee bucket. Time columns (Est/Spent/Remaining) are rendered only when `hasTimeData` is true. Each assignee row has a ChevronRight toggle that reveals per-story sub-rows. Story points are read via `storyPointsFieldKey` from `useSettingsStore`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update WorkloadTab tests — extend makeIssue + add WORK-01/02/03 test cases (RED) | c86a115 | WorkloadTab.test.tsx |
| 2 | Rewrite WorkloadTab — useMemo aggregation + table layout + expand/collapse (GREEN) | 3d14ea8 | WorkloadTab.tsx, WorkloadTab.test.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Done stories excluded from points as well as task count**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Research skeleton accumulated points for all non-subtask stories regardless of status. Existing tests expected done stories to be excluded from point totals (Alice with 5pt open + 3pt done story expected 5pt total, not 8pt).
- **Fix:** Added `if (cat === 'done') continue;` at the top of the story accumulation loop, skipping done stories entirely from points, count, and detail rows.
- **Files modified:** taskflow/src/routes/dashboard/WorkloadTab.tsx
- **Commit:** 3d14ea8

**2. [Rule 1 - Bug] Regex word boundary `\b` failed between "task" and digit**
- **Found during:** Task 2 (GREEN phase — test regex refinement)
- **Issue:** Test asserted `/1\s*task\b/i` but `\b` does not match between "k" and "5" since both are `\w` characters. Text "1 task5 pts" caused false assertion failure.
- **Fix:** Changed regex to `/1\s*task/i` (no word boundary needed; the test correctly checks count without boundary issues).
- **Files modified:** taskflow/src/routes/dashboard/WorkloadTab.test.tsx
- **Commit:** 3d14ea8

## Pre-existing Failures (Out of Scope)

`MyTasksTab.test.tsx` and `ReleasesTab.test.tsx` have 1 failing test each. These failures exist on the branch prior to this plan's changes (confirmed via git stash verification). They are not caused by WorkloadTab changes.

## Success Criteria Verification

1. WorkloadTab renders a table (thead with Assignee/Tasks/Pts column headers) — PASS
2. Story point totals match only the non-done stories (subtasks excluded) — PASS
3. Task count column counts only non-done stories — PASS
4. Time columns appear with time data, absent without — PASS
5. All assignee rows start collapsed; clicking reveals per-story sub-rows — PASS
6. All 11 WorkloadTab tests pass — PASS

## Self-Check: PASSED

All files verified present. All commits verified in git history.
