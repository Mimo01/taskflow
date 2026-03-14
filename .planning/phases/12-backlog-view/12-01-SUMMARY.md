---
phase: 12-backlog-view
plan: "01"
subsystem: api
tags: [jira, react-query, testing, vitest, tdd]

# Dependency graph
requires:
  - phase: 10-sprint-board-redesign
    provides: JiraActiveSprint interface and fetchActiveSprint function used by addIssuesToSprint caller
  - phase: 11-create-edit-issue-form
    provides: jira.ts patterns (bulkUpdateIssue, createIssue) and test structure for new service functions
provides:
  - fetchBacklogIssues exported from jira.ts — compound JQL, paginated, 400 error handling
  - addIssuesToSprint exported from jira.ts — POST to Agile REST, treats 204 as success
  - BacklogPage.test.tsx with RED stubs covering all 13 BACK-01..05 behaviors
affects: [12-02-backlog-page-implementation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fetchAllSearchPages delegation pattern: call private helper inside try/catch, duck-type thrown Response by checking .status property"
    - "Set deduplication for fields param: [...new Set([...defaults, ...customKeys])].join(',')"
    - "Wave 0 TDD: test file exists with RED stubs before implementation module is created"

key-files:
  created:
    - taskflow/src/routes/dashboard/BacklogPage.test.tsx
  modified:
    - taskflow/src/services/jira.ts

key-decisions:
  - "fetchBacklogIssues 400 error handling mirrors fetchSprintIssues: catch duck-typed Response, check status === 400, throw user-friendly message"
  - "addIssuesToSprint accepts sprintId: number (matching JiraActiveSprint.id type) not string"
  - "BacklogPage.test.tsx uses dynamic import('./BacklogPage') inside each test — RED state is import failure at test runtime, not compile-time"
  - "TypeScript TS2307 errors in BacklogPage.test.tsx are expected Wave 0 artifacts — BacklogPage.tsx created in Plan 02"

patterns-established:
  - "Phase 12 service functions appended after bulkUpdateIssue with section header comment"
  - "makeIssue fixture: key, summary, epicKey (-> customfield_10014), assigneeDisplayName for filter coverage"

requirements-completed: [BACK-01, BACK-02, BACK-03, BACK-04, BACK-05]

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 12 Plan 01: Backlog View Foundation Summary

**fetchBacklogIssues (compound JQL + 400 handling) and addIssuesToSprint (Agile REST POST) added to jira.ts; BacklogPage.test.tsx scaffolded with 13 RED stubs covering BACK-01..05**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T16:44:16Z
- **Completed:** 2026-03-14T16:47:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `fetchBacklogIssues` to jira.ts: compound JQL selecting issues outside open/future sprints, paginated via private `fetchAllSearchPages`, deduplicates fields param with Set, throws user-friendly error on 400
- Added `addIssuesToSprint` to jira.ts: POSTs to `/rest/agile/1.0/sprint/{sprintId}/issue`, accepts `sprintId: number` to match `JiraActiveSprint.id` type, treats 204 as success
- Created BacklogPage.test.tsx with 13 failing tests grouped by requirement (BACK-01 through BACK-05), in correct Wave 0 RED state

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fetchBacklogIssues and addIssuesToSprint to jira.ts** - `b0c53ae` (feat)
2. **Task 2: Create BacklogPage.test.tsx with RED stubs for BACK-01..05** - `5767298` (test)

**Plan metadata:** (docs commit — follows this summary)

_Note: TDD tasks — Task 1 is the GREEN implementation (service layer), Task 2 is the RED test stubs (UI contract)_

## Files Created/Modified
- `taskflow/src/services/jira.ts` - Added `fetchBacklogIssues` and `addIssuesToSprint` exports (Phase 12 section, lines 1214+)
- `taskflow/src/routes/dashboard/BacklogPage.test.tsx` - 13 RED test stubs for all BACK-01..05 behaviors

## Decisions Made
- **400 error pattern**: Mirrors `fetchSprintIssues` — catch block duck-types thrown Response via `'status' in err && typeof err.status === 'number'`, checks `status === 400`, throws `'Backlog query unavailable — ensure Jira Software license is active for this project'`
- **sprintId type**: `number` (not string) to match `JiraActiveSprint.id: number` from Phase 10
- **Dynamic import in tests**: Each test uses `await import('./BacklogPage')` so Vite fails at runtime (correct RED), not at the top of the file where it could mask all test discovery

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript `tsc --noEmit` reports TS2307 errors for `BacklogPage.test.tsx` (cannot find module `./BacklogPage`). This is expected Wave 0 behavior — jira.ts itself compiles clean; the plan's TypeScript verification requirement targets jira.ts only. Noted as by-design.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 12-02 can implement BacklogPage.tsx against the RED test contract defined here
- `fetchBacklogIssues` and `addIssuesToSprint` are ready for BacklogPage to consume
- `fetchActiveSprint` (Phase 10) already exported and mocked in test stubs for sprint state

---
*Phase: 12-backlog-view*
*Completed: 2026-03-14*
