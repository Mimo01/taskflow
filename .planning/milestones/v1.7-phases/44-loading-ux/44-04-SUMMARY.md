---
phase: 44-loading-ux
plan: "04"
subsystem: loading-ux
tags: [typescript, requirements-tracking, gap-closure]
dependency_graph:
  requires: []
  provides: [clean-typescript-compilation, accurate-requirements-tracking]
  affects: [ci-pipeline, REQUIREMENTS.md]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.tsx
    - taskflow/src/routes/dashboard/EpicsPage.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.tsx
    - .planning/REQUIREMENTS.md
decisions:
  - "LOAD-03 deferred: skeleton infra exists in VirtualizedSwimlanes but subtasksLoading always false — requires Phase 45 query split to activate"
  - "LOAD-04 partial: epic column header progressive loading works via separate jira-epics-basic query; per-row badges use same query as rows so no per-row skeleton possible"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_changed: 9
requirements-completed: []
---

# Phase 44 Plan 04: Gap Closure — TS Compilation Fix + Requirements Tracking Summary

Removed unused `refetch` variable from useQuery destructurings in 8 dashboard view files, fixing 8 TS6133 compilation errors and restoring `npx tsc --noEmit` to exit 0. Updated REQUIREMENTS.md to accurately reflect LOAD-03 as deferred (infra blocked on query split) and LOAD-04 as partial (header-level progressive loading works).

## What Was Built

### Task 1: Remove unused refetch from 8 view files

The migration from `refetch()` to `queryClient.invalidateQueries()` in earlier plans had removed all usages of `refetch` but left it in the `useQuery` destructuring. With `noUnusedLocals: true` in tsconfig, this caused 8 TS6133 errors. The fix removed `refetch` from the destructuring in each file:

- `SprintBoardTab.tsx` — inline `const { ..., refetch }` → `const { ... }`
- `BacklogPage.tsx` — multi-line destructuring, removed `refetch,` line
- `MyTasksTab.tsx` — multi-line destructuring, removed `refetch,` line
- `WorkloadTab.tsx` — inline destructuring, removed `, refetch`
- `SprintProgressTab.tsx` — inline destructuring, removed `, refetch`
- `EpicsPage.tsx` — multi-line destructuring, removed `refetch,` line
- `ReleasesTab.tsx` — multi-line destructuring, removed `refetch,` line
- `MrAttentionTab.tsx` — multi-line destructuring, removed `refetch,` line

Note: `refetchInterval` and `refetchIntervalInBackground` query options were not modified — only the destructured `refetch` function variable was removed.

### Task 2: Update REQUIREMENTS.md for LOAD-03 and LOAD-04

**LOAD-03** updated from `[ ] Pending` to `[ ] Deferred — Infra complete, deferred pending query split`. The skeleton infrastructure in VirtualizedSwimlanes exists (lines 326-327, 413-414 render skeletons when subtasksLoading=true), but subtasksLoading is always hardcoded false because fetchSprintIssues returns both stories and subtasks in a single query. Phase 45 query parallelization is required to activate this.

**LOAD-04** updated from `[ ] Pending` to `[~] Partial`. The epic column header correctly shows a Skeleton while the separate jira-epics-basic query is pending (allEpicsPending=true). Per-row epic badges are not progressively loaded because epicNames comes from the same query as row data — no separate query exists for per-row progressive loading.

Traceability table updated to match checkbox states.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` exits 0 | PASS |
| 798 tests pass, 0 failures | PASS |
| No `refetch` in useQuery destructurings | PASS |
| LOAD-03 contains "Infra complete, deferred" | PASS |
| LOAD-04 contains "Partial" | PASS |
| LOAD-01 still `[x]` | PASS |
| LOAD-05 still `[x]` | PASS |
| Traceability table LOAD-03 contains "Deferred" | PASS |
| Traceability table LOAD-04 contains "Partial" | PASS |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | de958cd | fix(44-04): remove unused refetch from useQuery destructurings in 8 view files |
| Task 2 | 9f3d37c | docs(44-04): update REQUIREMENTS.md to reflect LOAD-03 deferred and LOAD-04 partial status |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — FOUND (modified, no unused refetch)
- `.planning/REQUIREMENTS.md` — FOUND (LOAD-03 deferred, LOAD-04 partial, traceability updated)
- Commits de958cd and 9f3d37c — VERIFIED in git log
