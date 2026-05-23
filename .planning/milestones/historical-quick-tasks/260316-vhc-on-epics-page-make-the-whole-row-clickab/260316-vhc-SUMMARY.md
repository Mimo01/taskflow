---
phase: quick
plan: 260316-vhc
subsystem: ui
tags: [react, click-targets, navigation, ux]

provides:
  - Whole-row clickable epic rows on EpicsPage
  - Whole-row clickable backlog rows on BacklogPage (except checkbox and epic badge)

key-files:
  modified:
    - taskflow/src/routes/dashboard/EpicsPage.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx

key-decisions:
  - "Epic name badge converted from button to span to avoid nested interactive elements inside clickable row"
  - "Backlog summary button converted to span; epic badge retains button with stopPropagation for independent navigation"

requirements-completed: [clickable-rows]

duration: 2min
completed: 2026-03-16
---

# Quick Task 260316-vhc: Clickable Rows Summary

**Whole-row click handlers on EpicRow and BacklogRow for larger click targets and faster navigation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T21:55:40Z
- **Completed:** 2026-03-16T21:57:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- EpicRow: clicking anywhere on the row navigates to epic detail
- BacklogRow: clicking anywhere on the row navigates to story detail
- Checkbox in BacklogRow still toggles selection without navigating (pre-existing stopPropagation)
- Epic badge in BacklogRow still navigates to the epic (stopPropagation added)
- Removed nested interactive elements (buttons inside clickable rows) to fix accessibility

## Task Commits

1. **Task 1: Make EpicRow whole-row clickable** - `151b5a0` (feat)
2. **Task 2: Make BacklogRow whole-row clickable** - `c70bb2d` (feat)

## Files Modified
- `taskflow/src/routes/dashboard/EpicsPage.tsx` - Added onClick + cursor-pointer to tr, converted epic name button to span
- `taskflow/src/routes/dashboard/BacklogRow.tsx` - Added onClick + cursor-pointer to tr, added stopPropagation on epic badge, converted summary button to span

## Decisions Made
- Converted epic name button (EpicsPage) and summary button (BacklogRow) to spans to eliminate nested interactive elements inside clickable rows
- Epic badge in BacklogRow kept as button with stopPropagation since it navigates to a different target (epic vs story)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260316-vhc*
*Completed: 2026-03-16*
