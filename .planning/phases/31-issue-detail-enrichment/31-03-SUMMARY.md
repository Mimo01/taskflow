---
phase: 31-issue-detail-enrichment
plan: 03
subsystem: ui
tags: [react, tanstack-query, jira, timeline, changelog, watchers, accessibility]

requires:
  - phase: 31-01
    provides: jira-changelog.ts (mergeTimeline, filterTimeline, countByType), jira-watchers.ts (fetchWatchers, addWatcher, removeWatcher)
provides:
  - ActivityTimeline component replacing CommentThread with unified changelog + comments view
  - TimelineFilterChips with All/Changes/Comments filter and counts
  - ChangelogEntry compact muted rendering for field changes
  - WatcherToggle sidebar widget with optimistic toggle
affects: [31-04, issue-detail-enrichment]

tech-stack:
  added: []
  patterns: [component injection via props for memoized children, optimistic mutation with rollback]

key-files:
  created:
    - taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx
    - taskflow/src/routes/dashboard/issue-detail/TimelineFilterChips.tsx
    - taskflow/src/routes/dashboard/issue-detail/ChangelogEntry.tsx
    - taskflow/src/routes/dashboard/issue-detail/WatcherToggle.tsx
  modified:
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/services/jira/types.ts
    - taskflow/src/services/jira/issues.ts

key-decisions:
  - "CommentCard injected into ActivityTimeline via props to preserve memoization and co-locate edit state in IssueDetailPage"
  - "WatcherToggle is self-contained with own useQuery/useMutation -- no props needed from parent except issueKey and jiraBaseUrl"

patterns-established:
  - "Component injection pattern: pass memoized child components as props to avoid breaking React.memo boundaries"

requirements-completed: [DETAIL-01, DETAIL-02, DETAIL-05]

duration: 6min
completed: 2026-03-22
---

# Phase 31 Plan 03: Activity Timeline & Watcher Toggle Summary

**Unified activity timeline replacing CommentThread with merged changelog + comments, filter chips with counts, and self-contained watcher toggle widget with optimistic updates**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T17:44:47Z
- **Completed:** 2026-03-22T17:50:37Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- ActivityTimeline replaces CommentThread with merged changelog + comments sorted chronologically
- TimelineFilterChips provide All/Changes/Comments filtering with accurate counts and radiogroup a11y
- ChangelogEntry renders compact muted entries for field changes (author changed Field from X to Y)
- WatcherToggle in sidebar with Eye/EyeOff icons, optimistic toggle, and aria-pressed accessibility
- Comment edit/delete functionality fully preserved (mutation logic lifted to IssueDetailPage)
- CommentComposer remains sticky at bottom

## Task Commits

Each task was committed atomically:

1. **Task 1: ChangelogEntry, TimelineFilterChips, and ActivityTimeline components** - `82d7d13` (feat)
2. **Task 2: WatcherToggle sidebar widget** - `c02223e` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx` - Main timeline component replacing CommentThread
- `taskflow/src/routes/dashboard/issue-detail/TimelineFilterChips.tsx` - Filter chip row with badge-based radio buttons
- `taskflow/src/routes/dashboard/issue-detail/ChangelogEntry.tsx` - Compact single-line changelog rendering
- `taskflow/src/routes/dashboard/issue-detail/WatcherToggle.tsx` - Self-contained watcher toggle with optimistic mutation
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` - Replaced CommentThread with ActivityTimeline, lifted mutation state
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` - Added WatcherToggle after due date row
- `taskflow/src/services/jira/types.ts` - Added changelog field to JiraIssueDetail interface
- `taskflow/src/services/jira/issues.ts` - Added expand=changelog to fetchIssueDetail URL

## Decisions Made
- CommentCard passed to ActivityTimeline as a component prop rather than re-creating it, to preserve the existing memoization boundary and avoid duplicating the edit/delete state management
- WatcherToggle designed as fully self-contained (own query + mutation) rather than receiving watcher data as props, because it needs independent refetch and optimistic update logic
- Added expand=changelog to the decomposed jira/issues.ts fetchIssueDetail (was already in the old jira.ts but missing in the refactored version)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added expand=changelog to decomposed fetchIssueDetail**
- **Found during:** Task 1
- **Issue:** The decomposed jira/issues.ts fetchIssueDetail was missing expand=changelog (present in old jira.ts)
- **Fix:** Added &expand=changelog to the URL in jira/issues.ts
- **Files modified:** taskflow/src/services/jira/issues.ts
- **Verification:** Test suite passes (643 tests)
- **Committed in:** 82d7d13

**2. [Rule 3 - Blocking] Added changelog field to JiraIssueDetail in jira/types.ts**
- **Found during:** Task 1
- **Issue:** The decomposed JiraIssueDetail type in jira/types.ts was missing the changelog property (present in old jira.ts)
- **Fix:** Added changelog?: { histories: [...] } to the type
- **Files modified:** taskflow/src/services/jira/types.ts
- **Verification:** Test suite passes
- **Committed in:** 82d7d13

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary to complete Task 1 -- the decomposed service module was missing data that the old monolithic jira.ts already had.

## Issues Encountered
None beyond the deviation fixes above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Activity timeline and watcher toggle are ready for verification in Plan 04
- All existing tests pass (643/643)
- CommentComposer sticky behavior preserved

## Self-Check: PASSED

---
*Phase: 31-issue-detail-enrichment*
*Completed: 2026-03-22*
