---
phase: 07-story-subtask-hierarchy-mr-subtask-filter
plan: "02"
subsystem: ui
tags: [react, jira, sprint-board, hierarchy, collapse, badge, lucide-react]

# Dependency graph
requires:
  - phase: 07-story-subtask-hierarchy-mr-subtask-filter plan 01
    provides: SprintBoardTab.test.tsx RED stubs for HIER-02 and SprintBoardTab infrastructure tests
provides:
  - TaskCard extended with subtaskCount/isExpanded/onToggle/isSubtask props
  - SprintBoardTab boardGroups memo grouping stories and subtasksByParent
  - Per-story collapse state (expandedStories useState)
  - Column headers count stories only (not subtasks)
  - Subtask sections collapsed by default, expand via chevron click
  - Orphan subtasks silently dropped (no parent in sprint)
affects:
  - 07-03 (MR subtask filter relies on SprintBoardTab being stable)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - boardGroups useMemo pattern: partition issues into stories/subtasks, build subtasksByParent Map, orphans dropped at memo level
    - expandedStories standalone useState: collapse state decoupled from query cache to survive 60s refetch
    - Chevron toggle via TaskCard onToggle callback with e.stopPropagation()

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx

key-decisions:
  - "Column count derives from boardGroups.stories only — subtasks never counted in column headers"
  - "expandedStories starts as empty Set (all collapsed) — default collapsed per HIER-02 spec"
  - "Empty-state guard uses boardGroups.stories.length — handles sprint with only orphan subtasks edge case"
  - "SubtasksByParent Map keyed by parent.key — storyKeySet.has() guard enforces orphan drop"

patterns-established:
  - "boardGroups memo pattern: partition data into stories + subtasksByParent Map — reuse in future hierarchy UI"
  - "isSubtask TaskCard variant: ml-4 border-l-2 border-l-muted for visual nesting without new component"

requirements-completed: [HIER-02, HIER-03]

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 7 Plan 02: Story/Subtask Hierarchy UI Summary

**Sprint Board grouped by story with collapsible subtask sections, orphan drop via boardGroups memo, and TaskCard chevron/badge extension**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T23:46:19Z
- **Completed:** 2026-03-12T23:48:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Turned 4 RED HIER-02 SprintBoardTab tests GREEN — all 7 tests now pass
- TaskCard extended with subtaskCount chip (Badge), chevron button (ChevronDown/ChevronRight), and isSubtask left-indent variant — all new props optional, existing callers unaffected
- SprintBoardTab restructured with boardGroups memo partitioning stories vs subtasks, expandedStories standalone collapse state, and story-anchored column rendering — orphan subtasks silently dropped at memo boundary

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend TaskCard with subtask count chip, chevron, and isSubtask variant** - `dd1d181` (feat)
2. **Task 2: Restructure SprintBoardTab with boardGroups memo and per-story collapse** - `9b4af6e` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/TaskCard.tsx` - Extended props: subtaskCount, isExpanded, onToggle, isSubtask; Badge chip + chevron render block; isSubtask wrapper cn() variant
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` - JiraIssue import; expandedStories useState + toggleStory; boardGroups useMemo; columns derived from stories; story-anchored column rendering with subtask expansion

## Decisions Made
- Column header count uses `colStories.length` (stories only), not `colIssues.length` — subtasks must not inflate column counts per HIER-02 spec
- Empty-state guard changed from `data.length === 0` to `boardGroups.stories.length === 0` — correctly handles the edge case where sprint contains only orphan subtasks
- `expandedStories` is standalone `useState` (not derived from query) — collapse state survives the 60s refetch interval

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- TaskCard and SprintBoardTab are ready for Plan 03 (MR subtask filter integration)
- boardGroups memo provides the storyKeySet pattern reusable for any future hierarchy filtering
- All 7 SprintBoardTab tests green; 2 pre-existing failures (MyTasksTab, ReleasesTab) unchanged

---
*Phase: 07-story-subtask-hierarchy-mr-subtask-filter*
*Completed: 2026-03-12*
