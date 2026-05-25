---
phase: 70-standup-notes-today-section
plan: "01"
subsystem: standup-notes
tags: [filter, pure-function, unit-tests, sprint-issues, tdd]
dependency_graph:
  requires: []
  provides: [filterSprintItems, FilteredSprintItems]
  affects: [TodayColumn.tsx (wave 2)]
tech_stack:
  added: []
  patterns: [pure-data-transform, vitest-unit-test, fixture-builder]
key_files:
  created:
    - taskflow/src/routes/standup-notes/filterSprintItems.ts
    - taskflow/src/routes/standup-notes/filterSprintItems.test.ts
  modified: []
decisions:
  - "Used `as unknown as JiraIssue` cast in makeIssue fixture to build minimal stubs without satisfying every field of the full JiraIssue interface — consistent with YesterdayColumn.test.ts pattern"
metrics:
  duration: "~3m"
  completed: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 70 Plan 01: filterSprintItems Pure Helper Summary

Pure `filterSprintItems(issues, jiraUserDisplayName) => { inProgress, upNext }` helper extracted per D-04 (leaf-item scope: subtasks always leaf, childless tasks leaf, parents with subtasks excluded) and D-05 (status-category split: indeterminate → inProgress, new → upNext, done excluded), with a 6-test Vitest suite proving every behavior.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write filterSprintItems pure helper | 080ad48e | filterSprintItems.ts |
| 2 | Write filterSprintItems unit test suite | cfc821cc | filterSprintItems.test.ts |

## What Was Built

**filterSprintItems.ts** — Pure TypeScript helper with no React, no queries, no side effects:
- Exports `FilteredSprintItems` interface (`inProgress: JiraIssue[]`, `upNext: JiraIssue[]`)
- Exports `filterSprintItems(issues, jiraUserDisplayName)` function
- `isLeaf` predicate: `issuetype.subtask === true` (always leaf, short-circuits) OR `(!subtask && subtasks.length === 0)` (childless non-subtask)
- `isAssignedToMe` predicate: `assignee?.displayName === jiraUserDisplayName`
- JSDoc documents D-04/D-05 design references
- Zero `useQuery`, zero JSX, zero side effects

**filterSprintItems.test.ts** — Vitest unit suite, 6/6 green:
- `makeIssue` fixture builder (key, statusKey, isSubtask, subtasksLen, displayName)
- Test: subtask with indeterminate → inProgress
- Test: childless task with new → upNext
- Test: parent task (subtasksLen > 0) → excluded from both
- Test: done items → excluded from both
- Test: wrong assignee → excluded
- Test: no assignee (null) → excluded

## Verification

- `npx vitest run src/routes/standup-notes/filterSprintItems.test.ts`: 6/6 pass
- `tsc --noEmit`: zero errors referencing filterSprintItems
- `grep -c 'useQuery' filterSprintItems.ts`: 0
- `grep -c 'return (' filterSprintItems.ts`: 0 (no JSX)

## Deviations from Plan

None — plan executed exactly as written.

**Note on test runner setup:** The git worktree does not have its own `node_modules`. A symlink `worktree/taskflow/node_modules → main/taskflow/node_modules` was created to allow vitest to resolve imports. This is a non-code deviation (no source files affected); the symlink will be discarded when the worktree is removed.

## Known Stubs

None — `filterSprintItems` is a complete, fully-implemented pure function with no TODOs, placeholders, or hardcoded empty returns.

## Threat Flags

None — this plan adds no network calls, no token handling, no DOM injection, no new persisted state. Pure in-memory data transform only (confirmed T-70-01 accepted per plan threat model).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| filterSprintItems.ts exists | FOUND |
| filterSprintItems.test.ts exists | FOUND |
| 70-01-SUMMARY.md exists | FOUND |
| Commit 080ad48e (Task 1) | FOUND |
| Commit cfc821cc (Task 2) | FOUND |
