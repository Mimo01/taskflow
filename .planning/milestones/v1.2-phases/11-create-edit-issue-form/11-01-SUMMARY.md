---
phase: 11-create-edit-issue-form
plan: "01"
subsystem: api
tags: [jira, tdd, vitest, typescript, createmeta, issue-links]

# Dependency graph
requires:
  - phase: 10-sprint-board-redesign
    provides: createIssue() in jira.ts (minimal Story-only version extended here)

provides:
  - "CreateEditIssueModal.test.tsx Wave 0 stubs (7 vi.todo() stubs for CREATE-01..04)"
  - "jira.ts: CreatemetaField interface, fetchCreatemeta() with dual-endpoint strategy"
  - "jira.ts: IssueLinkType interface, fetchIssueLinkTypes() from /rest/api/2/issueLinkType"
  - "jira.ts: createIssueLink() POSTing to /rest/api/2/issueLink"
  - "jira.ts: bulkUpdateIssue() single PUT for edit mode"
  - "jira.ts: createIssue() extended with backward-compatible options param"

affects:
  - 11-02 (CreateEditIssueModal UI implementation uses all five new service functions)
  - 11-03 (edit mode integration)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-endpoint createmeta strategy: try Jira 8.4+ paginated endpoint first, fall back to legacy flat endpoint on 404"
    - "Undefined-field filtering in createIssue options: Object.entries().filter(v !== undefined) prevents field-not-on-screen 400s"
    - "204-as-success pattern: bulkUpdateIssue treats both ok=true and status=204 as success (Jira DC behavior)"

key-files:
  created:
    - taskflow/src/routes/dashboard/CreateEditIssueModal.test.tsx
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira.test.ts

key-decisions:
  - "createIssue() extended with optional options param — backward-compatible; existing QuickCreateInput.tsx caller (4-arg form) unaffected"
  - "fetchCreatemeta() takes both issueTypeId AND issueTypeName — id required for 8.4+ endpoint, name required for legacy fallback"
  - "createIssueLink() uses linkTypeId (not name) — admin-configurable names can change; id is stable"
  - "bulkUpdateIssue() treats status 204 as success — Jira DC returns 204 on PUT update, not 200"

patterns-established:
  - "Pattern: new jira.ts functions follow apiFetch pattern with explicit Authorization header"
  - "Pattern: TDD Wave 0 stubs use vi.todo() for component tests (compile-fail RED until component exists)"
  - "Pattern: failing service tests import non-existent function names to ensure RED state"

requirements-completed: [CREATE-01, CREATE-02, CREATE-03, CREATE-04]

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 11 Plan 01: Wave 0 RED Stubs and jira.ts Service Foundation

**Five new Jira DC service functions (createIssue extended, fetchCreatemeta with dual-endpoint fallback, fetchIssueLinkTypes, createIssueLink, bulkUpdateIssue) with passing GREEN tests and Wave 0 component test stubs**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-14T14:00:00Z
- **Completed:** 2026-03-14T14:04:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created Wave 0 CreateEditIssueModal.test.tsx with 7 vi.todo() stubs (fails to compile — component not yet created, as expected)
- Extended jira.test.ts with 10 RED failing tests for new Phase 11 service functions; 59 existing tests still green
- Implemented all five new exported jira.ts functions with full type safety — all 69 jira.test.ts tests pass GREEN
- fetchCreatemeta() dual-endpoint strategy handles both Jira 8.4+ paginated endpoints and legacy flat endpoint fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 RED test stubs** - `8c7721f` (test)
2. **Task 2: Extend jira.ts with five new service functions** - `b12b549` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/CreateEditIssueModal.test.tsx` - Wave 0 stubs (7 vi.todo() — intentionally fails to compile, component not yet created)
- `taskflow/src/services/jira.ts` - Extended createIssue(), added CreatemetaField/IssueLinkType interfaces, fetchCreatemeta(), fetchIssueLinkTypes(), createIssueLink(), bulkUpdateIssue()
- `taskflow/src/services/jira.test.ts` - Extended imports and added 10 new Phase 11 RED tests (now GREEN after Task 2)

## Decisions Made
- `createIssue()` extended with optional `options` param (backward-compatible) — existing 4-arg callers (QuickCreateInput.tsx) unaffected
- `fetchCreatemeta()` signature takes both `issueTypeId` and `issueTypeName` — both required to support the two endpoint strategies
- `createIssueLink()` uses `linkTypeId` (numeric ID) not link type name — names are admin-configurable and can change
- `bulkUpdateIssue()` treats HTTP 204 as success — Jira DC returns 204 on successful PUT updates, not 200

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in jira.ts at lines 309/410 (in `fetchSprintIssues` and `fetchMyTasksHierarchy` — unrelated to Phase 11 changes). These are out-of-scope pre-existing issues and were not fixed.
- Pre-existing "Unhandled Rejection" Tauri store init errors in test output — not test failures, not introduced by these changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All five new service functions exported and tested GREEN: createIssue, fetchCreatemeta, bulkUpdateIssue, fetchIssueLinkTypes, createIssueLink
- Wave 0 component test stubs in place — plan 02 implements CreateEditIssueModal.tsx to turn stubs GREEN
- Service contract is locked: plans 02/03 code against these exact function signatures

---
*Phase: 11-create-edit-issue-form*
*Completed: 2026-03-14*
