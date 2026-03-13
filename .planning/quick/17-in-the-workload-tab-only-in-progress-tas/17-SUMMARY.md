---
phase: quick-17
plan: "01"
subsystem: workload-tab
tags: [workload, sprint, tasks, done-badge, tdd]
dependency_graph:
  requires: []
  provides: [workload-tab-all-story-count, done-badge-on-story-sub-rows]
  affects: [WorkloadTab]
tech_stack:
  added: []
  patterns: [conditional-count-increment, done-badge-visual-indicator]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
decisions:
  - "Count increment moved outside isDone guard: all stories (in-progress + done) counted in Tasks column"
  - "Points accumulation remains inside !isDone guard (locked decision from Phase 06)"
  - "isDone field added to WorkloadStoryRow interface to drive Done badge rendering"
metrics:
  duration: "~4 min"
  completed_date: "2026-03-13"
  tasks_completed: 1
  files_modified: 2
---

# Phase quick-17 Plan 01: WorkloadTab all-story count + Done badge Summary

**One-liner:** WorkloadTab Tasks column now counts all stories (in-progress + done) with green "Done" badge on done sub-rows; Pts column unchanged (non-done only).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Count all stories in Tasks column and badge done sub-rows | 4d74b93 | WorkloadTab.tsx, WorkloadTab.test.tsx |

## Changes Made

### WorkloadTab.tsx

**Logic change (line ~152):** Moved `existing.count += 1` outside the `if (!isDone)` block so all stories are counted regardless of status. Points accumulation remains inside the guard (locked decision).

**Interface change:** Added `isDone: boolean` field to `WorkloadStoryRow` interface, set during story accumulation loop.

**JSX change:** Added conditional Done badge in story sub-row:
```tsx
{story.isDone && (
  <span data-testid="done-badge" className="ml-1 text-xs text-green-600 font-medium">Done</span>
)}
```

### WorkloadTab.test.tsx

- Updated first test title and assertions: Alice with 1 in-progress + 1 done now expects "2 tasks" (not `/1/`)
- Updated Carol test: previously expected "0 tasks" — now expects "1 task" (done story counted)
- Added new test: "counts done stories in task total" — Alice 2 tasks, 5 pts (not 8)
- Added new test: "done story sub-row has Done badge" — verifies `data-testid="done-badge"` appears only on done story, not in-progress

## Test Results

All 19 WorkloadTab tests pass. Pre-existing failures in MyTasksTab, ReleasesTab, SubtasksPanel are out-of-scope (Tauri invoke errors unrelated to this change).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] WorkloadTab.tsx exists with `existing.count += 1` outside `isDone` guard
- [x] WorkloadStoryRow interface has `isDone: boolean`
- [x] Done badge rendered in story sub-row JSX
- [x] All 19 WorkloadTab tests pass
- [x] Commit 4d74b93 exists

## Self-Check: PASSED
