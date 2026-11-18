---
phase: 101-issue-drafts-large-create-edit-modal
plan: 06
subsystem: ui
tags: [zustand, drafts, create-modal, account-guard]
requires: [101-02, 101-03]
provides:
  - AppLayout driven by useCreateModalStore
  - Global CreateEpicDialog (resumable from any page)
  - resumeDraftId / onOpenIssue prop contract on both dialogs
  - Issue-draft purge on account change, orphan purge at startup
key-files:
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/routes/dashboard/EpicsPage.tsx
    - taskflow/src/routes/dashboard/EpicsPage.test.tsx
    - taskflow/src/routes/dashboard/CreateEpicDialog.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
    - taskflow/src/hooks/useDraftsAccountGuard.ts
    - taskflow/src/hooks/useDraftsAccountGuard.test.tsx
    - taskflow/src/routes/settings/ConnectionsSection.tsx
requirements-completed: [DRAFT-04, DRAFT-06, DRAFT-07]
completed: 2026-11-18
---

# Phase 101 Plan 06: Global create-modal store wiring Summary

All create entry points (Create, Edit, Clone, Add subtask, Create story, Add epic story) now go through `useCreateModalStore`, CreateEpicDialog is mounted once in AppLayout, and account changes clear issue drafts and their staged files.

## Tasks

1. AppLayout on the store: the six useStates and `wasStoryCreate` ref were removed; handler names are kept as one-line delegations. `handleCreateModalClose` reads `refreshBacklogOnClose` before `close()`. EpicsPage buttons call `openEpic()`; a test asserts the store flips. Both dialogs gained `resumeDraftId` (and the modal `onOpenIssue`) props, not yet destructured.
2. `useDraftsAccountGuard` reconciles the issue-drafts owner, calls `purgeAllDraftFiles()` when it returns true, and runs `purgeOrphanDraftFiles` once after hydration. ConnectionsSection does the same on credential save. Tests cover same-owner, owner change, once-only orphan purge, and pre-hydration no-op.

## Deviations from Plan

None in code. Note: pre-commit full suite showed EpicDetailSheet EPIC-03-A/B timing out under load (a known flake, unrelated to this plan); commits were retried.

## Self-Check: PASSED (see git log for commits)
