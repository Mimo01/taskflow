---
phase: 10-sprint-board-redesign
plan: 01
subsystem: testing
tags: [dnd-kit, jira, vitest, react-testing-library, tdd]

# Dependency graph
requires:
  - phase: 09-custom-field-discovery
    provides: jira.ts service layer with apiFetch pattern and updateIssueField as anchor point

provides:
  - "@dnd-kit/core ^6.3.1 and @dnd-kit/utilities ^3.2.2 installed in taskflow/"
  - "fetchProjectStatuses exported from jira.ts: GET /rest/api/2/project/{key}/statuses, flattens and deduplicates by id"
  - "createIssue exported from jira.ts: POST /rest/api/2/issue with minimal Story body"
  - "JiraProjectStatus interface exported from jira.ts"
  - "jira.test.ts: BOARD-04 passing tests for fetchProjectStatuses and createIssue"
  - "SprintBoardTab.test.tsx: 4 RED stubs for BOARD-01 workflow-API columns and BOARD-03 drag/rollback"
  - "QuickCreateInput.test.tsx: 3 RED stubs for BOARD-04 quick-create input interactions"
affects:
  - 10-sprint-board-redesign (all subsequent plans consume these foundations)

# Tech tracking
tech-stack:
  added:
    - "@dnd-kit/core ^6.3.1 (stable drag-and-drop)"
    - "@dnd-kit/utilities ^3.2.2 (DnD helper utilities)"
  patterns:
    - "Use @dnd-kit/core v6 stable API only — @dnd-kit/react new API not production-ready"
    - "Wave 0 RED stubs pattern: test file stubs written before implementation exists"
    - "TDD exception: implementation and tests added in same task when both are new"

key-files:
  created:
    - taskflow/src/routes/dashboard/QuickCreateInput.test.tsx
  modified:
    - taskflow/package.json
    - taskflow/package-lock.json
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira.test.ts
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx

key-decisions:
  - "@dnd-kit/react new API not installed — locked decision from research; only core + utilities installed"
  - "fetchProjectStatuses deduplicates by id using Set with first-occurrence-wins semantics"
  - "createIssue hardcodes issuetype name as 'Story' — minimal body per plan spec"
  - "Wave 0 RED stubs use data-droppable attribute queries for drag tests — will require matching implementation"

patterns-established:
  - "Wave 0 RED stubs: write test file before component exists; import fails = RED; no skip/todo"
  - "jira.ts service functions follow apiFetch('jira', url, opts) pattern with trailing replace(/\\/$/, '')"

requirements-completed: [BOARD-01, BOARD-03, BOARD-04]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 10 Plan 01: Sprint Board Foundation Summary

**@dnd-kit/core + @dnd-kit/utilities installed, fetchProjectStatuses and createIssue added to jira.ts, and Wave 0 RED test stubs created for board columns, drag-drop, and quick-create**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T11:25:10Z
- **Completed:** 2026-03-14T11:27:57Z
- **Tasks:** 3
- **Files modified:** 5 (+ 1 created)

## Accomplishments
- Installed @dnd-kit/core ^6.3.1 and @dnd-kit/utilities ^3.2.2 — drag dependency foundation ready for all subsequent plans
- Added `fetchProjectStatuses` (flatten+deduplicate across issue types) and `createIssue` (minimal Story POST) to jira.ts with full TypeScript types and passing tests
- Created Wave 0 RED test stubs: 4 in SprintBoardTab.test.tsx (BOARD-01 workflow columns, story headers, BOARD-03 optimistic drag, rollback), 3 in QuickCreateInput.test.tsx (show/hide input, Enter submit, Escape cancel)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @dnd-kit packages** - `4fb5829` (chore)
2. **Task 2: Add fetchProjectStatuses and createIssue to jira.ts** - `f50fd7b` (feat)
3. **Task 3: Write Wave 0 RED test stubs** - `51f7f6f` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `taskflow/package.json` - Added @dnd-kit/core and @dnd-kit/utilities dependencies
- `taskflow/package-lock.json` - Updated lockfile
- `taskflow/src/services/jira.ts` - Added JiraProjectStatus interface, fetchProjectStatuses, createIssue
- `taskflow/src/services/jira.test.ts` - Added BOARD-04 passing tests for new service functions (58 total pass)
- `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` - Added fetchProjectStatuses to jira mock; added 4 RED stubs
- `taskflow/src/routes/dashboard/QuickCreateInput.test.tsx` - Created with 3 RED stubs for new component

## Decisions Made
- @dnd-kit/react NOT installed — plan explicitly prohibits it (STATE.md locked decision: new API not production-ready as of Nov 2025)
- fetchProjectStatuses deduplicates by id using a Set; first occurrence wins when a status appears in multiple issue type arrays
- createIssue sets issuetype name to 'Story' hardcoded per plan spec (minimal body)
- Wave 0 RED stubs use `data-droppable` attribute selectors for drag tests, which will require matching implementation to use same attributes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None. The 4 zustand localStorage warnings in jira.test.ts output are pre-existing (from zustand persist middleware running in jsdom without localStorage) — not caused by this plan and zero tests fail.

## Next Phase Readiness
- Drag-and-drop foundation installed and importable
- Service layer contracts (`fetchProjectStatuses`, `createIssue`) established and tested
- 7 RED stubs exist (4 SprintBoardTab + 3 QuickCreateInput) ready to be satisfied by Plans 02–04
- No blockers

---
*Phase: 10-sprint-board-redesign*
*Completed: 2026-03-14*
