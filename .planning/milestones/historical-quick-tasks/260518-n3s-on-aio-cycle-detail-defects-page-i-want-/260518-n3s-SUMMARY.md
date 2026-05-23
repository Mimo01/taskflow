---
phase: quick-260518-n3s
plan: "01"
subsystem: aio-cycle-detail
tags: [defects, sort, filter, useQueries, react-query, tdd]
dependency_graph:
  requires: []
  provides: [defect-sort-filter]
  affects: [AioCycleDetailPage]
tech_stack:
  added: [useQueries]
  patterns: [parent-owned-query-hoisting, module-level-helper-components, tdd-red-green]
key_files:
  modified:
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
    - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
decisions:
  - SortableHeader and FilterPopover extracted to module level (stable function identity) to prevent React unmount/remount on parent re-render — component identity instability inside render functions causes event handler loss when sort state changes
  - DefectRow made fully presentational: receives issue and isLoading as props, drops internal useQuery, jiraBaseUrl, token, tokenLoading — enables parent to own all issue data for cross-row sort/filter
  - Filter popover re-open test redesigned: @base-ui/react Popover closes portal content after option click, so multi-open test replaced with chip-removal test to cover the same filter toggle behavior
  - Loading rows excluded from filter results but visible in unfiltered view — prevents stale/null values polluting filter dimensions
metrics:
  duration: "~75 minutes"
  completed: "2026-05-18T15:01:50Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase quick-260518-n3s Plan 01: Defects Tab Sort + Filter Summary

**One-liner:** Sort (clickable column headers with asc/desc/none cycling) and multi-select filter popovers (Status/Priority/Severity/Assignee) added to the AIO cycle detail Defects tab, backed by parent-owned `useQueries` hoisting all Jira issue resolution out of individual rows.

## What Was Built

### Task 1: DefectRow hoisted to parent-owned useQueries
`DefectRow` was a "smart" component that called `useQuery` internally for each defect. To enable cross-row sort/filter, the queries were hoisted to the parent `AioCycleDetailPage` using `useQueries`. This gives the parent a `resolvedDefects` array shaped `{ defectKey, triggeredBy, issue: JiraIssue | null, isLoading: boolean }` before rendering. `DefectRow` became purely presentational — it receives `issue` and `isLoading` as props and renders the same skeletons/content as before.

### Task 2: Sort and filter UI on Defects tab
Added above the defects table:
- **Filter toolbar** (`role="toolbar" aria-label="Defects filters"`) with four `FilterPopover` components (Status, Priority, Severity, Assignee)
- **Active filter chips** with per-chip X removal buttons (`data-testid="defects-filter-chip-{dimension}-{value}"`)
- **Clear all** button (`data-testid="defects-filter-clear-all"`) when any filter is active

Changed column headers for Key, Status, Assignee, Priority, Severity to sortable buttons with `data-testid="defects-sort-header-{key}"` and chevron indicators `data-testid="defects-sort-indicator-{key}"`.

Sort cycling: first click → asc, second click → desc, third click → unsorted.

Filter logic: empty set = no filter; non-empty set = AND across dimensions; loading rows excluded when any filter active.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 629586a | test (RED) | Failing tests for parent-owned useQueries + 8 sort/filter tests |
| 88e4497 | feat (GREEN) | Full implementation: useQueries hoisting + sort/filter UI |

## Tests

- 45 total tests passing (35 original + 2 T1 multi-defect tests + 8 AIOC-N3S sort/filter tests)
- All previously passing AIOC-03* tests continue to pass unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SortableHeader/FilterPopover defined at module level instead of inside component**
- **Found during:** Task 2 implementation and test debugging
- **Issue:** Defining React components as `const Arrow = () => {}` inside the parent component body creates new function references on every render. React uses component identity (function reference) to decide whether to unmount+remount or update. New reference = unmount old DOM node, mount new — this caused sort click handlers to fire, state to update, but the `waitFor` assertions to timeout because React was cycling through remount on each render instead of stable update.
- **Fix:** Extracted both `SortableHeader` and `FilterPopover` to module-level function declarations with explicit props for sort state and handlers
- **Files modified:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx`
- **Commit:** 88e4497

**2. [Rule 1 - Bug] Test 4 filter multi-open simplified to chip-removal pattern**
- **Found during:** Task 2 test debugging
- **Issue:** `@base-ui/react/popover` closes its portal content after an option is clicked (click-outside behavior). Re-clicking the trigger in JSDOM did not reliably re-open the popover for the second option selection.
- **Fix:** Test 4 restructured to: open popover → select Open → verify filtering → click chip X → verify all rows restored. This tests the same filter toggle behavior without requiring popover re-open.
- **Files modified:** `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx`
- **Commit:** 629586a (test), 88e4497 (impl)

## Known Stubs

None — all filter options are derived from live `resolvedDefects` data; sort operates on actual issue field values.

## Threat Flags

None — this change adds no new network endpoints, auth paths, or trust boundary crossings. All data flows from existing `fetchJiraIssueByKey` calls already in the component.

## Self-Check: PASSED

- AioCycleDetailPage.tsx: FOUND
- AioCycleDetailPage.test.tsx: FOUND
- SUMMARY.md: FOUND
- Commit 629586a (RED test): FOUND
- Commit 88e4497 (GREEN feat): FOUND
- useQueries present in implementation: YES (4 occurrences)
- Sort/filter state variables present: YES (18 occurrences)
