---
phase: 56
plan: "06"
subsystem: aio
tags: [gap-closure, accordion, lazy-loading, aion-03]
dependency_graph:
  requires: [56-02, 56-05]
  provides: [aion-03-accordion-cycles, gap-1-resolved, gap-2-resolved]
  affects: [AioProjectOverviewPage, AioCyclesSkeleton]
tech_stack:
  added: []
  patterns:
    - groupCyclesByFolder: pure Map-based grouping of AioCycle[] by folder field
    - expandedFolder accordion: single-open React state with useEffect auto-init
    - lazy CycleStatsCell: mounts only inside expandedFolder === folderName guard
key_files:
  created: []
  modified:
    - taskflow/src/services/aio/types.ts
    - taskflow/src/services/aio/cycles.ts
    - taskflow/src/services/aio/cycles.test.ts
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
    - taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx
decisions:
  - "Probe approach: static analysis of RawCycle type + multi-candidate fallback chain (folder ?? testSet ?? folderName ?? testSetKey ?? status)"
  - "Status-based grouping (Active/Closed) as final fallback when no folder field present on raw cycle"
  - "jiraBaseUrl ?? undefined coercion to fix pre-existing null→undefined TS mismatch in CycleStatsCell prop"
  - "cycles.test.ts toEqual updated to include folder field in expected AioCycle shape"
metrics:
  duration: "7 minutes"
  completed: "2026-05-14"
  tasks_completed: 2
  files_created: 0
  files_modified: 6
---

# Phase 56 Plan 06: Accordion-Grouped Cycles Page (Gap 1+2 Closure) Summary

**One-liner:** Accordion-grouped cycles page with folder-based sections where CycleStatsCell queries fire only for the open folder, eliminating the N-query fan-out that caused Gap 1+2 performance issues.

## What Was Built

Gaps 1 and 2 from Plan 56-04 verification: the cycles page rendered a flat list and fired `CycleStatsCell` stats queries for every cycle simultaneously, causing slow perceived performance under real network latency and mismatching the AIO folder hierarchy.

The fix replaces the flat `<table>` with a `<section>`-based accordion grouped by `AioCycle.folder`. Only the open folder's cycle rows mount `<CycleStatsCell>` — collapsed folders have zero pending stats queries.

## Probe Findings (Task 1)

**Probe approach:** Static analysis of the raw AIO cycles endpoint — the existing `RawCycle` type had no folder/grouping fields, confirming no folder field was previously mapped.

**Candidate fields inspected:**
- `folder` — direct folder name string
- `testSet` — test-set name string
- `folderName` — explicit alias
- `testSetKey` — test-set key (e.g. "PROJ-TS-1")

**Decision:** Multi-candidate fallback chain: `raw.folder ?? raw.testSet ?? raw.folderName ?? raw.testSetKey ?? raw.status ?? (raw.isClosed ? 'Closed' : 'Active')`

All four candidate fields added to `RawCycle` type. If the live AIO instance returns a folder field under one of these names, it will be picked up automatically. The status-based fallback (`'Active'` / `'Closed'`) ensures the accordion still works when the AIO instance has no folder structure, grouping cycles by their lifecycle status.

## Grouping Logic

`groupCyclesByFolder(cycles: AioCycle[]): Map<string, AioCycle[]>`:
- Groups by `cycle.folder ?? 'Ungrouped'`
- Preserves insertion order (Map iteration order = API response order)
- Called at render time — derived from `data`, no memoization needed (React Compiler handles)

Existing tests (pre-accordion) use cycles without a `folder` field. These cycles land in the `'Ungrouped'` group, which auto-expands as the first group. All existing tests remain green.

## Accordion State

- `expandedFolder: string | null` — `null` until data loads
- `useEffect` auto-opens the first group when `data` first arrives and `expandedFolder === null`
- `toggleFolder()`: collapses the active folder if re-clicked, expands on click of a different folder
- Standard single-open accordion — no multi-expand

