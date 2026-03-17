---
phase: quick
plan: 260317-ric
subsystem: ui
tags: [tailwind, compact-cards, linked-issues, merge-requests, status-badges]

requires:
  - phase: quick-260317-rc8
    provides: GitLab MR section in IssueDetailSidebar
provides:
  - Grouped linked issues with status color dots and badges
  - Redesigned MR cards with author avatar, branch, reviewers, state colors
affects: [issue-detail-sidebar]

tech-stack:
  added: []
  patterns: [status-name-heuristic-color-coding, grouped-link-type-sections]

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx

key-decisions:
  - "Status color heuristic uses regex on status name (no statusCategory on linked issue targets)"
  - "Both tasks committed together since they modify same file and share helper functions"

patterns-established:
  - "statusDotColor/statusBadgeClasses pattern for Jira status color coding without statusCategory"
  - "mrStateClasses/mrDotColor pattern for GitLab MR state color coding"

requirements-completed: [redesign-linked-issues, redesign-merge-requests]

duration: 2min
completed: 2026-03-17
---

# Quick Task 260317-ric: Redesign Linked Issues and MR Sections Summary

**Compact card redesign for linked issues (grouped by type with status dots/badges) and MRs (author avatar, branch, reviewers, state colors)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T19:15:35Z
- **Completed:** 2026-03-17T19:17:19Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Linked issues grouped by link type label (blocks, is blocked by, relates to) with compact card layout
- Each linked issue shows status color dot, key, truncated summary, and colored status badge
- MR cards show state dot, title, state badge (green=open, purple=merged), author avatar, branch name, reviewer count
- Status color heuristic based on status name matching (done/closed -> green, in progress -> blue, default -> gray)

## Task Commits

Both tasks committed atomically (single file):

1. **Task 1+2: Redesign linked issues + MR sections** - `cbb797e` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/IssueDetailSidebar.tsx` - Redesigned linked issues (grouped compact cards) and MR sections (rich compact cards with metadata)

## Decisions Made
- Used status name regex heuristic for color coding since linked issue targets lack statusCategory field
- Combined both tasks into single commit since they modify the same file and share helper function patterns
- Replaced GitMerge import with GitBranch (new MR design uses branch icon + colored dots instead of merge icon)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260317-ric*
*Completed: 2026-03-17*
