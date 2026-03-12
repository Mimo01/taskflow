---
phase: 02-developer-dashboard
plan: "04"
subsystem: ui
tags: [react, tanstack-query, optimistic-update, jira, popover, base-ui]

# Dependency graph
requires:
  - phase: 02-developer-dashboard
    provides: TaskRow, MyTasksTab, fetchTransitions, postTransition, postComment from jira.ts
  - phase: 02-developer-dashboard
    provides: Popover, PopoverTrigger, PopoverContent from ui/popover
provides:
  - StatusPopover component with lazy transition fetching and onSelect callback
  - InlineComment component with autofocus, submit/cancel, inline error display
  - TaskRow with StatusPopover + InlineComment replacing stub click handlers
  - MyTasksTab with optimistic transition mutation, comment mutation, per-row inline error state
affects:
  - SprintBoardTab (read-only — no write actions, confirmed by architecture)

# Tech tracking
tech-stack:
  added: ["@testing-library/user-event (installed for click interaction tests)"]
  patterns:
    - "Optimistic update pattern: cancelQueries → setQueryData → onError rollback → onSettled invalidate"
    - "Per-row inline errors: Record<issueKey-action, message> in parent state, passed down as props"
    - "Lazy query fetch: useQuery(enabled: false) + refetch() on popover open — no fetch on mount"
    - "PopoverTrigger used directly (not asChild) to avoid nested-button accessibility issue with base-ui"

key-files:
  created:
    - taskflow/src/routes/dashboard/StatusPopover.tsx
    - taskflow/src/routes/dashboard/InlineComment.tsx
  modified:
    - taskflow/src/routes/dashboard/TaskRow.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.test.tsx

key-decisions:
  - "PopoverTrigger renders text directly (not asChild) — base-ui asChild wraps in outer button creating nested buttons, breaking getByRole in tests and duplicating click targets"
  - "InlineComment renders null when isOpen=false (not hidden) — cleaner DOM, no stale autofocus"
  - "Per-row inline errors keyed by issueKey-transition and issueKey-comment in MyTasksTab state map — scoped errors without prop drilling complex error objects"

patterns-established:
  - "TDD red-green: write failing tests first, install missing dependencies (user-event), then implement"
  - "TaskRow rendering tests need QueryClientProvider when StatusPopover is embedded (useQuery dependency)"

requirements-completed: [JACT-01, JACT-02]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 2 Plan 04: Write Actions — Status Transition + Comment Summary

**Jira write actions wired into My Tasks: status transition via StatusPopover with optimistic update + rollback, comment via InlineComment with inline error — both with loading feedback, no toasts or modals**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-11T14:08:22Z
- **Completed:** 2026-03-11T14:13:48Z
- **Tasks:** 1 (TDD: 2 commits — RED then GREEN)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- StatusPopover component: lazy fetchTransitions on popover open, renders transition list, optimistic selection
- InlineComment component: autofocus on expand, disabled Submit when empty, inline error display, Cancel clears and collapses
- TaskRow fully refactored from placeholder click handlers to real StatusPopover + InlineComment integration
- MyTasksTab now owns two useMutation hooks (transition + comment) with per-row inline error state map
- All 86 tests pass (18 new write-action tests added)

## Task Commits

Each task was committed atomically (TDD has two commits):

1. **RED: Write action failing tests** - `a68216c` (test)
2. **GREEN: StatusPopover + InlineComment + wiring** - `ffa790d` (feat)

**Plan metadata:** (docs commit below)

_Note: TDD tasks have two commits (test → feat)_

## Files Created/Modified
- `taskflow/src/routes/dashboard/StatusPopover.tsx` - Popover with lazy fetchTransitions, transition list, onSelect
- `taskflow/src/routes/dashboard/InlineComment.tsx` - Expandable textarea with autofocus, Submit/Cancel, inline error
- `taskflow/src/routes/dashboard/TaskRow.tsx` - Refactored with StatusPopover + InlineComment, new prop shape
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` - Added useMutation x2, optimistic update, per-row inline errors
- `taskflow/src/routes/dashboard/MyTasksTab.test.tsx` - 9 new write-action tests + updated TaskRow unit tests

## Decisions Made
- **PopoverTrigger without asChild**: base-ui's `asChild` wraps content in an extra `<button>` element rather than merging, creating nested buttons. Text rendered directly in `PopoverTrigger` produces a single accessible button element.
- **Inline errors as Record in parent state**: keyed by `${issueKey}-transition` and `${issueKey}-comment` — scoped per action per row without complex prop drilling. Parent (MyTasksTab) owns mutation state so it naturally owns error state.
- **enabled: false + refetch()** on StatusPopover: transitions fetched lazily on first open per RESEARCH.md anti-patterns guidance, not on mount.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @testing-library/user-event**
- **Found during:** RED phase test run
- **Issue:** Test file imports `@testing-library/user-event` which wasn't in package.json — vite build failed to resolve import
- **Fix:** `npm install --save-dev @testing-library/user-event`
- **Files modified:** package.json, package-lock.json
- **Verification:** Tests resolved and ran successfully
- **Committed in:** a68216c (RED test commit)

**2. [Rule 1 - Bug] Removed nested button from StatusPopover trigger**
- **Found during:** GREEN phase test run
- **Issue:** Using `PopoverTrigger asChild` with inner `<button>` produced two nested buttons in DOM — base-ui renders a wrapper button and then the child button inside it, causing `getByRole('button', { name: /in progress/i })` to find multiple elements
- **Fix:** Removed `asChild` prop, rendered status text directly inside `PopoverTrigger` (which is already a button)
- **Files modified:** taskflow/src/routes/dashboard/StatusPopover.tsx
- **Verification:** All 18 write-action tests pass, single accessible button per status badge
- **Committed in:** ffa790d (GREEN feat commit)

**3. [Rule 2 - Missing Critical] Wrapped TaskRow unit tests in QueryClientProvider**
- **Found during:** GREEN phase test run
- **Issue:** TaskRow now embeds StatusPopover which uses useQuery — rendering TaskRow directly without QueryClientProvider throws "No QueryClient set" error
- **Fix:** Added `renderTaskRow()` helper that wraps in QueryClientProvider for TaskRow unit tests
- **Files modified:** taskflow/src/routes/dashboard/MyTasksTab.test.tsx
- **Verification:** TaskRow rendering describe block — 4 tests pass
- **Committed in:** ffa790d (GREEN feat commit, test file was re-staged)

---

**Total deviations:** 3 auto-fixed (1 blocking dependency, 1 bug, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness and test infrastructure. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `OnboardingWizard.tsx`, `GitLabStep.tsx`, `JiraStep.tsx`, `TokenSection.tsx`, `stronghold.ts` — out of scope, not related to this plan's changes, logged but not fixed

## Next Phase Readiness
- Write actions complete — status transition and comment are the core productivity features
- Sprint board is confirmed read-only (SprintBoardTab has no StatusPopover or InlineComment)
- Phase 2 complete — all 4 plans done
- Phase 3 ready: notification layer can build on top of the polling infrastructure established here

---
*Phase: 02-developer-dashboard*
*Completed: 2026-03-11*
