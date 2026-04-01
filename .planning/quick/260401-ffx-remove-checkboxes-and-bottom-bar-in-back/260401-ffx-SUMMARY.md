---
phase: quick-260401-ffx
plan: 01
subsystem: backlog-view
tags: [ui, backlog, context-menu, cleanup]
dependency_graph:
  requires: []
  provides: [right-click-sprint-move-on-backlog-rows]
  affects: [BacklogPage, BacklogRow]
tech_stack:
  added: []
  patterns: [ContextMenu render-prop for tr wrapper, optimistic-update with rollback]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/BacklogPage.test.tsx
decisions:
  - "Used ContextMenuTrigger render prop to avoid invalid DOM nesting — ContextMenu wraps <tr> without inserting a <div> between <tbody> and <tr>"
  - "Conditionally render ContextMenu only when onMoveToSprint is provided — rows without handler render plain <tr>"
  - "RowCells extracted to shared helper component to avoid duplicating td markup between the two render paths"
  - "sprintName param kept in handleMoveToSprint signature for future toast notification use"
metrics:
  duration: ~15 minutes
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_modified: 3
---

# Phase quick-260401-ffx Plan 01: Remove Checkboxes and Bottom Bar Summary

**One-liner:** Removed multi-select checkboxes and bulk action bar from backlog view; replaced with per-row right-click context menu using @base-ui ContextMenu with render-prop <tr> wrapping.

## What Was Built

Simplified the backlog UI by eliminating the multi-select interaction model and replacing it with a more natural right-click context menu for moving individual issues to sprints.

### BacklogRow.tsx

- Removed `selected` and `onSelect` props entirely
- Added `sprints?: Array<{ id, name, state }>` and `onMoveToSprint?` props
- Extracted `RowCells` helper component to share td markup between plain and context-menu render paths
- When `onMoveToSprint` is provided: wraps row in `<ContextMenu>` with `<ContextMenuTrigger render={<tr>}>` to avoid invalid HTML (div inside tbody)
- Context menu shows "Move to..." label, separator, sprint list with Active badge for active sprints
- Falls back to "No sprints available" italic label when sprint list is empty
- When `onMoveToSprint` is not provided: renders plain `<tr>` (no context menu overhead)

### BacklogPage.tsx

- Removed `selectedKeys` state, `handleSelect`, `bulkError` state, old bulk `handleMoveToSprint`
- Removed `fetchActiveSprint` query (no longer needed)
- Removed bulk action bar JSX block (fixed bottom bar)
- Added `availableSprints` memo: filters `mergedSprints` to active + future sprints only
- Added new `handleMoveToSprint(issueKey, sprintId, sprintName)` with optimistic cache update and rollback on error
- Updated `VirtualizedBacklogTable` props: removed `selectedKeys`/`onSelect`, added `sprints`/`onMoveToSprint`
- Removed checkbox header `<th>` cell from table header row

### BacklogPage.test.tsx

- Replaced BACK-02 bulk checkbox tests (5 tests) with context menu tests (2 tests)
- Added test: no checkboxes rendered in rows
- Added test: right-clicking a row reveals "Move to..." label
- Added test: selecting a sprint removes issue optimistically
- All 19 tests pass

## Deviations from Plan

None — plan executed exactly as written.

Key implementation note: the plan's reference to `grid-cols` patterns was inapplicable (BacklogRow uses HTML `<table>/<tr>/<td>`, not CSS grid). The table structure was cleaned up correctly by removing the checkbox `<th>` header and `<td>` cell.

## Known Stubs

None.

## Self-Check: PASSED

- taskflow/src/routes/dashboard/BacklogRow.tsx — modified (ContextMenu, no checkboxes)
- taskflow/src/routes/dashboard/BacklogPage.tsx — modified (no bulk bar, no selectedKeys)
- taskflow/src/routes/dashboard/BacklogPage.test.tsx — modified (19 tests pass)
- Commit 702ff84: feat(quick-260401-ffx): remove checkboxes and bulk bar
- Commit 932128e: test(quick-260401-ffx): update BacklogPage tests
- TypeScript: zero errors
- Tests: 19/19 pass
