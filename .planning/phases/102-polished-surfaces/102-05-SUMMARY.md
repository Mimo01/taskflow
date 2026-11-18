---
phase: 102-polished-surfaces
plan: 05
subsystem: create-edit-issue
tags: [create-epic, modal-sidebar, priority, refactor]
requires: []
provides:
  - usePriorityOptions shared hook
  - epicNameFieldKey exclusion in useCreateEditQueries
  - ModalSidebar variant 'epic' + storyPointsOffered
affects: [102-06]
key-files:
  created:
    - taskflow/src/routes/dashboard/create-edit-issue/usePriorityOptions.ts
    - taskflow/src/routes/dashboard/create-edit-issue/usePriorityOptions.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/ModalSidebar.epic.test.tsx
  modified:
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts
    - taskflow/src/routes/dashboard/create-edit-issue/ModalSidebar.tsx
decisions:
  - Priority block moved verbatim into a hook; both query keys unchanged (edit key shared with issue-detail picker, T-102-12)
metrics:
  completed: 2026-11-18
---

# Phase 102 Plan 05: Shared Create/Edit pieces for Create Epic Summary

Priority options extracted into `usePriorityOptions`, Epic Name excluded from sidebar custom fields, and `ModalSidebar` gained an `epic` variant (Assignee, Priority, Labels, Fix version, optional Story points, custom fields), with the Issue modal unchanged.

## Tasks

1. Extract usePriorityOptions + epicNameFieldKey exclusion (commit 54ee5cca). Hook tests cover createmeta, reference-scheme, global fallback, loading and edit mode; plus a useCreateEditQueries case for the Epic Name exclusion.
2. ModalSidebar epic variant (commit 3b24e16e). 5 test cases for rows, order, story points and fix version gating, and issue variant regression.

## Deviations from Plan

None in code. Operational: the worktree had no node_modules, so a symlink to the main checkout's node_modules was added (untracked/ignored). The pre-commit full suite showed load-related timeouts in unrelated tests (EpicDetailSheet, IssueDetailParts, WorklogsPage, FindBar) while other agents ran concurrently; these pass in isolation or on retry.

## Known Stubs

None.

## Self-Check: PASSED
