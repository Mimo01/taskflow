---
phase: 59-dashboard-cleanup-dependency-removal
plan: "01"
subsystem: dashboard
tags: [deletion, store-migration, widget-system, cleanup]
dependency_graph:
  requires: []
  provides: [dashboard-stub, settings-store-v19, widget-system-removed]
  affects: [settings.store.ts, dashboard/index.tsx, routes.tsx, settings.store.test.ts, Settings.test.tsx]
tech_stack:
  added: []
  patterns: [zustand-additive-migration, atomic-deletion]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/routes/routes.tsx
    - taskflow/src/stores/settings.store.test.ts
    - taskflow/src/routes/settings/Settings.test.tsx
  deleted:
    - taskflow/src/routes/dashboard/widgets/ (11 files + registry.ts)
    - taskflow/src/routes/dashboard/WidgetGrid.tsx
    - taskflow/src/routes/dashboard/WidgetCard.tsx
    - taskflow/src/routes/dashboard/WidgetPicker.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/WorkloadSkeleton.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
decisions:
  - Additive-only v19 migration guard with empty body — no explicit delete needed; Zustand LazyStore drops dashboardLayout implicitly
  - routes.tsx WorkloadTab removal auto-fixed (Rule 1) — import of deleted file would break build at Vite time
metrics:
  duration: "5m"
  completed: "2026-05-20T21:29:39Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 22
requirements_satisfied:
  - REMOVE-01
  - REMOVE-02
---

# Phase 59 Plan 01: Widget System Deletion + Store Migration Summary

Atomically deleted the entire widget-based dashboard system (11 widget components, registry, WidgetGrid/Card/Picker, WorkloadTab/Skeleton), replaced dashboard/index.tsx with a minimal `<div />` stub, migrated settings.store.ts from v18 to v19 with all widget fields/actions/imports removed, and cleaned both affected test files — all in a single buildable state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Atomic widget + store deletion + index.tsx stub | 4b07cd23 | 20 files (18 deleted, 2 modified) |
| 2 | Update widget-aware tests | f5fd3c34 | 2 files modified |

## What Was Built

### Task 1: Atomic widget system + store deletion (4b07cd23)

- Replaced `taskflow/src/routes/dashboard/index.tsx` (118 lines) with exact 3-line stub: `export default function Dashboard() { return <div />; }` — no imports, no props, no logic (D-01)
- Removed from `settings.store.ts`: biome-ignore comment, registry import, `DashboardLayoutItem` interface, `dashboardLayout` field, `setDashboardLayout`/`addDashboardWidget`/`removeDashboardWidget`/`updateWidgetConfig` action implementations, initial state value, and the `dashboardLayout` half of `applyPreset`
- Patched v9 migration block to remove `s.dashboardLayout = getDefaultDashboardLayout(preset)` line
- Bumped persist `version: 18` to `version: 19`
- Added additive `if (version < 19) { /* no new fields */ }` migration guard (D-03)
- Deleted 18 files: all 11 widget components + registry.ts in `widgets/`, plus WidgetGrid/Card/Picker/WorkloadTab/WorkloadSkeleton/WorkloadTab.test
- Removed `WorkloadTab` lazy import and `/workload` route from `routes.tsx` (Rule 1 auto-fix — leaked consumer of deleted file)

### Task 2: Test file cleanup (f5fd3c34)

- Removed registry import block (`DEV_DASHBOARD_PRESET`, `PM_DASHBOARD_PRESET`, `WIDGET_REGISTRY`) from `settings.store.test.ts`
- Deleted entire `describe('settings.store — layout customization (Phase 34)')` block (132 lines, 8 test cases) from `settings.store.test.ts`
- Removed `{ id: 'workload', visible: false }` from `sidebarItems` mock in `Settings.test.tsx`
- Removed `dashboardLayout: []` and four widget action `vi.fn()` mocks from `Settings.test.tsx`
- Both files compile and 40 tests pass with zero widget references

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed WorkloadTab import from routes.tsx**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `routes.tsx` still imported `const WorkloadTab = lazy(() => import('./dashboard/WorkloadTab'))` and had `{ path: '/workload', element: withLazy(WorkloadTab) }` — both reference the deleted WorkloadTab.tsx
- **Fix:** Removed the lazy import declaration and the `/workload` route entry from `routes.tsx` in the same atomic commit as the deletion (D-04 compliant)
- **Files modified:** `taskflow/src/routes/routes.tsx`
- **Commit:** 4b07cd23 (included in the atomic Task 1 commit)

## Verification Results

- `widgets/` directory: absent
- All 6 dashboard component files: absent
- `index.tsx`: 3 lines, no imports, `export default function Dashboard()`, `return <div />`
- `settings.store.ts`: `version: 19`, `if (version < 19)` guard present, zero widget token matches in non-comment lines
- `settings.store.test.ts`: zero widget token matches, layout customization describe block removed
- `Settings.test.tsx`: zero widget token matches, no workload sidebarItem
- Vitest: 40/40 tests pass across both test files
- TypeScript: no code errors in changed files (environment errors from missing worktree node_modules symlink are unrelated to this plan's changes)

## Known Stubs

- `taskflow/src/routes/dashboard/index.tsx` — intentional stub: `return <div />`. Phase 60 overwrites this with the real minimal static dashboard. This is the planned output of D-01; Phase 60 is the next plan in the sequence.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan is purely deletive — it removes surface area rather than adding it. T-59-01 (v9 migration patched to stop writing dashboardLayout) and T-59-02 (atomic deletion ordering) are both satisfied.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| SUMMARY.md exists | FOUND |
| index.tsx stub exists | FOUND |
| settings.store.ts exists | FOUND |
| Task 1 commit 4b07cd23 | FOUND |
| Task 2 commit f5fd3c34 | FOUND |
| widgets/ directory absent | PASS |
