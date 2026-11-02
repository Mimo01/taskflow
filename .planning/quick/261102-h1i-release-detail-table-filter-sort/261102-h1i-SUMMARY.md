---
phase: quick-261102-h1i
plan: 01
subsystem: release-detail
tags: [release-detail, filters, sort, shared-ui, aio]
requires: [lib/assignee-filter]
provides: [components/ui/table-filter-sort, lib/table-sort, release-detail/taskTableFilters]
affects: [aio-cycle/DefectsList, release-detail/UnifiedTaskTable]
tech-stack:
  added: []
  patterns: [shared FilterPopover/SortableHeader, three-state nextSort, nulls-last comparator]
key-files:
  created:
    - taskflow/src/lib/table-sort.ts
    - taskflow/src/lib/table-sort.test.ts
    - taskflow/src/components/ui/table-filter-sort.tsx
    - taskflow/src/routes/dashboard/release-detail/taskTableFilters.ts
    - taskflow/src/routes/dashboard/release-detail/taskTableFilters.test.ts
  modified:
    - taskflow/src/routes/dashboard/aio-cycle/DefectsList.tsx
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
decisions:
  - "SortableHeader takes a ReactNode label; container-query compact labels stay at call sites (DefectsList CompactLabel, release @max-[860px] Asg.)"
  - "Release table issue filters run before the MR-level BR/MS/label predicate, so they AND together; secondary section is driven only by MR filters"
metrics:
  duration: ~7min
  completed: 2026-11-02
  tasks: 3
  files: 8
---

# Quick 261102-h1i: Release detail table filter + sort Summary

The release detail Issues table now has a search box, Status, Type and Assignee multi-select filters (with Unassigned), active chips, Clear all, and sortable Key, Summary, Assignee and Status headers. These use the same FilterPopover and SortableHeader as the AIO Defects tab, which were moved into `components/ui/table-filter-sort.tsx`.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Extract shared FilterPopover/SortableHeader + table-sort helper; DefectsList adopts them | 2029e4f3 |
| 2 | Release task filter/sort helper (taskTableFilters.ts) | a252e875 |
| 3 | Wire toolbar + sortable header into UnifiedTaskTable | 702b512a |

## Deviations from Plan

**1. [Rule 3 - Blocking] Two existing UnifiedTaskTable tests were re-scoped, without weakening them**
- **Found during:** Task 3
- **Issue:** WR-05 used an unscoped `screen.getByText('Assignee')`. That now also matches the toolbar's Assignee filter button, so it finds two elements and throws. The responsive-tier test read `parentElement` of the header text, but the header text now sits inside the sort `<button>`. The tier classes are still on the header cell, one level up.
- **Fix:** WR-05 asserts inside `task-column-header` (it now checks Status with `getByText` instead of `getAllByText`, which is stricter). The tier test checks the classes on `task-sort-header-{assignee,status}.parentElement`. The `@max-[860px]:sr-only` check on the "Assignee" span is unchanged. No production code changed to satisfy tests.
- **Commit:** 702b512a

**2. [Test detail] Popover options are picked by button role**
- The plan said to click options by `findByText`. Option text such as "In Progress" or "Unassigned" also appears in the row's status pill or assignee cell, so the tests pick the last matching `button` by name. The AIO Defects tests do the same.

Otherwise the plan was executed as written. ExecutionsList.tsx is untouched.

## Verification

- `vitest run src/lib/table-sort.test.ts src/routes/dashboard/release-detail/ AioCycleDetailPage ReleaseDetailPage(.compile)`: 34 files, 725 tests pass. The full suite also passed in the pre-commit hook on every commit.
- `tsc --noEmit`: clean. `biome check` on the touched files: clean.
- `grep -c "matchesTaskFilters\|sortTaskRows" UnifiedTaskTable.tsx` returns 4. DefectsList no longer has local `function FilterPopover` or `function SortableHeader`.
- Not done: the manual in-app check that the sticky header (z-20, unchanged) paints over rows while scrolling. That still needs UAT.

## Known Stubs

None.

## Self-Check: PASSED
- All 5 created files exist. Commits 2029e4f3, a252e875 and 702b512a are on branch worktree-agent-a49f845f3b3f82f54.
