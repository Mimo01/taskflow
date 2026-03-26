---
phase: quick-260326-j2q
plan: "01"
subsystem: sidebar, saved-filters
tags: [refactor, sidebar, hooks]
dependency_graph:
  requires: []
  provides: [useSavedFilterSync hook, clean Sidebar without saved filters]
  affects: [taskflow/src/components/app/Sidebar.tsx, taskflow/src/main.tsx]
tech_stack:
  added: []
  patterns: [side-effect hook extracted from component, polling hooks wired in AppLayout]
key_files:
  created:
    - taskflow/src/hooks/useSavedFilterSync.ts
  modified:
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/main.tsx
decisions:
  - Saved filter fetch relocated to AppLayout-level hook so data remains available to SavedFiltersWidget, CommandPalette, SprintBoardTab without the sidebar rendering
metrics:
  duration: ~5 minutes
  completed: 2026-03-26
  tasks_completed: 2
  files_modified: 3
---

# Phase quick-260326-j2q Plan 01: Remove Saved Filters from Sidebar Summary

**One-liner:** Extracted favourite filter fetching into `useSavedFilterSync` hook wired in AppLayout, removing the saved filters section and all related imports from Sidebar.tsx.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract saved filter sync hook and wire into app layout | c853baf | taskflow/src/hooks/useSavedFilterSync.ts, taskflow/src/main.tsx |
| 2 | Remove saved filters rendering and unused imports from Sidebar | 16f45ba | taskflow/src/components/app/Sidebar.tsx |

## What Was Built

- **`useSavedFilterSync.ts`** — new hook that fetches Jira favourite filters via `useQuery` and syncs them to the saved filter store via `useEffect`. Mirrors the logic previously embedded in Sidebar.tsx. Uses `staleTime: 2 * 60 * 1000` and `enabled: !!jiraBaseUrl` guards.
- **`main.tsx`** — calls `useSavedFilterSync()` after `useCustomFieldDiscovery()` in AppLayout, ensuring the store is populated for all consumers.
- **`Sidebar.tsx`** — removed the `{jiraBaseUrl && !sidebarCollapsed && ...}` JSX block, removed `useQuery`, `useEffect`, `SavedFilterList`, `fetchFavouriteFilters`, `readSecret`, `useAuthStore`, and `useSavedFilterStore` imports.

## Verification

- `npx tsc --noEmit` — no errors
- `npx vitest run src/components/SavedFilterList.test.tsx` — 5/5 tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- taskflow/src/hooks/useSavedFilterSync.ts — FOUND
- taskflow/src/components/app/Sidebar.tsx — FOUND (saved filters removed)
- taskflow/src/main.tsx — FOUND (useSavedFilterSync called)
- Commit c853baf — FOUND
- Commit 16f45ba — FOUND
