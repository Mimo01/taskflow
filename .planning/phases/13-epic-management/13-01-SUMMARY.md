---
phase: 13-epic-management
plan: "01"
subsystem: api
tags: [jira, typescript, vitest, tdd, epics]

# Dependency graph
requires:
  - phase: 12-backlog-view
    provides: fetchBacklogView two-query enrichment pattern that fetchEpicsWithEnrichment mirrors
provides:
  - EpicEnriched interface exported from jira.ts
  - fetchEpicsWithEnrichment() — two-query epic list + story count enrichment
  - fetchEpicStories() — stories list for a specific epic, excluding subtasks
  - Wave 0 RED test stubs for EpicsPage, EpicDetailSheet, CreateEpicDialog
affects:
  - 13-02 (EpicsPage route implements against EpicEnriched and fetchEpicsWithEnrichment)
  - 13-03 (EpicDetailSheet implements against fetchEpicStories)
  - 13-04 (CreateEpicDialog implements using createIssue with Epic issuetype)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-query enrichment pattern (fetch list then batch child queries) — mirrors fetchBacklogView

key-files:
  created:
    - taskflow/src/routes/dashboard/EpicsPage.test.tsx
    - taskflow/src/routes/dashboard/EpicDetailSheet.test.tsx
    - taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx
  modified:
    - taskflow/src/services/jira.ts

key-decisions:
  - "_projectKey parameter prefixed with underscore in fetchEpicStories — JQL uses epicKey directly so projectKey is not needed in the query body"
  - "fetchEpicStories wraps fetchAllSearchPages call in .catch(() => []) so failures return empty array without throwing"
  - "Wave 0 test stubs use dynamic import() pattern (same as Phase 12 BacklogPage stubs) to ensure RED state is import resolution failure, not test logic error"

patterns-established:
  - "Pattern: fetchEpicsWithEnrichment two-query enrichment — fetch epics via JQL, then batch-fetch child stories via Epic Link JQL with issuetype != Sub-task exclusion"

requirements-completed: [EPIC-01, EPIC-03, EPIC-04]

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 13 Plan 01: Epic Management Service Foundation Summary

**EpicEnriched interface + fetchEpicsWithEnrichment/fetchEpicStories service functions in jira.ts, plus Wave 0 RED test stubs for EpicsPage, EpicDetailSheet, and CreateEpicDialog**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T21:51:48Z
- **Completed:** 2026-03-14T21:55:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `EpicEnriched` interface to jira.ts with key, epicName, summary, status, assignee, totalStories, doneStories, totalPoints fields
- Implemented `fetchEpicsWithEnrichment()` using two-query enrichment pattern (mirrors fetchBacklogView) — fetches epics then batch-fetches child stories for count/points aggregation
- Implemented `fetchEpicStories()` — returns JiraIssue[] for an epic's stories excluding subtasks, catches failures with empty array
- Created three Wave 0 RED test stubs (EpicsPage, EpicDetailSheet, CreateEpicDialog) that fail with import resolution errors (expected — component files don't exist yet)
- Added 7 new unit tests to jira.test.ts covering both service functions (76 total passing, 0 failing)
- TypeScript compiles clean for all non-test files (tsc --noEmit exits 0)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add EpicEnriched interface + service functions to jira.ts** - `1e24782` (feat + test TDD)
2. **Task 2: Create Wave 0 RED test stubs** - `afe4b0b` (test)

**Plan metadata:** *(committed after summary)*

## Files Created/Modified

- `taskflow/src/services/jira.ts` — Added EpicEnriched interface, fetchEpicsWithEnrichment(), fetchEpicStories() (109 lines appended)
- `taskflow/src/services/jira.test.ts` — Added EPIC-01/EPIC-03 unit tests (7 new tests, 76 total passing)
- `taskflow/src/routes/dashboard/EpicsPage.test.tsx` — Wave 0 RED stub (2 EPIC-01 tests)
- `taskflow/src/routes/dashboard/EpicDetailSheet.test.tsx` — Wave 0 RED stub (2 EPIC-03 tests)
- `taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx` — Wave 0 RED stub (2 EPIC-04 tests)

## Decisions Made

- **_projectKey prefixed with underscore in fetchEpicStories:** The JQL uses the `epicKey` parameter directly (`"Epic Link" = ${epicKey}`), so `projectKey` is not used in the query body. Prefixing with `_` suppresses the TypeScript TS6133 unused variable error while keeping the parameter available for future use if needed.
- **Wave 0 test stubs use dynamic import():** Same pattern as Phase 12 (BacklogPage.test.tsx). Ensures RED state is a Vite import resolution failure (not a test logic error), confirming the TDD wave discipline.
- **fetchEpicStories catch pattern:** `.catch(() => [] as JiraIssue[])` wraps the entire fetchAllSearchPages call — consistent with how other service functions handle network failures gracefully.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed JiraIssue mock shape in test fixtures**
- **Found during:** Task 1 (TDD GREEN verification with `npx tsc --noEmit`)
- **Issue:** Initial test mock objects used incorrect field shapes — `statusCategory` had extra `name` field not in the JiraIssue type, `issuetype` had `iconUrl` instead of `subtask: boolean`, and `status` was missing required `id: string`
- **Fix:** Updated all test fixtures to match the exact JiraIssue interface shape from jira.ts (statusCategory has only `key`, issuetype has `name` and `subtask: boolean`, status has `id`)
- **Files modified:** taskflow/src/services/jira.test.ts
- **Verification:** `npx tsc --noEmit` exits 0 for all non-test files
- **Committed in:** 1e24782 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — type mismatch in test fixtures)
**Impact on plan:** Auto-fix necessary for TypeScript correctness. No scope creep.

## Issues Encountered

- Wave 0 test stubs cause TS2307 errors when running `tsc --noEmit` (component files don't exist yet). This is expected and correct — it's the Wave 0 RED state by design. The plan's TypeScript clean-compile criterion applies to jira.ts additions only.

## Next Phase Readiness

- Service contract established: `EpicEnriched`, `fetchEpicsWithEnrichment`, `fetchEpicStories` exported from jira.ts
- RED test stubs exist for plans 13-02 (EpicsPage), 13-03 (EpicDetailSheet), 13-04 (CreateEpicDialog)
- Plan 13-02 can proceed: implement EpicsPage route to turn EpicsPage.test.tsx GREEN

---
*Phase: 13-epic-management*
*Completed: 2026-03-14*
