---
phase: 28-test-coverage-performance-accessibility
plan: 04
subsystem: ui
tags: [react-virtual, virtualization, performance, tanstack]

# Dependency graph
requires:
  - phase: 27-component-extraction-cleanup
    provides: refactored components (BacklogPage, SprintBoardTab, NotificationPopover)
provides:
  - "@tanstack/react-virtual dependency installed"
  - "Virtualized BacklogPage issue list (fixed 44px rows)"
  - "Virtualized NotificationPopover list (variable height, measureElement)"
  - "Virtualized SprintBoardTab swimlane rows (variable height, measureElement)"
affects: [28-test-coverage-performance-accessibility]

# Tech tracking
tech-stack:
  added: ["@tanstack/react-virtual"]
  patterns: ["useVirtualizer with jsdom/SSR fallback", "VirtualEntry pattern for mixed header+item lists", "measureElement for variable-height virtualization"]

key-files:
  created: []
  modified:
    - taskflow/package.json
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx

key-decisions:
  - "Extracted VirtualizedBacklogTable component (hooks cannot be called inside renderSection function)"
  - "Flat VirtualEntry pattern for NotificationPopover (headers + items in single virtualized list)"
  - "VirtualizedSwimlanes extracted as component for SprintBoardTab swimlane virtualization"
  - "jsdom/SSR fallback: when virtualizer returns 0 items but list has items, render all rows without positioning"
  - "SprintBoardTab scroll element resolved via document.querySelector('main') since scroll parent is in AppLayout"

patterns-established:
  - "useVirtualizer fallback: check virtualItems.length > 0 before using virtualized rendering, else render all"
  - "measureElement + data-index for variable-height items"
  - "VirtualEntry discriminated union for mixed-type virtual lists"

requirements-completed: [PERF-01]

# Metrics
duration: 10min
completed: 2026-03-20
---

# Phase 28 Plan 04: List Virtualization Summary

**Three long-scrolling lists virtualized with @tanstack/react-virtual: BacklogPage (fixed 44px rows), NotificationPopover (variable-height with measureElement), SprintBoardTab (swimlane rows with measureElement)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-20T08:00:26Z
- **Completed:** 2026-03-20T08:10:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed @tanstack/react-virtual and virtualized BacklogPage issue list with fixed 44px row height and overscan 10
- Virtualized NotificationPopover with flat VirtualEntry pattern (group headers + notification items) using measureElement for variable heights
- Virtualized SprintBoardTab swimlane rows using measureElement for variable heights, DragOverlay confirmed outside virtualized container
- All 42 component tests pass (BacklogPage 16, SprintBoardTab 14, NotificationPopover 12); jsdom fallback renders all items when virtualizer has no scroll dimensions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @tanstack/react-virtual and virtualize BacklogPage** - `2afaa24` (feat)
2. **Task 2: Virtualize NotificationPopover and SprintBoardTab swimlanes** - `0102e27` (feat)

## Files Created/Modified
- `taskflow/package.json` - Added @tanstack/react-virtual dependency
- `taskflow/src/routes/dashboard/BacklogPage.tsx` - VirtualizedBacklogTable component with useVirtualizer, fixed 44px rows, overscan 10
- `taskflow/src/routes/notifications/NotificationPopover.tsx` - VirtualizedNotificationList component with flat VirtualEntry pattern, measureElement, estimateSize 64px, overscan 5
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` - VirtualizedSwimlanes component with measureElement, estimateSize 120px, overscan 5, DragOverlay outside virtualizer

## Decisions Made
- Extracted VirtualizedBacklogTable as separate component because useVirtualizer hook cannot be called inside the renderSection function (not a React component)
- Used flat VirtualEntry discriminated union pattern for NotificationPopover to virtualize group headers and notification items together in a single virtualizer instance
- Added jsdom/SSR fallback: when virtualizer returns 0 virtual items (no scroll element dimensions), render all items without positioning to keep tests working
- SprintBoardTab scroll element found via document.querySelector('main') since the scroll container is in AppLayout, not in SprintBoardTab itself
- BacklogRow kept as-is (<tr> element) with inline styles applied via ref callback for absolute positioning within virtualized tbody

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom virtualizer fallback for test compatibility**
- **Found during:** Task 1 (BacklogPage virtualization)
- **Issue:** jsdom has no layout engine; scroll element dimensions are 0, causing useVirtualizer to return 0 virtual items, breaking all 16 BacklogPage tests
- **Fix:** Added fallback logic: when virtualItems.length === 0 but the list has items, render all rows without positioning. Applied same pattern to NotificationPopover and SprintBoardTab
- **Files modified:** BacklogPage.tsx, NotificationPopover.tsx, SprintBoardTab.tsx
- **Verification:** All 42 component tests pass
- **Committed in:** 2afaa24 (Task 1), 0102e27 (Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fallback necessary for test compatibility. No scope creep.

## Issues Encountered
None beyond the jsdom fallback documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three components virtualized, ready for accessibility work in plan 28-05
- 4 pre-existing test failures unrelated to this plan: TopBar.test.tsx (2, LazyStore mock), ConnectionsSection.test.tsx (2, pre-existing)

---
*Phase: 28-test-coverage-performance-accessibility*
*Completed: 2026-03-20*
