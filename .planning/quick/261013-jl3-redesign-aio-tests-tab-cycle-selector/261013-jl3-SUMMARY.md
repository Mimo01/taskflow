---
phase: quick-261013-jl3
plan: 01
subsystem: aio-cycles-page
tags: [aio, ui, redesign, pagination, zustand]
requires: []
provides:
  - paginated fetchAioCyclesWithDetail (no 500 cap)
  - persisted Open|All cycle status filter
  - redesigned AIO Cycles folder panel and cycle list
affects:
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
key-files:
  created:
    - taskflow/src/lib/aio-cycle-list.ts
    - taskflow/src/lib/aio-cycle-list.test.ts
    - taskflow/src/routes/dashboard/AioFolderPanel.tsx
    - taskflow/src/routes/dashboard/AioCycleList.tsx
  modified:
    - taskflow/src/services/aio/cycles.ts
    - taskflow/src/services/aio/cycles.test.ts
    - taskflow/src/services/aio/types.ts
    - taskflow/src/stores/aio-cycles-selection.store.ts
    - taskflow/src/stores/aio-cycles-selection.store.test.ts
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx
  deleted:
    - taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx
decisions:
  - "Default and stale-fallback selection is All cycles (0) instead of the first non-empty folder"
  - "Effort assumed to be seconds; Dates/Effort columns render only when data exists"
metrics:
  tasks: 2 of 3 (task 3 is a pending human-verify checkpoint)
  completed: 2026-10-13
---

# Quick 261013-jl3: Redesign AIO Cycles page Summary

AIO Cycles page rebuilt with a searchable folder panel (All cycles root, aggregate counts, subtle aria-current selection) and a one-line-per-row cycle list (status/overdue pill, pass % bar with <=4-row tooltip, conditional Dates/Effort, persisted Open|All filter, whole-row overlay click). Cycle fetch now paginates past 500.

## Commits
- 9c551659 feat(quick-261013-jl3): paginated cycle fetch, Open|All filter store, list helpers
- ad7ca188 feat(quick-261013-jl3): redesign AIO Cycles folder panel and cycle list

## Tasks
1. Data layer (done): fetchAioCyclesWithDetail loops until isLast, advancing startAt by items returned and stopping on empty pages or pages with no new IDs; requests startDate/endDate columns; store `statusFilter` ('open' default); pure helpers in `lib/aio-cycle-list.ts` (toDateKey, isOverdue, formatCycleDates, formatEffort, cycleProgress, progressTooltipRows, aggregateFolderCounts, filterFolderTree, sortCycles) with tests.
2. UI (done): AioFolderPanel, AioCycleList, slimmed AioProjectOverviewPage; page tests updated and extended (22 tests). Full pre-commit suite (biome, tsc, vitest) passed on both commits.
3. Live verification (PENDING human-verify checkpoint, not executed). Items to check against the live AIO instance:
   - "All cycles" loads more than 500 cycles (pagination) and the toolbar open+closed total matches the All cycles badge.
   - Parent-folder aggregate badge equals rows loaded (if the API counts are already cumulative, aggregation double-counts; assumption A3).
   - Dates column appears and matches AIO for a cycle with dates (format and `columns` gating; A1/A4).
   - Effort column matches AIO web UI value (unit assumed seconds; A2).
   - All-closed folder (e.g. "2023 - DONE") shows the notice; "Show them" works; filter and folder survive restart.
   - Visual: subtle selected state, one-line rows in all densities, columns drop Effort -> Owner -> Dates when narrowing, tooltip <= 4 rows, row click opens cycle and Back returns via breadcrumb, key text selectable.

## Deviations from Plan
1. [Structure] Folder row: the plan put the `folder-node-{ID}` testid and aria-current on an empty `absolute inset-0` overlay with a sibling chevron. The plan's own test requirement (`within(getByTestId('folder-node-101')).getByText('3')`) needs the count inside the testid element, so the select button instead holds the row content (icon, name, count) and the chevron is a sibling button absolutely positioned over the select button's left padding (z-10). Still no nested interactive elements.
2. [Behavior] Stale/absent stored selection now falls back to All cycles (0) rather than the first non-empty folder (plan: "When nothing is stored, default to 0"). The test "falls back to first non-empty when persisted ID is stale" was renamed/updated to assert All cycles is selected and the stale entry is cleared. The initial-selection effect also now runs when the folder tree is empty (previously required a non-empty tree).
3. [Cleanup] Removed now-unused helpers from the page (isDescendant, findFirstNonEmptyFolder, buildStatusMap) and deleted unused AioCyclesSkeleton.tsx (grep confirmed no imports).
4. [Test infra] Page test store mock made reactive (useSyncExternalStore) so the Open|All toggle re-renders; react-router `useNavigate` and breadcrumb store are mocked in the page test to assert navigation/breadcrumb push. No production code was altered to fit mocks.
5. `cycleProgress` takes `(summary {totalTests, testRunDistribution}, statusConfig)` rather than a bare distribution, since pass % needs totalTests.

No production behaviour was bent to satisfy tests.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
Created files exist; commits 9c551659 and ad7ca188 exist.
