---
phase: 102-polished-surfaces
plan: 06
subsystem: create-epic
tags: [create-epic, modal-shell, drafts, sidebar]
requires: [102-01, 102-04, 102-05]
provides:
  - CreateEpicDialog on ModalShell + ModalSidebar (epic variant)
  - sidebar-aware epic drafts with stale-field notes
affects: [102-10]
key-files:
  modified:
    - taskflow/src/routes/dashboard/CreateEpicDialog.tsx
    - taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx
decisions:
  - Separate CreateEpicDialog kept (not an Epic mode of the Issue modal); form state comes from useCreateEditForm with defaultIssueType 'Epic'
  - Footer Cancel follows the Issue Esc contract: with content it opens the discard dialog (previously Cancel closed silently); X and backdrop keep the draft
metrics:
  tasks: 2
  completed: 2026-11-18
---

# Phase 102 Plan 06: Create epic on the shared shell Summary

Create epic now opens in the two-column Issue shell with an Epic name Input, the full description editor with Attach and staged files, and a `ModalSidebar` (epic variant) driven by the Epic createmeta; sidebar values go out through `buildEpicCreateFields` and are saved into and restored from epic drafts (D-08 to D-11).

## Tasks

1. Shell, sidebar, payload, footer, discard flow (D-08, D-10, D-11).
2. Sidebar-aware drafts: `toEpicSnapshot` autosave, `epicSnapshotToFormPatch` resume, one-time `validateSnapshot` after createmeta and fix versions settle, stale notes in the sidebar (D-09).

Both tasks landed in one commit: the pre-commit hook runs the whole suite and blocks RED-only commits, and the draft logic shares the file rewritten in task 1.

## Deviations from Plan

- Cancel button with content now opens "Discard changes?" (plan footer wires `requestCancel`); the old test asserting Cancel keeps a draft with no prompt was changed to use the X button for that case.
- Test pickers (assignee, labels, fix version, custom fields) are stubbed to buttons dispatching the real reducer actions; priority is covered via a resumed draft because the Base UI Select is awkward to drive in jsdom.
- A `node_modules` symlink was added in the worktree (git-ignored).

## Known Stubs

None.

## Self-Check: PASSED (see git log for the feature commit)