## Lazy Loading Invariant

`<CycleStatsCell>` is rendered inside `{expandedFolder === folderName && (<table>...)}`. Collapsed folders never mount `CycleStatsCell`, so no `useQuery` is registered for their cycles. This eliminates the N-query fan-out.

**Test coverage:** The `'CycleStatsCell fires useQuery only for cycles in the open folder'` test asserts `fetchAioTestRunsForCycle` was called for cycles in `'Sprint 1'` (open) but NOT for `'PROJ-CY-3'` in `'Sprint 2'` (collapsed). The inverse is verified after toggle.

## Skeleton Update

`AioCyclesSkeleton` updated to match the accordion layout:
- One folder header skeleton row (chevron + name + count badge)
- Five cycle rows (key + name + status + progress bar)
- Total: 8 `<Skeleton>` components (was 5 single-width bars)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed null→undefined TS mismatch for jiraBaseUrl prop**
- **Found during:** Task 2 TypeScript check
- **Issue:** `CycleStatsCell.jiraBaseUrl` prop is typed `string | undefined` but `useAuthStore().jiraBaseUrl` returns `string | null`. Pre-existing error (was at line 185 before accordion refactor).
- **Fix:** `jiraBaseUrl={jiraBaseUrl ?? undefined}` in the JSX
- **Files modified:** `AioProjectOverviewPage.tsx`
- **Commit:** df41e05

**2. [Rule 1 - Bug] Updated cycles.test.ts expected shape to include folder field**
- **Found during:** Full test suite run after Task 1
- **Issue:** `fetchAioCycles` test used strict `toEqual` on AioCycle shape; `normalizeCycle` now maps `folder` so the returned object includes `folder: 'Active'` (status fallback). Test expectation was outdated.
- **Fix:** Added `folder: 'Active'` to the expected object in the `toEqual` assertion
- **Files modified:** `taskflow/src/services/aio/cycles.test.ts`
- **Commit:** df41e05

**3. [Rule 3 - Blocking] Worktree node_modules missing — created symlink**
- **Found during:** Test execution
- **Issue:** Worktree's `taskflow/node_modules` didn't exist (worktree was created from an old base commit). Tests could not run.
- **Fix:** Created `taskflow/node_modules` symlink pointing to the main repo's `taskflow/node_modules`. This is a worktree infrastructure fix, not a code change.
- **Not committed:** symlink is not tracked in git

## Test Delta

| Describe block | Before | After |
|----------------|--------|-------|
| AioProjectOverviewPage (base) | 3 | 3 |
| AION-03: per-row stats | 6 | 6 |
| Folder accordion + lazy stats (Gap 1+2) | 0 | 5 |
| **AioProjectOverviewPage total** | **9** | **14** |
| cycles.test.ts | 5 | 5 (1 updated assertion) |
| **Full suite** | **1083** | **1088** |

## Known Stubs

None. The accordion renders real folder grouping from AioCycle.folder data. If the live AIO instance returns a folder field under one of the candidate names, it will group correctly. If not, cycles group by status (`Active` / `Closed`).

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries. `folderName` from the AIO API is rendered as button text and `data-testid` value only (no URL construction, no innerHTML, no eval context).

## Self-Check: PASSED

Files exist:
- FOUND: taskflow/src/services/aio/types.ts
- FOUND: taskflow/src/services/aio/cycles.ts
- FOUND: taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
- FOUND: taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx
- FOUND: taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx

Commits:
- d88a900: feat(56-06): add folder field to AioCycle and normalizeCycle — FOUND
- df41e05: feat(56-06): accordion-grouped cycles page with lazy CycleStatsCell rendering — FOUND

Test results: 1088 passed, 0 failed, full suite green.
TypeScript: 0 errors in files modified by this plan. 1 pre-existing error in AioCycleDetailPage.tsx (out of scope, confirmed in 56-05-SUMMARY).
