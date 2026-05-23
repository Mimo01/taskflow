---
phase: quick
plan: 260317-0sw
subsystem: jira-service
tags: [epics, jql, filtering]
dependency_graph:
  requires: []
  provides: [epic-done-filtering]
  affects: [EpicsPage, SprintBoardTab]
tech_stack:
  patterns: [statusCategory JQL filter]
key_files:
  modified:
    - taskflow/src/services/jira.ts
decisions:
  - statusCategory != Done used instead of specific status names to cover all terminal workflow statuses
metrics:
  duration_minutes: 3
  completed: "2026-03-17T00:37:00Z"
  tasks_completed: 1
  tasks_total: 1
---

# Quick Task 260317-0sw: Exclude Done Epics from Listings

Added `statusCategory != Done` JQL filter to both `fetchEpicsBasic` and `fetchEpicsWithEnrichment` so EpicsPage and sprint board epic filter dropdown never show completed epics.

## What Changed

Two JQL queries in `jira.ts` now include `AND statusCategory != Done`:

1. **fetchEpicsBasic** (line 1692) -- used by EpicsPage for the epic list and by SprintBoardTab for the epic name/filter map
2. **fetchEpicsWithEnrichment** (line 1769) -- used for enriched epic views with story counts

The `fetchBacklogView` epic-by-key query (`issuekey in (...)` at line 1614) was deliberately left unchanged -- it resolves epic names/colors for stories that reference specific epics, including Done ones.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 54d7947 | Add statusCategory != Done to epic listing JQL |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- grep confirms exactly 2 new `statusCategory != Done` matches in the epic listing functions (4 total in file; 2 pre-existing in subtask queries)
- `issuekey in` backlog query confirmed unchanged
- TypeScript compiles (pre-existing test type errors unrelated to this change)

## Self-Check: PASSED
