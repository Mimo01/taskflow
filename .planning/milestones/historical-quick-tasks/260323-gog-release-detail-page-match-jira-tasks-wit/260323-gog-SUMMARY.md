---
phase: quick-260323-gog
plan: 01
subsystem: ui
tags: [react, jira, gitlab, release-management, link-engine]

requires:
  - phase: quick-260323-fsy
    provides: ReleaseDetailPage with inline editing
provides:
  - fetchMilestoneMRs function in gitlab.ts for milestone-scoped MR fetching
  - Jira issue table with MR matching in ReleaseDetailPage
  - Missing MR orange warning badges per issue
  - Unmatched MRs section with blue info styling
affects: [release-management, dashboard]

tech-stack:
  added: []
  patterns: [issue-MR matching via linkEngine, milestone-scoped MR queries]

key-files:
  created: []
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx

key-decisions:
  - "Used direct fetch (not apiFetch) for fetchFixVersionIssues to match existing page pattern"
  - "Paginated fetchMilestoneMRs with label enrichment matching fetchProjectMRs pattern"

patterns-established:
  - "Milestone MR fetching: use milestone title param with state=all and pagination"
  - "Issue-MR matching: use linkMRToTask from linkEngine with issue key set"

requirements-completed: [MATCH-JIRA-MR, MISSING-MR-BADGE, UNMATCHED-MR-SECTION, JIRA-PROGRESS]

duration: 3min
completed: 2026-03-23
---

# Quick Task 260323-gog: Release Detail Page Match Jira Tasks with MRs Summary

**Jira issue table with GitLab MR matching via linkEngine, missing MR badges, and unmatched MR section on release detail page**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T11:08:02Z
- **Completed:** 2026-03-23T11:10:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added fetchMilestoneMRs to gitlab.ts with full pagination and label color enrichment
- Added fetchFixVersionIssues helper with Jira search API pagination
- Built issue-MR matching table using linkMRToTask from linkEngine
- Orange AlertTriangle badges for issues missing MRs
- Separate unmatched MRs section with blue Info styling for orphan milestone MRs
- Progress bar remains Jira-driven (done/total from issueCounts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fetchMilestoneMRs and fetchFixVersionIssues helpers** - `d3bdc41` (feat)
2. **Task 2: Build issue-MR matching table with missing/unmatched sections** - `214ac82` (feat)

## Files Created/Modified
- `taskflow/src/services/gitlab.ts` - Added fetchMilestoneMRs function for milestone-scoped MR fetching with pagination and label enrichment
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - Added fetchFixVersionIssues helper, useQuery hooks for issues and milestone MRs, useMemo matching logic, issues table with MR column, and unmatched MRs section

## Decisions Made
- Used direct `fetch` from `@tauri-apps/plugin-http` for fetchFixVersionIssues (matching existing fetchVersionIssueCounts pattern in the same file)
- Used `apiFetch` for fetchMilestoneMRs (matching existing gitlab.ts service pattern)
- Paginated both functions for completeness even though most releases have fewer than 100 issues/MRs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AlertTriangle title prop**
- **Found during:** Task 2
- **Issue:** Lucide React AlertTriangle does not accept `title` as a prop
- **Fix:** Moved `title` attribute to the wrapping `<span>` element
- **Files modified:** taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
- **Committed in:** 214ac82

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor prop placement fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED
