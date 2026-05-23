---
phase: quick-260316-wbp
plan: 01
subsystem: ui
tags: [react, jira-api, comments, tanstack-query]

requires:
  - phase: 20-command-palette-recent-items
    provides: IssueDetailPage route structure
provides:
  - Sticky comment composer at bottom of issue detail
  - Bordered comment cards with author/timestamp headers
  - Edit/delete own comments via 3-dot menu backed by Jira REST API
  - updateComment and deleteComment exported from jira.ts
affects: [issue-detail]

tech-stack:
  added: []
  patterns: [inline-edit-with-mutation, 3-dot-menu-popover]

key-files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx

key-decisions:
  - "Comment section moved from IssueDetailContent to IssueDetailPage for sticky composer layout"
  - "relativeTime exported from IssueDetailContent for reuse in comment cards"
  - "3-dot menu uses useState-based popover with mousedown outside-click handler"
  - "Edit/delete mutations follow same pattern as CommentComposer (readSecret + API call + invalidate)"

patterns-established:
  - "CommentThread as private component in IssueDetailPage for comment card rendering with edit/delete"

requirements-completed: [COMMENT-LAYOUT, COMMENT-EDIT-DELETE]

duration: 4min
completed: 2026-03-16
---

# Quick Task 260316-wbp: Comment Section Redesign Summary

**Sticky comment composer, bordered chronological comment cards, and edit/delete own comments via 3-dot menu with Jira REST API**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T22:30:57Z
- **Completed:** 2026-03-16T22:34:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added updateComment (PUT) and deleteComment (DELETE) API functions to jira.ts
- Restructured issue detail left column: scrollable content + sticky composer pinned at bottom
- Comments render oldest-first in bordered cards with author name, relative timestamp, and edited indicator
- 3-dot menu on own comments (matched via jiraUserDisplayName) with inline Edit and Delete options
- Edit mode replaces body with textarea + Save/Cancel; Delete uses window.confirm then API call

## Task Commits

Each task was committed atomically:

1. **Task 1: Add updateComment and deleteComment to Jira service** - `8a9b1d5` (feat)
2. **Task 2: Redesign comment section -- sticky composer, card layout, edit/delete menu** - `5e2df26` (feat)

## Files Created/Modified
- `taskflow/src/services/jira.ts` - Added updateComment and deleteComment exported functions
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` - Removed comment section, exported relativeTime
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` - Added CommentThread component with sticky composer layout, edit/delete functionality

## Decisions Made
- Comment section moved from IssueDetailContent to IssueDetailPage to enable sticky composer layout (content scrolls, composer stays fixed)
- relativeTime exported from IssueDetailContent rather than duplicated
- 3-dot menu uses simple useState popover with mousedown outside-click handler (no library needed)
- Edit/delete mutations follow the same readSecret + API call + invalidateQueries pattern as CommentComposer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260316-wbp*
*Completed: 2026-03-16*
