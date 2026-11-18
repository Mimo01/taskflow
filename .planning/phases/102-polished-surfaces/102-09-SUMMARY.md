---
phase: 102-polished-surfaces
plan: 09
subsystem: ui
tags: [modal, ModalShell, copy]
requires: [102-01, 102-05]
provides:
  - Create/Edit Issue modal rendered through ModalShell
  - Sentence-case primary copy (Create issue / Save changes / Creating… / Saving…)
affects: [CreateEditIssueModal]
key-files:
  modified:
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.layout.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.createAnother.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.drafts.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.issueDrafts.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.labels.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.resume.test.tsx
decisions:
  - Create another checkbox kept as raw input (no shared Checkbox used in the modal)
  - Openers outside the modal (BacklogPage, worklogs) left unchanged
metrics:
  tasks: 1
  completed: 2026-11-18
---

# Phase 102 Plan 09: Issue modal on ModalShell Summary

The Issue modal now renders through the shared ModalShell, using the existing Esc/close handler, Cmd+Enter shortcut, aside blur flush and DiscardChangesDialog (via afterContent) unchanged, and its primary copy is sentence case.

## Deviations from Plan

None. The 144 tests in create-edit-issue pass and tsc is clean. Biome reports one info-level noUselessFragments note on the footerStatus fragment (not an error).

## Self-Check: PASSED
