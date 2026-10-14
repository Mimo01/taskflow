---
phase: quick-261014-m6e
plan: 01
subsystem: dashboard / jira transitions
tags: [jira, transitions, dialog, subtask, parent-story]
requires: []
provides:
  - checkParentCompletion / invalidateAfterTransition (services/jira/parentCompletion.ts)
  - useParentCompletionPrompt + CompleteParentDialog (routes/dashboard/CompleteParentDialog.tsx)
affects: [SprintBoardTab, FieldsSection, StatusPopover]
key-files:
  created:
    - taskflow/src/services/jira/parentCompletion.ts
    - taskflow/src/services/jira/parentCompletion.test.ts
    - taskflow/src/routes/dashboard/CompleteParentDialog.tsx
    - taskflow/src/routes/dashboard/CompleteParentDialog.test.tsx
  modified:
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/StatusPopover.tsx
    - tests for each
decisions:
  - New module parentCompletion.ts (not transitions.ts) to avoid breaking suites that fully mock transitions.ts
  - Sibling categories read fresh from GET issue; JQL search fallback only when embedded subtasks lack statusCategory; fail safe to no prompt
  - Gate (subtask, to done, from not done) runs before any network call
metrics:
  tasks: 3
  completed: 2026-10-14
---

# Quick 261014-m6e: Prompt to move story to done when last subtask closes

Closing the last open subtask (Sprint Board or issue-detail sidebar) now opens a modal offering to move the parent story to done. The user picks among the parent's done-category transitions, and a resolution is requested through the existing BoardResolutionDialog when needed.

## Commits
- d92d6d1a: parentCompletion service
- 6e5b61be: hook + dialog
- 894ca466: board/sidebar/StatusPopover wiring

## Deviations from Plan
None of substance. Minor: `boardId` typed `number | null` to match the invalidate helpers. Worktree had no `taskflow/node_modules`, so a gitignored symlink to the main checkout's node_modules was created to run hooks/tests. Worktree base was reset to d892b6b5 per the branch check.

## Notes
- FieldsSection test: the StatusPopover mock now exposes two trigger buttons (existing assertions unchanged).
- Existing StatusPopover test expectations updated for the new 4th arg (intentional signature change).
- Full vitest suite (3579 tests), tsc, and biome on touched files pass.

## Known Stubs
None.

## Self-Check: PASSED
