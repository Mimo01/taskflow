---
phase: 31-issue-detail-enrichment
plan: 01
subsystem: api
tags: [jira, changelog, timeline, watchers, rest-api, vitest]

requires:
  - phase: none
    provides: existing jira.ts service with fetchIssueDetail and JiraIssueDetail type

provides:
  - ChangelogItem, ChangelogHistory types for changelog data
  - mergeTimeline, filterTimeline, countByType pure functions for activity timeline UI
  - fetchWatchers, addWatcher, removeWatcher watcher CRUD service
  - JiraIssueDetail.changelog optional property with expand=changelog on fetch
  - WatcherData type

affects: [31-03-activity-timeline-ui, 31-04-watcher-toggle-ui]

tech-stack:
  added: []
  patterns: [sibling module pattern for service decomposition, TDD red-green for pure functions]

key-files:
  created:
    - taskflow/src/services/jira-changelog.ts
    - taskflow/src/services/jira-changelog.test.ts
    - taskflow/src/services/jira-watchers.ts
    - taskflow/src/services/jira-watchers.test.ts
  modified:
    - taskflow/src/services/jira.ts

key-decisions:
  - "Created sibling files (jira-changelog.ts, jira-watchers.ts) instead of jira/ subdirectory — codebase uses monolithic jira.ts, not yet decomposed; re-exports from jira.ts preserve all existing imports"

patterns-established:
  - "Sibling service modules: new domain services as jira-{domain}.ts re-exported from jira.ts barrel"
  - "Timeline merge pattern: comments + changelog histories merged into sorted TimelineEntry[] with type discriminator"

requirements-completed: [DETAIL-01, DETAIL-02, DETAIL-05]

duration: 4min
completed: 2026-03-22
---

# Phase 31 Plan 01: Changelog & Watcher Service Layer Summary

**Changelog timeline merge/filter utilities and watcher CRUD with expand=changelog on fetchIssueDetail, 22 passing tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T17:35:11Z
- **Completed:** 2026-03-22T17:39:53Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Timeline merge/filter/count pure functions for activity timeline UI (mergeTimeline sorts newest-first, filterTimeline by type, countByType)
- Watcher CRUD service following existing comments.ts pattern (fetchWatchers, addWatcher with raw JSON string body, removeWatcher with username query param)
- JiraIssueDetail type extended with optional changelog property; fetchIssueDetail URL includes expand=changelog
- 22 tests covering all behaviors: merge ordering, empty inputs, stable sort, filter subsets, watcher auth errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Changelog types + timeline merge/filter utilities with tests** - `2d03ff7` (feat)
2. **Task 2: Watcher service with tests** - `a5099c0` (feat)

## Files Created/Modified
- `taskflow/src/services/jira-changelog.ts` - Timeline merge, filter, count pure functions with ChangelogItem/ChangelogHistory types
- `taskflow/src/services/jira-changelog.test.ts` - 11 tests for timeline utilities
- `taskflow/src/services/jira-watchers.ts` - Watcher fetch/add/remove CRUD with ApiError on auth failures
- `taskflow/src/services/jira-watchers.test.ts` - 11 tests for watcher service with mocked apiFetch
- `taskflow/src/services/jira.ts` - Added changelog property to JiraIssueDetail, expand=changelog to URL, re-exports from new modules

## Decisions Made
- Created sibling files (jira-changelog.ts, jira-watchers.ts) instead of jira/ subdirectory because the codebase uses a monolithic jira.ts that is not yet decomposed. Re-exports from jira.ts preserve all existing imports across 20+ consumers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted file paths from jira/ subdirectory to sibling modules**
- **Found during:** Task 1 (Changelog types)
- **Issue:** Plan assumes decomposed jira/ directory (types.ts, issues.ts, index.ts) but codebase has monolithic services/jira.ts
- **Fix:** Created jira-changelog.ts and jira-watchers.ts as sibling files; added types and changelog property directly to jira.ts; used re-exports from jira.ts barrel
- **Files modified:** jira.ts, jira-changelog.ts, jira-watchers.ts
- **Verification:** All 22 tests pass; existing imports unaffected
- **Committed in:** 2d03ff7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** File structure adapted to match actual codebase. All functionality delivered as specified. No scope creep.

## Issues Encountered
- node_modules not present in worktree; ran npm install before test execution

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Changelog and watcher service functions ready for Plans 31-03 (ActivityTimeline UI) and 31-04 (watcher toggle)
- All types exported via jira.ts barrel for downstream consumption
- No blockers

---
*Phase: 31-issue-detail-enrichment*
*Completed: 2026-03-22*
