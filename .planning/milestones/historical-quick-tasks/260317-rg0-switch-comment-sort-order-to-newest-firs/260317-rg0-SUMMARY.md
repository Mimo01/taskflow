---
phase: quick-260317-rg0
plan: 01
subsystem: ui
tags: [zustand, comments, sorting, settings]

requires:
  - phase: 18-app-icon-multi-page-settings
    provides: settings store persist pattern with versioned migrations
provides:
  - commentSortOrder setting with newest-first default
  - sorted comments in IssueDetailPage and InlineComment
  - settings toggle in WorkflowSection
affects: []

tech-stack:
  added: []
  patterns: [store migration version bump for new persisted fields]

key-files:
  created: []
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx
    - taskflow/src/routes/dashboard/InlineComment.tsx
    - taskflow/src/routes/settings/WorkflowSection.tsx

key-decisions:
  - "Newest-first via [...comments].reverse() in useMemo -- no API change needed"
  - "Store version bumped 6 -> 7 with migration defaulting to newest"

patterns-established: []

requirements-completed: [COMMENT-SORT-01]

duration: 3min
completed: 2026-03-17
---

# Quick Task 260317-rg0: Switch Comment Sort Order to Newest-First Summary

**Newest-first comment sorting with persisted toggle in Settings > Workflow using store v7 migration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T18:49:01Z
- **Completed:** 2026-03-17T18:52:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Comments display newest-first by default in IssueDetailPage CommentThread
- Comments display newest-first by default in InlineComment (My Tasks)
- Settings > Workflow has "Comments" subsection with "Show newest comments first" toggle
- Preference persists across restarts via store version 6 -> 7 migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Add commentSortOrder to settings store with migration** - `9813cb7` (feat)
2. **Task 2: Apply sort order in CommentThread and InlineComment, add settings toggle** - `cad1752` (feat)

## Files Created/Modified
- `taskflow/src/stores/settings.store.ts` - Added CommentSortOrder type, field, setter, v7 migration
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` - CommentThread sorts via useMemo + store selector
- `taskflow/src/routes/dashboard/InlineComment.tsx` - Sorts existingComments via useMemo + store selector
- `taskflow/src/routes/settings/WorkflowSection.tsx` - Added Comments subsection with newest-first toggle

## Decisions Made
- Used [...comments].reverse() in useMemo for newest-first -- simple, no API change needed
- Store version bumped 6 -> 7 with undefined guard migration for backward compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260317-rg0*
*Completed: 2026-03-17*
