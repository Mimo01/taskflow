---
phase: quick-16
plan: "01"
subsystem: workload
tags: [workload, subtasks, worklogs, attribution, jira]
dependency_graph:
  requires: [fetchSprintIssues, readSecret, useAuthStore, useSettingsStore]
  provides: [fetchIssueWorklogs, workload-subtask-nesting, worklog-attribution]
  affects: [WorkloadTab, jira.ts]
tech_stack:
  added: []
  patterns: [TanStack Query secondary useQuery, TDD red-green, subtasksByParent Map, worklogMap Map]
key_files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
    - taskflow/src/services/jira.test.ts
decisions:
  - fetchIssueWorklogs uses apiFetch (not bare fetch) to stay consistent with project auth/logging pattern
  - Worklog attribution only adds stub rows (count=0, pts=0) — does not inflate estSecs/remainSecs (only spentSecs available from worklogs)
  - Orphan subtasks (no parent key in sprint data) are silently dropped per plan spec
  - worklogMap undefined treated as graceful degradation — workload renders without attribution
  - subtasks array initialized to [] on all story rows (never undefined) for safe iteration
metrics:
  duration: "~4 min"
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 16: WorkloadTab Subtask Nesting + Worklog Attribution Summary

**One-liner:** Three-level workload hierarchy (Assignee → Story → Subtask) with worklog-based contributor rows via fetchIssueWorklogs helper.

## What Was Built

### Task 1: fetchIssueWorklogs in jira.ts

Added `fetchIssueWorklogs(baseUrl, token, issueKey): Promise<string[]>` that calls `GET /rest/api/2/issue/{key}/worklog`, deduplicates author displayNames using a Set, and silently returns `[]` on any error. 5 TDD tests added to the existing `jira.test.ts` describe block.

### Task 2: WorkloadTab — Subtask Nesting + Worklog Attribution

**Data model additions:**
- `WorkloadSubtaskRow` interface (key, summary, estSecs, spentSecs, remainSecs)
- `WorkloadStoryRow.subtasks: WorkloadSubtaskRow[]` field added

**Secondary query:** A second `useQuery` with key `['workload-worklogs', project, issueKeys]` fetches worklogs for all sprint issues in parallel. Gracefully skips when `worklogMap` is undefined.

**useMemo changes:**
- `subtasksByParent` Map built from subtask issues keyed by `parent?.key`
- Each story row gets `subtasks: subtasksByParent.get(story.key) ?? []`
- Worklog authors not already in the assignee map get stub rows (count=0, pts=0, stories=[])

**Render changes:**
- Each story row in expanded view is wrapped in `React.Fragment`
- Subtask rows rendered after story row with `data-testid="workload-subtask-row"`, indented to `pl-12`

**4 new tests added:**
1. Subtask nesting: expanding assignee row shows `workload-subtask-row` elements
2. Worklog attribution: Bob in worklogs (not assigned) appears as workload row
3. Count isolation: Bob's worklog row has count=0 and points=0
4. Graceful degradation: fetchIssueWorklogs rejecting for all issues — workload still renders

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `taskflow/src/services/jira.ts` — fetchIssueWorklogs exported
- [x] `taskflow/src/routes/dashboard/WorkloadTab.tsx` — contains `workload-subtask-row`
- [x] `taskflow/src/routes/dashboard/WorkloadTab.test.tsx` — 4 new tests pass
- [x] Commits: 8e7a341 (jira.ts + tests), 36553c8 (WorkloadTab + tests)
- [x] 56 total tests pass across both test files

## Self-Check: PASSED
