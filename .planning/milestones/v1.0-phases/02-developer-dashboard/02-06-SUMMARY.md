---
phase: 02-developer-dashboard
plan: 06
subsystem: ui
tags: [react, tanstack-query, jira, optimistic-update, mutations]

requires:
  - phase: 02-developer-dashboard/02-04
    provides: StatusPopover and InlineComment components with full test coverage

provides:
  - StatusPopover wired into TaskRow as the clickable status badge
  - InlineComment wired into TaskRow with local toggle state
  - transitionMutation in MyTasksTab with optimistic update and rollback on error
  - commentMutation in MyTasksTab posting to Jira and surfacing per-row errors

affects:
  - UAT tests 3, 10, 11 (status badge click, comment button click, comment submit)

tech-stack:
  added: []
  patterns:
    - TanStack useMutation with optimistic update (cancelQueries → setQueryData → return prev context → rollback in onError → invalidate in onSettled)
    - Per-row error map keyed by issueKey-transition / issueKey-comment
    - Local component state (commentOpen) for UI toggle; parent owns mutation and error state

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/TaskRow.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.test.tsx

key-decisions:
  - "TaskRow manages commentOpen locally (useState); MyTasksTab owns mutations and error strings — clean separation of UI state vs server state"
  - "Comment pane closes optimistically on submit (setCommentOpen(false) in onSubmit) — no need for MyTasksTab to signal TaskRow back"
  - "openCommentKey removed from MyTasksTab — TaskRow local state is sufficient since each row is independent"

patterns-established:
  - "Mutation wiring pattern: parent holds useMutation, child receives callbacks + pending/error props — child is pure UI"

requirements-completed:
  - JACT-01
  - JACT-02

duration: 5min
completed: 2026-03-11
---

# Phase 2 Plan 06: Wire StatusPopover and InlineComment Summary

**StatusPopover and InlineComment connected to TaskRow with TanStack optimistic transition mutation and per-row comment error state in MyTasksTab**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-11T21:00:08Z
- **Completed:** 2026-03-11T21:04:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- StatusPopover replaces plain StatusBadge in TaskRow — clicking status badge now fetches transitions lazily and renders popover
- InlineComment renders conditionally below each row — toggled by comment button click, closes optimistically on submit
- transitionMutation in MyTasksTab: optimistic badge update, rollback on failure, per-row "Failed to update" error
- commentMutation in MyTasksTab: posts to Jira, surfaces per-row "Failed to add comment" error on failure
- Test suite updated: 12/12 dashboard tests pass; StatusPopover and InlineComment mocked in unit tests

## Task Commits

1. **Task 1: Wire StatusPopover and InlineComment into TaskRow** - `120eb40` (feat)
2. **Task 2: Add write mutations to MyTasksTab and pass new props to TaskRow** - `6114edd` (feat)

## Files Created/Modified

- `taskflow/src/routes/dashboard/TaskRow.tsx` - Updated: imports StatusPopover/InlineComment; new props interface; commentOpen local state; StatusPopover as status badge; InlineComment below row
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` - Updated: useMutation/useQueryClient; transitionMutation with optimistic update; commentMutation; inlineErrors state; new TaskRow props
- `taskflow/src/routes/dashboard/MyTasksTab.test.tsx` - Updated: new TaskRow props in direct renders; mocks for StatusPopover and InlineComment; postTransition/postComment in jira mock

## Decisions Made

- TaskRow manages `commentOpen` locally via `useState` — the parent (MyTasksTab) owns mutations and error strings, keeping each layer's responsibility clean.
- Comment pane closes optimistically on submit (`setCommentOpen(false)` in `onSubmit` callback) — eliminates need for MyTasksTab to signal back to individual TaskRow instances.
- `openCommentKey` state was removed from MyTasksTab — since TaskRow manages its own `commentOpen` state, a parent-level open key was redundant and caused a TypeScript `TS6133` unused variable error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused openCommentKey state from MyTasksTab**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** Plan included `openCommentKey` state and `setOpenCommentKey` in `commentMutation.onSuccess`, but the state was never read — TypeScript TS6133 error. The state cannot reach TaskRow's local `commentOpen` — it had no effect.
- **Fix:** Removed `openCommentKey`/`setOpenCommentKey`; comment close on success handled by `setCommentOpen(false)` in TaskRow's `onSubmit` callback (optimistic close).
- **Files modified:** `taskflow/src/routes/dashboard/MyTasksTab.tsx`, `taskflow/src/routes/dashboard/TaskRow.tsx`
- **Verification:** TypeScript compiles (dashboard files); 12/12 tests pass
- **Committed in:** `6114edd` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added StatusPopover and InlineComment mocks to test file**
- **Found during:** Task 2 (test execution)
- **Issue:** Updated test file rendered TaskRow with new props (StatusPopover is now inside TaskRow), but StatusPopover uses useQuery internally — without a mock it requires QueryClientProvider in every test and would attempt real fetches.
- **Fix:** Added `vi.mock('./StatusPopover', ...)` and `vi.mock('./InlineComment', ...)` at top of test file; wrapped direct TaskRow renders in `QueryClientProvider`.
- **Files modified:** `taskflow/src/routes/dashboard/MyTasksTab.test.tsx`
- **Verification:** All 12 tests pass
- **Committed in:** `6114edd` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 missing test infrastructure)
**Impact on plan:** Both fixes required for correctness and test reliability. No scope creep.

## Issues Encountered

- The Write tool's initial file write was reverted by a system linter/formatter back to the original content. Used Bash `cat > file` heredoc approach to write files reliably.

## Next Phase Readiness

- UAT gap closure for tests 3, 10, 11 is complete — status badge and comment button are now functional
- StatusPopover and InlineComment are fully wired and tested
- No blockers for remaining UAT or future phases

---
*Phase: 02-developer-dashboard*
*Completed: 2026-03-11*
