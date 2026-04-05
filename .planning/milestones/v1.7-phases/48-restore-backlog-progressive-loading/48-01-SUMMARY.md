---
phase: 48-restore-backlog-progressive-loading
plan: "01"
subsystem: backlog-view
tags: [progressive-loading, per-section-queries, skeleton, cache-invalidation, cleanup]
dependency_graph:
  requires: []
  provides: [per-section-query-architecture, epicsLoading-prop, correct-cache-invalidation]
  affects: [BacklogPage, BacklogRow, backlog.ts, SprintBoardTab-cache-shared]
tech_stack:
  added: []
  patterns: [useDelayedLoading, useBoardId, per-section-query-split]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/services/jira/backlog.ts
    - taskflow/src/services/jira/backlog.test.ts
decisions:
  - "mergedSprints derived from sprintList + sprintStories groupBy(sprint.id) instead of backlogView.sprints"
  - "epicColorMap uses e.color field (not e.epicColor) — EpicEnriched type uses color"
  - "isAnyLoading = storiesLoading && backlogLoading (both must be loading for global skeleton)"
  - "fetchFutureSprintIssues removed — SC-6 satisfied, no planned callers remain"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-04"
  tasks_completed: 2
  files_changed: 4
---

# Phase 48 Plan 01: Restore BacklogPage Per-Section Query Architecture Summary

Re-integrated per-section query architecture and progressive loading into BacklogPage, replacing the monolithic `fetchBacklogView` with three independent queries sharing cache with SprintBoardTab; added `epicsLoading` prop to BacklogRow for per-row epic skeleton support; removed orphaned `fetchFutureSprintIssues` to satisfy SC-6.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add epicsLoading prop to BacklogRow | baf625c | BacklogRow.tsx |
| 2 | Refactor BacklogPage to per-section queries; remove fetchFutureSprintIssues | a9fd999 | BacklogPage.tsx, backlog.ts, backlog.test.ts |

## What Was Built

### Task 1: BacklogRow epicsLoading prop (LOAD-04)

- Added `epicsLoading?: boolean` to `BacklogRowProps` interface
- Added `Skeleton` import from `@/components/ui/skeleton`
- Added `epicsLoading` parameter to `RowCells` internal function
- Epic badge cell: when `epicKey && epicsLoading` → renders `<Skeleton className="h-4 w-14 rounded-full" />` instead of badge
- Passes `epicsLoading` through `cellsProps` to both render paths (with and without ContextMenu)
- Context menu code untouched

### Task 2: BacklogPage per-section queries (LOAD-01, LOAD-05, QOPT-02, SC-6)

**Per-section queries replacing monolithic fetchBacklogView:**
- `['jira-sprint-stories', ...]` — shared cache with SprintBoardTab via `fetchSprintStories`
- `['jira-sprint-list', boardId, ...]` — canonical board sprint ordering via `fetchSprintList`
- `['jira-backlog-issues', ...]` — unassigned issues via `fetchBacklogIssues`

**Progressive loading (LOAD-01, LOAD-05):**
- `isAnyLoading = storiesLoading && backlogLoading` — global skeleton only when both sources are loading
- `showSkeleton = useDelayedLoading(isAnyLoading)` — 200ms delay prevents flicker on fast loads
- `<BacklogSkeleton />` rendered when `showSkeleton` is true

**Per-row epic skeleton (LOAD-04):**
- `isEpicsLoading = !allEpics && !!activeJiraProject`
- Passed as `epicsLoading={isEpicsLoading}` to `VirtualizedBacklogTable` and through to `BacklogRow`

**mergedSprints rebuilt from sprintList + sprintStories:**
- Groups stories by `story.fields.sprint.id`
- Maps sprintList (filtered to active/future) → sections with grouped issues
- Handles stories without sprint field gracefully

**Cache invalidation fixed (QOPT-02):**
- `handleMoveToSprint` optimistically updates `jira-backlog-issues` and `jira-sprint-stories` caches
- On success: invalidates `jira-sprint-stories`, `jira-backlog-issues`, `jira-sprint-list`
- On failure: rolls back `jira-backlog-issues`, invalidates `jira-sprint-stories`
- Removed stale `jira-issues, sprint-board` and `jira-backlog-view` cache key references

**epicNameMap / epicColorMap (LOAD-04 supporting):**
- Derived from `allEpics` query (not from backlogView)
- Uses `e.color` field from `EpicEnriched` type (correct field name)
- Passed as `epicNames={epicNameMap}` and `epicColors={epicColorMap}` to VirtualizedBacklogTable

**SC-6 cleanup:**
- Removed `fetchFutureSprintIssues` export from `backlog.ts`
- Removed `fetchFutureSprintIssues` import and test block from `backlog.test.ts`

## Verification

- TypeScript: `npx tsc --noEmit` — PASS (no errors)
- Tests: `backlog.test.ts` — 11/11 pass
- No stale patterns: `fetchBacklogView`, `jira-backlog-view`, `jira-issues, sprint-board` — all absent from BacklogPage.tsx
- No stale function: `fetchFutureSprintIssues` absent from backlog.ts and backlog.test.ts
- New patterns confirmed present: `jira-sprint-stories`, `jira-sprint-list`, `jira-backlog-issues`, `useDelayedLoading`, `BacklogSkeleton`, `epicsLoading`

## Deviations from Plan

None — plan executed exactly as written.

The `epicColor` field reference in the plan was corrected to `e.color` (the actual field on `EpicEnriched` type). This was a type-level fix during compilation, not a behavioral deviation.

## Known Stubs

None — all data sources are wired to real queries. Epic name/color maps are derived from the live `allEpics` query cache.

## Self-Check: PASSED

Files exist:
- taskflow/src/routes/dashboard/BacklogPage.tsx — FOUND
- taskflow/src/routes/dashboard/BacklogRow.tsx — FOUND
- taskflow/src/services/jira/backlog.ts — FOUND
- taskflow/src/services/jira/backlog.test.ts — FOUND

Commits exist:
- baf625c — FOUND (feat(48-01): add epicsLoading prop to BacklogRow)
- a9fd999 — FOUND (feat(48-01): refactor BacklogPage to per-section queries)
