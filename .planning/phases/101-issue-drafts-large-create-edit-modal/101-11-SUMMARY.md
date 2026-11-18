---
phase: 101-issue-drafts-large-create-edit-modal
plan: 11
subsystem: ui
tags: [drafts, epic, zustand, create-dialog]
requires: [101-02, 101-03, 101-04, 101-06, 101-07, 101-09]
provides:
  - Epic drafts (autosave, resume, discard, cleanup) in CreateEpicDialog
affects: [CreateEpicDialog]
key-files:
  modified:
    - taskflow/src/routes/dashboard/CreateEpicDialog.tsx
    - taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx
requirements: [DRAFT-01, DRAFT-04, DRAFT-05, DRAFT-07]
completed: 2026-11-18
---

# Phase 101 Plan 11: Epic drafts in Create Epic Summary

Create Epic now autosaves to the drafts store (kind 'epic'), keeps the draft on every close without a prompt, resumes from the Drafts chip with name, description and staged files restored, and removes the draft and its file copies on create or discard.

## What was done
- `CreateEpicDialog.tsx`: `useIssueDraft({ kind: 'epic' })`, `useDraftStagedFiles` replacing the local staged-files state, an editTick pattern so autosave fires only from user edits, once-per-open resume/blank effect gated on draft hydration, image previews via `setLocalPreview` with rAF retry and revoke on close, `DraftNote` ("Draft saved · Discard"), and cleanup (`removeDraftFiles`) on create (clean and upload-failure paths) and discard. Classes, sizes and copy are otherwise unchanged.
- `CreateEpicDialog.test.tsx`: 10 new tests covering autosave on close, no draft without content, blank open, resume with missing file flag, restored image preview, discard, create cleanup, upload-failure cleanup, and the chip-to-Epic resume path using `DraftsChip` with `useCreateModalStore`.

## Commits
- f9f139f9: feat(101-11): epic drafts autosave, resume and cleanup in Create Epic dialog (Tasks 1 and 2 combined, since the Task 2 integration test only extends the same test file)

## Deviations from Plan
- `useDraftResume` (named in the plan's read list) does not exist in this worktree (plan 10 owns it in parallel), so the resume and preview-retry logic is implemented inline in the dialog.
- The image-preview test asserts `URL.createObjectURL` is called rather than spying `setLocalPreview`, because the shared editor stub's handle is a no-op.

## Known Stubs
None.

## Self-Check: PASSED
Full pre-commit suite (biome, tsc, 6720 vitest tests) passed on commit f9f139f9.
