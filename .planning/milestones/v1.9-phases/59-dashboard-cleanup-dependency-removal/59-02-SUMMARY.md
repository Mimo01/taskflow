---
phase: 59-dashboard-cleanup-dependency-removal
plan: "02"
subsystem: routing-sidebar-labels
tags: [workload-removal, routing, sidebar, labels, d-02]
dependency_graph:
  requires: []
  provides: [workload-route-removed, workload-sidebar-removed, workload-labels-removed]
  affects: [routes.tsx, sidebar-items.ts, main.tsx, WikiRenderer.tsx, DiscussionThreads.tsx]
tech_stack:
  added: []
  patterns: [surgical-line-deletion]
key_files:
  created: []
  modified:
    - taskflow/src/routes/routes.tsx
    - taskflow/src/components/app/sidebar-items.ts
    - taskflow/src/main.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/DiscussionThreads.tsx
decisions:
  - "Removed WorkloadTab lazy import and /workload route entry simultaneously to avoid orphaned import"
  - "devVisible Set left untouched (confirmed never contained 'workload')"
metrics:
  duration: "6 minutes"
  completed: "2026-05-20T21:26:40Z"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
  lines_deleted: 7
---

# Phase 59 Plan 02: Scrub /workload Route, Sidebar, and Label Consumers Summary

Surgical removal of all five non-store, non-widget workload references: the lazy import and route entry in routes.tsx, the SIDEBAR_NAV_ITEMS entry and pmVisible Set member in sidebar-items.ts, the routeLabel branch in main.tsx, and the staticLabels entries in WikiRenderer.tsx and DiscussionThreads.tsx. D-02 fully satisfied — the Workload page is now unreachable and unmentioned in all label-resolution paths.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove /workload route entry and lazy import | 59d836d4 | routes.tsx |
| 2 | Remove Workload sidebar nav item and pmVisible reference | 087f496f | sidebar-items.ts |
| 3 | Remove /workload branch from routeLabel and both staticLabels | 92cb8881 | main.tsx, WikiRenderer.tsx, DiscussionThreads.tsx |

## Verification Results

- `grep -rciE 'workload' [all 5 files]` returns 0 across all five files
- Dashboard route `/dashboard` preserved in routes.tsx
- `'aio-projects'` and all 8 other pmVisible entries preserved in sidebar-items.ts
- `/sprint-board` label branch preserved in main.tsx routeLabel()
- `/sprint-board` staticLabel entry preserved in WikiRenderer.tsx and DiscussionThreads.tsx
- `tsc --noEmit` exits 0

## Deviations from Plan

None — plan executed exactly as written. All five surgical deletions matched the exact line content specified in the plan's `<interfaces>` block.

## Known Stubs

None.

## Threat Flags

None. The URL `/workload` now falls through to the existing React Router catch-all (T-59-06 accepted). All three label sources are consistently scrubbed in the same plan (T-59-07 mitigated).

## Self-Check: PASSED

- taskflow/src/routes/routes.tsx — FOUND, zero workload references
- taskflow/src/components/app/sidebar-items.ts — FOUND, zero workload references
- taskflow/src/main.tsx — FOUND, zero workload references
- taskflow/src/routes/dashboard/WikiRenderer.tsx — FOUND, zero workload references
- taskflow/src/routes/dashboard/DiscussionThreads.tsx — FOUND, zero workload references
- Commits 59d836d4, 087f496f, 92cb8881 — all present in git log
