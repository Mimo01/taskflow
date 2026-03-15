---
phase: 09-custom-field-discovery-issue-detail-foundation
plan: "05"
subsystem: ui
tags: [react, tanstack-query, optimistic-updates, inline-editing, jira, sidebar]

# Dependency graph
requires:
  - phase: 09-04
    provides: IssueDetailSidebar read-only display + IssueDetailSheet container
  - phase: 09-02
    provides: updateIssueField() in jira.ts service

provides:
  - IssueDetailSidebar with click-to-edit for priority, story points, assignee, labels
  - useFieldMutation hook with TanStack Query v5 onMutate/onError/onSettled pattern
  - Optimistic cache update + rollback on mutation failure
  - DC-format assignee update using { name } not { accountId }
  - Cache invalidation on settle for detail + sprint-board + my-tasks

affects:
  - Phase 10 (sprint board may use same inline editing pattern)
  - Phase 11 (issue create/edit form builds on same mutation approach)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useFieldMutation hook — TanStack Query v5 useMutation with onMutate/onError/onSettled for optimistic cache updates
    - Click-to-edit inline pattern — state toggle between display and edit mode, aligned with StatusPopover approach
    - DC assignee format — { name: username } not { accountId } for Jira Data Center compatibility

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx

key-decisions:
  - "useFieldMutation extracted as shared hook inside IssueDetailSidebar — keeps mutation logic co-located with the editing UI"
  - "Assignee picker uses PopoverTrigger from @base-ui/react/popover (no asChild) — base-ui popover does not support asChild pattern"
  - "Priority edit uses Select component open immediately on click — user doesn't need a two-step click (click button, then open select)"
  - "Story points: blur commits, Escape cancels — consistent with standard form field behavior"
  - "Labels: badge chips with × remove buttons + inline Add input — avoids complex multi-select component"

patterns-established:
  - "useFieldMutation(issueKey, jiraBaseUrl) hook pattern — reusable template for any field optimistic update"
  - "onMutate snapshot → setQueryData → return { previous }; onError restores previous; onSettled invalidates 3 query keys"
  - "Inline error display with text-xs text-destructive below the editing field"

requirements-completed: [ISSUE-04]

# Metrics
duration: 12min
completed: 2026-03-13
---

# Phase 09 Plan 05: Inline Field Editors Summary

**Click-to-edit optimistic updates for priority, story points, assignee, and labels in IssueDetailSidebar using TanStack Query v5 onMutate/onError/onSettled pattern with DC-format assignee (name not accountId)**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-13T23:53:00Z
- **Completed:** 2026-03-13T23:58:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Implemented `useFieldMutation` hook matching RESEARCH.md Pattern 4 exactly
- All four fields click-to-edit: priority (Select), story points (number Input), assignee (Popover + typeahead), labels (badge chips + inline Add)
- Optimistic cache update applied immediately via `onMutate`, rolled back via `onError`, invalidated via `onSettled`
- Inline "Save failed — changes reverted" error message on mutation failure
- All 20 IssueDetailSheet tests pass including 7 new ISSUE-04 optimistic tests

## Task Commits

1. **RED: add failing ISSUE-04 optimistic update tests** - `f950da0` (test)
2. **GREEN: implement inline field editors** - `05e86d4` (feat)

## Files Created/Modified

- `taskflow/src/routes/dashboard/IssueDetailSidebar.tsx` - Extended with useFieldMutation hook and click-to-edit UI for all four editable fields
- `taskflow/src/routes/dashboard/IssueDetailSheet.tsx` - Now passes issueKey and jiraBaseUrl to IssueDetailSidebar
- `taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx` - 7 new ISSUE-04 tests added (cache mutation patterns + priority-edit trigger RED test)

## Decisions Made

- `useFieldMutation` is a module-level function (not a component) that returns a `useMutation` result — kept inside IssueDetailSidebar.tsx for co-location
- Used `@base-ui/react/popover`'s `PopoverTrigger` directly (not with `asChild`) since base-ui doesn't support the asChild/slot pattern; eliminated the console warning
- Priority select opens immediately on click (not two-step) — reduces friction for the most common edit operation
- Debounce on assignee search set to 300ms per RESEARCH.md specification

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed asChild from PopoverTrigger**
- **Found during:** Task 1 (implementation)
- **Issue:** `<PopoverTrigger asChild>` caused React "unrecognized prop" warning because base-ui PopoverTrigger doesn't support the asChild/composition pattern
- **Fix:** Changed to use PopoverTrigger directly without asChild, moved data-testid and styling onto the trigger itself
- **Files modified:** taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
- **Verification:** Console warning eliminated; tests still pass
- **Committed in:** 05e86d4 (feat commit)

---

**Total deviations:** 1 auto-fixed (1 bug/incorrect prop usage)
**Impact on plan:** Fix necessary for correct behavior. No scope creep.

## Issues Encountered

None — implementation followed plan interfaces exactly.

## Next Phase Readiness

- ISSUE-04 complete; inline editing now works for all four fields
- The `useFieldMutation` hook is a clean template for any additional inline field edits in later phases
- Pre-existing test failures in MyTasksTab, ReleasesTab, SubtasksPanel are out of scope — logged to deferred-items as pre-existing

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
- FOUND: taskflow/src/routes/dashboard/IssueDetailSheet.tsx
- FOUND: .planning/phases/09-custom-field-discovery-issue-detail-foundation/09-05-SUMMARY.md
- FOUND commit f950da0 (test: RED tests)
- FOUND commit 05e86d4 (feat: GREEN implementation)
- All 20 IssueDetailSheet.test.tsx tests passing

---
*Phase: 09-custom-field-discovery-issue-detail-foundation*
*Completed: 2026-03-13*
