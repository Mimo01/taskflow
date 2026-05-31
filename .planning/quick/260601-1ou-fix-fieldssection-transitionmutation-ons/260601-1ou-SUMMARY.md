---
phase: quick-260601-1ou
plan: "01"
subsystem: issue-detail / create-edit-issue
tags: [query-invalidation, sprint-board, greenhopper, dead-code-removal]
dependency_graph:
  requires: []
  provides: [sprint-board-refresh-on-transition]
  affects: [FieldsSection, useIssueMutations]
tech_stack:
  added: []
  patterns: [invalidateGhAllData, React Query cache invalidation]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
    - taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx
decisions:
  - "Keep both invalidateGhAllData and invalidateGhBacklogData in transitionMutation.onSettled — they cover distinct query keys (['gh-all'] vs ['gh-backlog'])"
metrics:
  duration: "~5 min"
  completed: "2026-06-01"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 3
---

# Phase quick-260601-1ou Plan 01: Fix FieldsSection transitionMutation onSettled Summary

**One-liner:** Added `invalidateGhAllData` to `transitionMutation.onSettled` so sprint board columns refresh after a status change, and removed dead `['jira-sprint-stories']` / `['jira-issues','sprint-board']` query keys from both files.

## What Was Built

After a status transition in the issue detail panel, the sprint board now refreshes because the GH all-data query (`['gh-all']`) is properly invalidated. Dead query keys that had no producers since the Phase 73/74 GreenHopper cutover were removed from three handlers across two files.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Fix transitionMutation.onSettled + remove dead keys from both files | 2ac516c7 |

## Changes Made

### FieldsSection.tsx
- Added `invalidateGhAllData` to import from `@/services/jira`
- `transitionMutation.onSettled`: removed `['jira-issues','sprint-board']` and `['jira-sprint-stories']` dead calls; added `invalidateGhAllData(queryClient, boardId)` / `invalidateGhAllData(queryClient)` block (kept `invalidateGhBacklogData` — distinct key)
- `sprintMoveMutation.onSettled`: removed dead `['jira-sprint-stories']` line

### useIssueMutations.ts
- `createMutation.onSuccess`: removed `['jira-issues','sprint-board']` line
- `editMutation.onSuccess`: removed `['jira-issues','sprint-board']` and `['jira-sprint-stories']` lines; `invalidateGhBacklogData` retained (still valid)

### IssueDetailPage.progressive.test.tsx (deviation — Rule 1 auto-fix)
- Added `invalidateGhAllData: vi.fn()` to the `@/services/jira` mock; the new import caused a Vitest "no export defined on mock" error during pre-commit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock missing invalidateGhAllData**
- **Found during:** Task 1 (pre-commit hook vitest run)
- **Issue:** `IssueDetailPage.progressive.test.tsx` mocks `@/services/jira` as an explicit object; the new `invalidateGhAllData` import in `FieldsSection.tsx` caused Vitest to throw "No 'invalidateGhAllData' export is defined on the mock" at test runtime
- **Fix:** Added `invalidateGhAllData: vi.fn()` to the mock object alongside the existing `invalidateGhBacklogData: vi.fn()`
- **Files modified:** `taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx`
- **Commit:** 2ac516c7 (included in same commit)

## Verification

- `grep` for `jira-sprint-stories` and `jira-issues.*sprint-board` in both modified files returns 0 lines
- `invalidateGhAllData` appears on lines 31, 265, 266 of FieldsSection.tsx
- `npm run check` (biome + tsc): clean, 438 files checked
- `vitest run`: 1663 passed, 2 skipped, 0 failures

## Self-Check: PASSED

- [x] `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` — exists and modified
- [x] `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts` — exists and modified
- [x] Commit `2ac516c7` — verified in git log
