---
phase: 102-polished-surfaces
plan: 07
subsystem: ui
tags: [modal, bulk-create-subtasks, modal-shell]
requires: [102-01]
provides:
  - Bulk create subtasks modal on the shared ModalShell (one column)
affects: []
tech-stack:
  added: []
  patterns: [ModalShell toolbar slot, shared Button/EmptyState]
key-files:
  created:
    - taskflow/src/routes/dashboard/BulkCreateSubtasksModal.dom.test.tsx
  modified:
    - taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.test.tsx
key-decisions:
  - "Footer secondary button stays labelled Close (not Cancel) because subtasks may already exist after a run"
requirements-completed: [UI-05]
duration: 25min
completed: 2026-11-18
---

# Phase 102 Plan 07: Bulk create subtasks on ModalShell Summary

Bulk Create Subtasks now renders inside `ModalShell` (fixed Issue-modal size, blurred backdrop, sticky footer) with the template/type Selects and skipped badge pinned in the toolbar slot and only the row list scrolling; row advanced-field Select trigger now matches the h-8/text-sm field size.

## Tasks

1. Bulk modal on ModalShell: shell, toolbar slot, compact EmptyState ("No subtasks yet"), ghost Add row Button, sentence-case copy ("Create subtasks", "Retry failed", apiFetch label), `closeDisabled={creating}` with onOpenChange still ignoring close while creating. DOM test added (7 assertions across title/parent, size classes, toolbar outside scroller, empty state/add row, footer, Esc when idle). Creation loop untouched; BulkCreateSubtasksModal.test.ts green.
2. SubtaskTemplateRow: advanced SelectTrigger `h-7 text-xs` -> `h-8 text-sm`, class-token test added. No raw input/select/textarea remain; settings drag-handle stays a native button (dnd-kit grip).

## Deviations from Plan

- The Esc/Close-disabled-while-creating DOM case is not covered by a new test: reaching the creating state needs a mocked Jira create flow; the guard is unchanged logic (`if (!o && !creating)`) and `closeDisabled` is covered by ModalShell tests from plan 01. An idle-Esc test was added instead.
- Worktree base was reset to 087fb15d per the branch check (merge-base mismatch).

## Known Stubs

None.

## Self-Check: PASSED
