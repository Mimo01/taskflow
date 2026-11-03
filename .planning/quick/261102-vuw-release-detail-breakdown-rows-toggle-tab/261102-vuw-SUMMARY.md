---
phase: quick-261102-vuw
plan: 01
subsystem: release-detail
tags: [filters, graphs, accessibility]
key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/useTaskIssueFilters.ts
    - taskflow/src/routes/dashboard/release-detail/graphs/rowToggle.tsx
  modified:
    - taskflow/src/routes/dashboard/release-detail/taskTableFilters.ts
    - taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTypeWaffle.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
completed: 2026-11-02
---

# Quick 261102-vuw: Breakdown rows toggle Issues table filters

By status / By type / By assignee rows on the release detail page are now native buttons that toggle the matching column filter of the Issues table, via one release-scoped lifted filter hook.

## What changed
- `toggleFilterValues` / `isFilterGroupActive` (pure) in taskTableFilters.ts; group toggle for the merged Done row.
- `useTaskIssueFilters(scope)`: lifted status/type/assignee Sets, stale scope reads as empty (new release starts clean).
- Bucket rows carry exact filter keys (`filterValues` on status rows, `filterValue` on type rows; merged Done row carries all collapsed names).
- `UnifiedTaskTable` accepts optional `issueFilterState` (falls back to its own hook).
- Graph rows: shared `rowToggleProps` helper; active = `bg-muted` + `aria-pressed`, other rows `opacity-50`; no geometry change. Assignee key is displayName or `UNASSIGNED_FILTER`. "Other" type row and "+N more" lines stay non-interactive.
- Page wires one hook instance to the 3 graphs and the table.

## Commits
- dacacbef: feat(261102-vuw): lift issue filters into release-scoped hook with group toggle and bucket filter keys
- d5f75df9: feat(261102-vuw): breakdown graph rows toggle the Issues table filters

## Deviations
- Added `graphs/rowToggle.tsx` shared helper (not in plan) to avoid triplicating button/active/dim logic.
- Worktree was reset to the pre-dispatch plan commit ad5b7e29 per the branch check.

## Notes
- Assignee filter is displayName-substring (shared semantics), so a name that is a substring of another person's name also matches that person.
- Scroll-to-table not added (optional follow-up).
- Manual human-check (click rows in the running app) not performed.

## UAT follow-up (ed65c161)

- Row tooltips covered neighbouring rows → now open after 600ms on the right of the row (`TooltipContent` gained a `side` prop).
- "+N more" lines were inert → now a button opening a popover listing every hidden row as an aria-pressed toggle; the trigger shows `bg-muted` when a hidden value is filtered.
