---
phase: 101-issue-drafts-large-create-edit-modal
plan: 08
subsystem: ui
tags: [modal, layout, sidebar, labels, fix-version]
requires:
  - phase: 101-01
    provides: form state labels/fixVersions, query flags
  - phase: 101-05
    provides: LabelsField, FixVersionField
provides:
  - Large two-column Create/Edit modal shell
  - ModalSidebar field stack
  - footer status slot (data-testid modal-footer-status) for plan 09
  - staleNotes prop slot on ModalSidebar for plan 10
affects: [101-09, 101-10]
key-files:
  created:
    - taskflow/src/routes/dashboard/create-edit-issue/ModalSidebar.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.layout.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.labels.test.tsx
  modified:
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
    - taskflow/src/routes/dashboard/CreateEditIssueModal.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.drafts.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.attachments.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.epic-story.test.tsx
requirements-completed: [UI-01, DRAFT-04]
completed: 2026-11-18
---

# Phase 101 Plan 08: Large two-column modal Summary

Create/Edit now opens as a fixed min(1080px,94vw) x 88vh dialog with header, scrolling main column, 300px sidebar (240px under a 900px dialog, stacked below 720px) and a sticky footer; Labels and Fix version live in the new ModalSidebar.

## Commits
- b863991f: feat(101-08) modal shell, ModalSidebar, copy and tests (tasks 1 and 2 combined in one commit because the pre-commit hook runs the full suite)

## Notes
- Copy now follows UI-SPEC: "Create issue" / "Edit {KEY}" title, "Create Issue" / "Save Changes" buttons with tooltips, sidebar label "Epic" (was "Epic Link"). Existing tests updated accordingly.
- canSubmit extended with labels-required and fix-version-required checks.
- Edit with unseeded or untouched labels/fixVersions sends neither field (tested).
- Footer left status div is empty; plan 09 fills it. `staleNotes` is accepted by ModalSidebar but the modal does not pass it yet (plan 10).

## Deviations from Plan
- Description editor wrapper in the main column got `min-h-0 flex-1` on the section so the editor fills remaining height; otherwise as planned.
- The IssueTypeSelector keeps its small "Issue Type" label inside the header (w-40 wrapper); no component change was made.

## Known Stubs
- `modal-footer-status` is intentionally empty until plan 09.

## Self-Check: PASSED
Files exist, commit b863991f present, full vitest suite (6687 tests) green at commit.
