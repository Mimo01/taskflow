---
phase: 32-time-tracking-attachments-mentions
plan: 02
subsystem: ui
tags: [time-tracking, worklog, jira, react, tanstack-query]

requires:
  - phase: 32-01
    provides: "Service layer for worklogs (CRUD), duration parser, jira-changelog timeline merge with worklog support"
provides:
  - "TimeTrackingSummary component with progress bar for sidebar"
  - "LogWorkPopover for creating worklog entries"
  - "DurationInput with natural language parsing and clock picker fallback"
  - "WorklogEntry timeline card with edit/delete 3-dot menu"
  - "Worklogs filter chip in timeline filter bar"
  - "Full worklog CRUD wiring in IssueDetailPage"
affects: [issue-detail, time-tracking]

tech-stack:
  added: []
  patterns: ["Worklog CRUD follows same mutation pattern as comment CRUD in IssueDetailPage", "base-ui Popover (no asChild/align) for popovers"]

key-files:
  created:
    - "taskflow/src/routes/dashboard/issue-detail/TimeTrackingSummary.tsx"
    - "taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx"
    - "taskflow/src/routes/dashboard/issue-detail/DurationInput.tsx"
    - "taskflow/src/routes/dashboard/issue-detail/WorklogEntry.tsx"
  modified:
    - "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
    - "taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx"
    - "taskflow/src/routes/dashboard/issue-detail/TimelineFilterChips.tsx"
    - "taskflow/src/routes/dashboard/IssueDetailPage.tsx"
    - "taskflow/src/services/jira.ts"

key-decisions:
  - "Used base-ui PopoverTrigger directly (no asChild) matching project's component API"
  - "Import worklog/duration functions from jira/ submodule paths (not barrel) since main jira.ts barrel does not re-export them"
  - "CommentComposer shown on both 'comment' and 'all' filter modes"

patterns-established:
  - "Worklog CRUD mirrors comment CRUD: useState for edit state, useMutation with invalidation, useCallback handlers"
  - "WorklogEntry follows CommentCard pattern: 3-dot menu with outside-click close, inline edit mode"

requirements-completed: [TIME-01, TIME-02, TIME-03, TIME-04, TIME-05]

duration: 5min
completed: 2026-03-22
---

# Phase 32 Plan 02: Time Tracking UI Summary

**Sidebar time tracking summary with progress bar, log work popover with natural language duration input, worklog entries in activity timeline with inline edit/delete CRUD**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T19:46:26Z
- **Completed:** 2026-03-22T19:51:58Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- TimeTrackingSummary displays estimated/spent/remaining with progress bar in sidebar FieldsSection
- LogWorkPopover lets users enter duration via natural language DurationInput and submit worklogs
- WorklogEntry renders two-line timeline cards with 3-dot menu for own entry edit/delete
- Worklogs filter chip added to TimelineFilterChips for filtering timeline
- Full worklog CRUD wired in IssueDetailPage (fetch, edit, delete mutations)

## Task Commits

Each task was committed atomically:

1. **Task 1: TimeTrackingSummary, DurationInput, LogWorkPopover and sidebar integration** - `360659b` (feat)
2. **Task 2: WorklogEntry, timeline integration, filter chip, and worklog CRUD wiring** - `86ab419` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/issue-detail/DurationInput.tsx` - Natural language duration input with clock picker popover fallback
- `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx` - Popover form for creating worklog entries
- `taskflow/src/routes/dashboard/issue-detail/TimeTrackingSummary.tsx` - Sidebar progress bar with estimated/spent/remaining labels
- `taskflow/src/routes/dashboard/issue-detail/WorklogEntry.tsx` - Two-line timeline entry with 3-dot menu for edit/delete
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` - Added TimeTrackingSummary and LogWorkPopover integration
- `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx` - Added worklog rendering, CRUD props, three-way type discrimination
- `taskflow/src/routes/dashboard/issue-detail/TimelineFilterChips.tsx` - Added Worklogs chip with worklog count
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` - Added worklog query, edit/delete mutations, handlers
- `taskflow/src/services/jira.ts` - Added timetracking field to JiraIssueDetail interface

## Decisions Made
- Used base-ui PopoverTrigger directly (not asChild) since project uses @base-ui/react popover, not radix
- Imported worklog/duration functions from jira/ submodule paths directly since main jira.ts does not re-export submodule functions
- CommentComposer shown on both 'comment' and 'all' filter modes for consistent UX

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed PopoverTrigger API for base-ui**
- **Found during:** Task 1 (DurationInput and LogWorkPopover)
- **Issue:** Plan used radix-style `asChild` and `align` props but project uses @base-ui/react which has different API
- **Fix:** Removed `asChild` from PopoverTrigger, removed `align` from PopoverContent, used PopoverTrigger className directly
- **Files modified:** DurationInput.tsx, LogWorkPopover.tsx
- **Verification:** TypeScript compiles without errors
- **Committed in:** 360659b (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed import paths for worklog/duration services**
- **Found during:** Task 1 (LogWorkPopover)
- **Issue:** `@/services/jira` resolves to jira.ts (main file) which does not export createWorklog/parseDuration; these are in jira/ submodule
- **Fix:** Changed imports to `@/services/jira/duration` and `@/services/jira/worklogs`
- **Files modified:** LogWorkPopover.tsx, IssueDetailPage.tsx
- **Verification:** TypeScript compiles without errors
- **Committed in:** 360659b, 86ab419

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary to match project's actual component API and import structure. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Time tracking UI complete with full CRUD support
- Ready for attachment UI (Plan 03) and mentions UI (Plan 04)

---
*Phase: 32-time-tracking-attachments-mentions*
*Completed: 2026-03-22*
