---
phase: quick
plan: 260316-ulr
subsystem: ui
tags: [jira, issue-detail, sidebar, navigation]

provides:
  - Clickable linked issues in IssueDetailSidebar with status badges
affects: [issue-detail]

key-files:
  modified:
    - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx

key-decisions:
  - "Matched existing epic/parent link button pattern for consistency"
  - "Added status badge to linked issues for navigation context"

duration: 1min
completed: 2026-03-16
---

# Quick 260316-ulr: Make Linked Issues Clickable Summary

**Linked issues in issue detail sidebar now clickable with onOpenIssue navigation and status badges**

## Performance

- **Duration:** 1 min
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced plain text linked issue rows with clickable buttons calling onOpenIssue(target.key)
- Added status badge (Badge variant="outline") to each linked issue for at-a-glance context
- Matched existing epic link and parent link interaction pattern (hover:underline, cursor-pointer)

## Task Commits

1. **Task 1: Make linked issues clickable in IssueDetailSidebar** - `a013ec2` (feat)

## Files Modified
- `taskflow/src/routes/dashboard/IssueDetailSidebar.tsx` - Linked issues section converted from plain spans to clickable buttons with status badges

## Decisions Made
- Matched existing epic/parent link button pattern (text-left hover:underline cursor-pointer) for UI consistency
- Added Badge with variant="outline" and text-[10px] for status display -- helps user decide whether to navigate

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

---
*Quick task: 260316-ulr*
*Completed: 2026-03-16*
