---
phase: quick-2
plan: "01"
subsystem: dashboard, sidebar
tags: [ui, polish, react-query, navigation]
dependency_graph:
  requires: [quick-1]
  provides: [live-dashboard-cards, p4-page-margins, sidebar-work-section]
  affects: [dashboard/index.tsx, Sidebar.tsx, 6 tab components]
tech_stack:
  added: []
  patterns: [useQuery cache-sharing via matching query keys, useEffect for token reads]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
decisions:
  - "fetchFixVersions returns bare JiraFixVersion[] (not a paginated envelope) — cast removed in favour of direct ?? [] fallback"
  - "Sidebar Work label hidden on narrow (w-16) sidebar via hidden md:block — stays clean at icon-only width"
metrics:
  duration_min: 8
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_modified: 8
---

# Quick Task 2: Fix Nav Layout, Add Page Margins, Live Dashboard Summary

**One-liner:** p-4 margins on all 6 route tabs, live React Query cards on Dashboard overview (sprint/MR counts + release), and "Work" section label grouping role-specific sidebar links.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add p-4 margins to 6 tab components + Sidebar Work section | 046c150 | MyTasksTab, SprintBoardTab, MrAttentionTab, SprintProgressTab, WorkloadTab, ReleasesTab, Sidebar.tsx |
| 2 | Wire live data into Dashboard overview cards | 6163cac | dashboard/index.tsx |

## What Was Built

### Task 1 — Page Margins + Sidebar Work Section

All 6 route tab components now have `p-4` on their root div:
- MyTasksTab, SprintBoardTab, MrAttentionTab: `flex flex-col gap-2` → `flex flex-col gap-2 p-4`
- SprintProgressTab, WorkloadTab, ReleasesTab: `flex flex-col gap-3 pt-2` → `flex flex-col gap-3 p-4`

Sidebar now wraps role-specific links in a `<div class="mt-2">` with a "Work" label (`text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block`). Label is hidden at narrow width (w-16 icon-only mode) via `hidden md:block`.

### Task 2 — Live Dashboard Cards

`dashboard/index.tsx` rewritten from static arrays to full React Query implementation:

- Developer: `myTasks` via `['jira-issues', 'my-tasks', project]`, `assignedMrs` via `['gitlab-mrs', baseUrl]`, `reviewerMrs` via `['gitlab-reviewer-mrs-dashboard', baseUrl, userId]`
- PM: `sprintIssues` via `['jira-issues', 'sprint-board', project]`, `fixVersions` via `['jira-fix-versions', project]`
- Token reads via `readSecret` in `useEffect` hooks (same pattern as tab components)
- Loading: `animate-pulse text-muted-foreground` dash
- Error: `text-destructive text-sm` "Error" text
- Developer query keys for myTasks and assignedMrs match tab components exactly — cache shared

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] fetchFixVersions returns bare array, not paginated envelope**
- **Found during:** Task 2
- **Issue:** Plan specified `(fixVersions as { values?: Array<...> })?.values ?? []` cast, but the service's return type is `JiraFixVersion[]` (it already unwraps `.values` internally). TypeScript rejected the cast as non-overlapping types.
- **Fix:** Removed the cast entirely; replaced with `fixVersions ?? []` which is correct given the inferred type.
- **Files modified:** taskflow/src/routes/dashboard/index.tsx
- **Commit:** 6163cac

## Self-Check

### Files exist:
- [x] taskflow/src/routes/dashboard/index.tsx — contains useQuery
- [x] taskflow/src/components/app/Sidebar.tsx — contains "Work"
- [x] All 6 tab files contain p-4

### Commits exist:
- [x] 046c150 — Task 1
- [x] 6163cac — Task 2

## Self-Check: PASSED
