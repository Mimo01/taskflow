---
phase: 78-drag-to-rank-on-backlog
plan: 01
subsystem: testing
tags: [dnd-kit, drag-drop, backlog, rank, vitest, tdd]

requires:
  - phase: 74-backlog-greenhopper
    provides: GhBacklogResponse shape with rankCustomFieldId field
  - phase: 67-sidebar-visibility
    provides: "@dnd-kit absence guard in package-deps.guard.test.ts (now removed)"

provides:
  - "@dnd-kit/core, /sortable, /modifiers, /utilities installed and importable"
  - "cancelLabel prop on ConfirmSprintMoveDialog (default 'Cancel')"
  - "rank-api.test.ts Wave-0 RED scaffold (RANK-03 integer assertion, PUT body, 401/500 error cases)"
  - "BacklogPage.rank.test.ts Wave-0 RED scaffold (RANK-03/04/05 mutation contract)"

affects: [78-02, 78-03, 78-04]

tech-stack:
  added:
    - "@dnd-kit/core@6.3.1"
    - "@dnd-kit/sortable@10.0.0"
    - "@dnd-kit/modifiers@9.0.0"
    - "@dnd-kit/utilities@3.2.2"
  patterns:
    - "Wave-0 RED test scaffold: create test files before implementation modules"
    - "cancelLabel prop default pattern: optional string prop with hardcoded default"

key-files:
  created:
    - taskflow/src/services/jira/rank-api.test.ts
    - taskflow/src/routes/dashboard/__tests__/BacklogPage.rank.test.ts
  modified:
    - taskflow/src/test/package-deps.guard.test.ts
    - taskflow/package.json
    - taskflow/package-lock.json
    - taskflow/src/components/ui/confirm-sprint-move-dialog.tsx

key-decisions:
  - "@dnd-kit guard removed before install so suite never transitions through a red state on the guard test"
  - "Wave-0 test scaffolds fail with module-not-found (correct RED) not parse errors — vitest collects them cleanly"
  - "cancelLabel defaulted to 'Cancel' in component signature (not interface) so existing callers need no changes"

patterns-established:
  - "Wave-0 RED scaffold: import from not-yet-created module; fails at collection time with module-not-found"
  - "cancelLabel prop: optional string in interface + default in destructure + {expression} in render"

requirements-completed: [RANK-03, RANK-04, RANK-05]

duration: 8min
completed: 2026-06-03
---

# Phase 78 Plan 01: Foundation Summary

**@dnd-kit packages installed (D-12 guard removed), cancelLabel prop on ConfirmSprintMoveDialog, and two Wave-0 RED test scaffolds defining RANK-03/04/05 mutation contract**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-03T14:18:00Z
- **Completed:** 2026-06-03T14:26:10Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Removed the Phase 67 `@dnd-kit absence guard` describe block and installed all four `@dnd-kit/*` packages at RESEARCH-verified versions; guard test passes with 4 react-grid-layout assertions
- Added `cancelLabel?: string` prop (default `'Cancel'`) to `ConfirmSprintMoveDialog`; existing callers unchanged; Plan 04 drag context will pass `cancelLabel="Keep Position"`
- Created `rank-api.test.ts` with 5 RED cases (correct PUT body, integer `rankCustomFieldId` fixture 10105, `rankBeforeIssue` top-of-list, 401→ApiError, 500→Error, `typeof` assertion)
- Created `BacklogPage.rank.test.ts` with RANK-03/04/05 RED scaffolds (fixture integer, rollback banner copy, `cancelQueries` with `['gh-backlog', boardId]` key)

## Task Commits

1. **Task 1: Remove @dnd-kit absence guard and install packages** - `cbda5d5b` (chore)
2. **Task 2: Add cancelLabel prop to ConfirmSprintMoveDialog** - `927aebe1` (feat)
3. **Task 3: Create Wave-0 test scaffolds RANK-03/04/05** - `985f2848` (test)

## Files Created/Modified

- `taskflow/src/test/package-deps.guard.test.ts` - Removed `@dnd-kit absence guard` describe block (lines 52-82); react-grid-layout guard retained
- `taskflow/package.json` - Added `@dnd-kit/core`, `/sortable`, `/modifiers`, `/utilities` to dependencies
- `taskflow/package-lock.json` - Lock file updated by npm install
- `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx` - Added `cancelLabel?: string` prop with default `'Cancel'`
- `taskflow/src/services/jira/rank-api.test.ts` - NEW: Wave-0 RED scaffold for `rankIssueApi` service (Plan 03 turns GREEN)
- `taskflow/src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` - NEW: Wave-0 RED scaffold for BacklogPage rank mutation (Plan 04 turns GREEN)

## Decisions Made

- Removed the absence guard BEFORE running `npm install` so the guard test never transitions through a failing state
- Both test scaffolds import from `./rank-api` (which does not exist yet) — they fail with `Failed to resolve import` at collection time, not at assertion time; this is the correct RED state for Wave-0
- `cancelLabel` default lives in the function destructure (`cancelLabel = 'Cancel'`) following the existing `isPending` pattern; callers that omit it see no change

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (rank.ts bug fixes) can proceed in parallel — no dependencies on this plan's output
- Plan 03 (rank-api.ts implementation) turns `rank-api.test.ts` GREEN
- Plan 04 (BacklogPage drag wiring) turns `BacklogPage.rank.test.ts` GREEN and uses `cancelLabel="Keep Position"` on the ConfirmSprintMoveDialog

---
*Phase: 78-drag-to-rank-on-backlog*
*Completed: 2026-06-03*
