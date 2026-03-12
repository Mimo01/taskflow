---
phase: quick-1
plan: "01"
subsystem: navigation
tags: [routing, sidebar, dashboard, navigation, role-aware]
dependency_graph:
  requires: []
  provides: [flat-routes-for-all-tab-views, role-aware-sidebar, dashboard-overview-page]
  affects: [taskflow/src/main.tsx, taskflow/src/components/app/Sidebar.tsx, taskflow/src/routes/dashboard/index.tsx]
tech_stack:
  added: []
  patterns: [role-conditional-rendering, flat-route-per-view, summary-card-grid]
key_files:
  created: []
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/routes/dashboard/index.tsx
  deleted:
    - taskflow/src/stores/dashboard.store.ts
decisions:
  - "Dashboard/index.tsx falls back to developer cards when role is null (not pm) — consistent with original tab behavior"
  - "dashboard.store.ts deleted entirely — only imported by dashboard/index.tsx which was fully rewritten"
  - "NAV_LINK_CLASS extracted to constant in Sidebar to avoid repeating the long className string across 6 links"
metrics:
  duration: 2 min
  completed: 2026-03-12
  tasks_completed: 2
  files_changed: 4
---

# Quick Task 1: Restructure Navigation — Move Dashboard to Overview Summary Cards

**One-liner:** Promoted 6 dashboard tabs to standalone routes, added role-filtered sidebar nav links, and replaced the tab-based Dashboard with a role-aware summary card overview page.

## What Was Built

### Task 1: Flat routes + role-aware sidebar nav

**main.tsx** — Added 6 new child routes to the `createHashRouter`:
- `/my-tasks` → `<MyTasksTab />`
- `/sprint-board` → `<SprintBoardTab />`
- `/mr-attention` → `<MrAttentionTab />`
- `/sprint-progress` → `<SprintProgressTab />`
- `/workload` → `<WorkloadTab />`
- `/releases` → `<ReleasesTab />`

**Sidebar.tsx** — Replaced the role label placeholder `<div>` with role-conditional `<Link>` items:
- Always shown: Dashboard
- `role === 'developer'`: My Tasks (CheckSquare), Sprint Board (KanbanSquare), MR Attention (GitMerge)
- `role === 'pm'`: Sprint Progress (BarChart2), Workload (Users), Releases (Tag)
- Always shown at bottom: Settings
- Removed `ROLE_LABELS` constant

**dashboard.store.ts** — Deleted. The `DashTab`, `PmDashTab` types and `activeTab`/`pmActiveTab` state are no longer needed since tab state is replaced by URL routing. The store was only imported by `dashboard/index.tsx` which was fully rewritten.

### Task 2: Role-aware Dashboard overview page

**dashboard/index.tsx** — Fully rewritten as a summary card overview:
- Removed all Tabs, TabsList, TabsTrigger, TabsContent imports
- Removed useDashboardStore usage
- Renders a 3-card grid (`grid-cols-1 sm:grid-cols-3`) with `rounded-lg border border-border bg-card p-4` styling
- Developer cards (role !== 'pm'): Active Sprint Tasks, Open MRs, MRs Needing Attention
- PM cards (role === 'pm'): Sprint Completion, Team Workload, Next Release
- All values are static `"—"` placeholders, ready for live data wiring
- Page heading: `<h1 className="text-xl font-semibold">Overview</h1>`

## Commits

| Task | Commit  | Message                                                  |
|------|---------|----------------------------------------------------------|
| 1    | 9486199 | feat(quick-1-01): add 6 flat routes and role-aware sidebar nav |
| 2    | a0b690d | feat(quick-1-02): replace Dashboard tabs with role-aware overview summary cards |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

TypeScript compilation (`npx tsc --noEmit`) passes with zero new errors. The 3 pre-existing errors in unrelated files (`SearchOverlay.test.tsx`, `GitLabStep.tsx`, `JiraStep.tsx`) were present before this task and are out of scope.

## Self-Check: PASSED

- taskflow/src/main.tsx — modified, committed in 9486199
- taskflow/src/components/app/Sidebar.tsx — modified, committed in 9486199
- taskflow/src/routes/dashboard/index.tsx — modified, committed in a0b690d
- taskflow/src/stores/dashboard.store.ts — deleted, committed in 9486199
