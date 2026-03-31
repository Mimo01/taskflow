---
phase: 47-optimize-backlog-view-performance-with-progressive-loading
plan: "01"
subsystem: backlog
tags: [backlog, virtualization, performance, progressive-loading]
dependency_graph:
  requires: []
  provides: [fetchSprintList, div-based BacklogRow, div-based VirtualizedBacklogTable]
  affects: [BacklogPage, BacklogRow, backlog.ts]
tech_stack:
  added: []
  patterns: [div-based CSS grid virtualization, density-aware estimateSize, per-row Skeleton progressive loading]
key_files:
  created: []
  modified:
    - taskflow/src/services/jira/backlog.ts
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
decisions:
  - "fetchSprintList uses Agile API board/sprint endpoint with state=active,future — same URL pattern as existing fetchBacklogView code"
  - "estimateSize is density-aware (28/36/44px) to match actual rendered row heights and improve virtualizer accuracy"
  - "overscan reduced from 10 to 5 — sufficient buffer for smooth scroll without over-rendering"
  - "epicsLoading Skeleton in epic cell shows h-4 w-14 rounded-full — pill shape matching the epic badge dimensions"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-31"
  tasks_completed: 2
  files_modified: 3
---

# Phase 47 Plan 01: Foundation Components for Progressive Backlog Loading Summary

**One-liner:** Div-based CSS grid BacklogRow and VirtualizedBacklogTable with always-on virtualization and per-row epic Skeleton for LOAD-04 progressive loading.

## What Was Built

### Task 1: fetchSprintList + BacklogRow div conversion (commit `1c60cf1`)

Added `fetchSprintList` to `backlog.ts` — a standalone function that fetches active and future sprints from the Jira Agile board API. This mirrors the inline sprint-list fetch inside `fetchBacklogView` but exposes it as a reusable export for Plan 02's per-section query architecture.

Converted `BacklogRow` from a `<tr>`-based table row to a `<div>`-based CSS grid row:
- `forwardRef<HTMLTableRowElement>` → `forwardRef<HTMLDivElement>`
- All `<tr>/<td>` replaced with `<div>` using `grid grid-cols-[32px_96px_auto_1fr_56px_40px]`
- Added `epicsLoading?: boolean` prop — shows `<Skeleton className="h-4 w-14 rounded-full" />` in epic cell when true and issue has an epic key
- Added `style?: React.CSSProperties` prop — accepts virtualizer absolute positioning

### Task 2: VirtualizedBacklogTable div-based CSS grid (commit `ae57aaf`)

Rewrote `VirtualizedBacklogTable` in `BacklogPage.tsx`:
- Replaced `<table>/<thead>/<tbody>/<tr>/<th>/<td>` with div-based CSS grid using `grid-cols-[32px_96px_auto_1fr_56px_40px]`
- Removed `const useVirtual = false` and all conditional rendering — virtualization is always active
- Removed `renderRow` helper (no longer needed with always-on virtualizer)
- Added density-aware `estimateSize` (compact=28, default=36, comfortable=44px) via `useCallback`
- Reduced `overscan` from 10 to 5
- Updated `rowRefs` type from `Map<string, HTMLTableRowElement>` to `Map<string, HTMLDivElement>`
- Passes `epicsLoading` and `style` props to each `BacklogRow`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stubs or placeholder data.

## Self-Check: PASSED

Files exist:
- `taskflow/src/services/jira/backlog.ts` — FOUND (fetchSprintList exported)
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — FOUND (HTMLDivElement, epicsLoading, style props)
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — FOUND (div-based grid, always-on virtual)

Commits exist:
- `1c60cf1` — feat(47-01): add fetchSprintList to backlog.ts and convert BacklogRow to div-based grid
- `ae57aaf` — feat(47-01): convert VirtualizedBacklogTable to div-based CSS grid with always-on virtualization

TypeScript: zero errors (`npx tsc --noEmit` exits 0).
