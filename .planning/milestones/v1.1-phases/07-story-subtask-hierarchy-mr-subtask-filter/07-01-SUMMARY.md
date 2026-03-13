---
phase: 07-story-subtask-hierarchy-mr-subtask-filter
plan: "01"
subsystem: ui
tags: [react, tanstack-query, jira, testing, vitest, tdd]

# Dependency graph
requires:
  - phase: 05-api-foundation-quick-wins
    provides: fetchMyTasksHierarchy returning { issues, myIssueKeys } cache shape
  - phase: 06-workload-sprint-progress-enrichment
    provides: MyTasksTab groupedData memo with orphans array
provides:
  - SprintBoardTab.test.tsx Wave 0 RED stubs for HIER-02 (4 failing behavior tests)
  - MyTasksTab orphan subtask suppression (orphans silently hidden)
  - MyTasksTab onMutate cache shape fix ({ issues, myIssueKeys } instead of JiraIssue[])
affects:
  - 07-02-PLAN.md (SprintBoardTab hierarchy implementation — will make RED stubs pass)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD Wave 0 stub pattern: create failing test assertions against current flat implementation before implementing feature"
    - "JiraIssue parent fixture: requires { id, key, fields: { summary } } — just key is insufficient"
    - "SprintBoardTab test: skeleton check requires waitFor (jiraToken loaded async via readSecret)"

key-files:
  created:
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
  modified:
    - taskflow/src/routes/dashboard/MyTasksTab.tsx

key-decisions:
  - "HIER-01: Orphans are silently dropped — groupedData memo still computes them but render block deleted entirely"
  - "onMutate fix: cache key holds { issues: JiraIssue[]; myIssueKeys: Set<string> } not JiraIssue[] — typing was silently wrong"

patterns-established:
  - "TDD Wave 0 stubs: infrastructure tests (loading/error/empty) PASS, HIER-XX behavior tests FAIL intentionally"
  - "makeIssue fixture in SprintBoardTab tests: isSubtask boolean + optional parentKey builds full parent shape"

requirements-completed:
  - HIER-01

# Metrics
duration: 15min
completed: 2026-03-13
---

# Phase 7 Plan 01: Story/Subtask Hierarchy Wave 0 Summary

**SprintBoardTab HIER-02 test scaffold (RED state) and MyTasksTab orphan suppression + onMutate cache shape fix**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-13T00:34:25Z
- **Completed:** 2026-03-13T00:49:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created SprintBoardTab.test.tsx with 7 tests: 3 infrastructure (PASS) + 4 HIER-02 stubs (RED — intentional)
- Removed orphan subtask render block from MyTasksTab: orphans silently dropped per user decision
- Fixed pre-existing onMutate bug: cache typed as JiraIssue[] but actual shape is { issues, myIssueKeys }

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SprintBoardTab.test.tsx with failing HIER-02 stubs** - `58fd2c9` (test)
2. **Task 1 fix: correct JiraIssue parent fixture shape** - `f919142` (fix)
3. **Task 2: suppress orphan rendering and fix onMutate cache shape** - `15e41b8` (fix)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` - Wave 0 RED stubs: loading/error/empty PASS; column count, subtask collapse, chevron expand, orphan suppression FAIL
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` - Orphan render block removed; onMutate/onError retyped to { issues, myIssueKeys }

## Decisions Made
- Orphan render block deleted entirely (not just hidden): groupedData memo still computes orphans for potential future use or tests, but render block removed per user decision that orphans are hidden entirely
- onMutate cache fix also applied to onError rollback for consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JiraIssue parent fixture missing required fields**
- **Found during:** Task 1 (SprintBoardTab test creation)
- **Issue:** makeIssue helper built parent as `{ key: string }` but JiraIssue.fields.parent type requires `{ id: string; key: string; fields: { summary: string } }`
- **Fix:** Updated makeIssue to include full parent shape with id and fields.summary
- **Files modified:** taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
- **Verification:** `npx tsc --noEmit` shows no errors in SprintBoardTab.test.tsx
- **Committed in:** f919142 (fixture fix commit)

**2. [Rule 1 - Bug] Skeleton test failed due to async jiraToken loading**
- **Found during:** Task 1 (test execution)
- **Issue:** Original test checked `document.querySelectorAll('.animate-pulse')` synchronously, but jiraToken is null at first render (loaded via async readSecret), so query is disabled and no skeleton renders immediately
- **Fix:** Wrapped skeleton assertion in `waitFor()` to wait for readSecret to resolve
- **Files modified:** taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
- **Verification:** Skeleton test passes
- **Committed in:** f919142 (fixture fix commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug)
**Impact on plan:** Both fixes necessary for correct test infrastructure. No scope creep.

## Issues Encountered
- Pre-existing uncommitted changes to MrAttentionTab.tsx and gitlab.ts (not part of this plan) caused 7 MrAttentionTab test failures in addition to the expected pre-existing failures. These are out of scope for this plan.

## Next Phase Readiness
- SprintBoardTab.test.tsx RED stubs ready for HIER-02 implementation in 07-02-PLAN.md
- MyTasksTab correctly hides orphans and has correct mutation cache typing
- Wave 0 test infrastructure established: makeIssue helper, renderWithQuery, mock patterns

---
*Phase: 07-story-subtask-hierarchy-mr-subtask-filter*
*Completed: 2026-03-13*
