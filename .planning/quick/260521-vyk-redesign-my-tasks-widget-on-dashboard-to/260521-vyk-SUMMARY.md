---
quick_id: 260521-vyk
status: complete
---

## Summary

Redesigned `DashboardInProgressCard` to show subtasks grouped under their parent story, matching the provided design reference.

## Changes

### `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx`

- Added `LayoutGrid` import as fallback story icon
- After filtering in-progress subtasks, builds an `issueByKey` lookup map from all sprint issues (for parent `iconUrl` resolution)
- Groups the capped-at-3 subtasks by `fields.parent?.key`
- **Parent row**: `LayoutGrid` icon (or `<img>` if Jira iconUrl available) + parent summary (medium weight) + parent key (muted mono, right)
- **Subtask row**: indented (`pl-5`) + `└` tree connector + subtask summary (muted) + subtask key (muted mono, right)
- **Orphan subtasks** (no parent data): rendered as plain key+summary rows for backward compatibility
- Both parent and subtask rows are clickable buttons calling `onIssueClick` with the respective key

### `taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx`

- Extended `makeSprintIssue` fixture with optional `parentKey` / `parentSummary` params
- Added test 6: grouped display — verifies parent row shows summary+key, subtask row shows `└`, both click handlers fire with correct keys

## Result

6/6 tests pass. The widget now provides story context for each in-progress subtask as per the design.
