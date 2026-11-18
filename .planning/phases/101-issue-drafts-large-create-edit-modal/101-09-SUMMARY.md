---
phase: 101-issue-drafts-large-create-edit-modal
plan: 09
subsystem: ui
tags: [drafts, modal, autosave, create-another, staged-files]
requires:
  - phase: 101-02
    provides: issue-draft-files (stage/read/remove copies)
  - phase: 101-03
    provides: useIssueDraft
  - phase: 101-04
    provides: toIssueSnapshot, hasUserContent, keptFieldsAfterCreate
  - phase: 101-08
    provides: large modal shell, footer status slot
provides:
  - useDraftStagedFiles hook (File[] + disk copy refs + restore + missing list)
  - StagedFilesStrip missing-file tiles
  - Create modal autosave, keep-on-close, draft note + Discard, draft removal on create
  - Create another (checkbox, kept fields, inline result, fresh draft lifecycle)
affects: [101-10, 101-11, 101-12]
key-files:
  created:
    - taskflow/src/hooks/useDraftStagedFiles.ts
    - taskflow/src/hooks/useDraftStagedFiles.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.issueDrafts.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.createAnother.test.tsx
  modified:
    - taskflow/src/routes/dashboard/StagedFilesStrip.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.drafts.test.tsx
    - taskflow/src/test/setup.ts
requirements-completed: [UI-02, DRAFT-01, DRAFT-02, DRAFT-05, DRAFT-07]
completed: 2026-11-18
---

# Phase 101 Plan 09: Create drafts and Create another Summary

Create mode now autosaves an independent draft on user edits (debounced, flushed on blur and every close, never on state effects alone), copies staged files into app storage, shows "Draft saved · Discard" in the footer, removes the draft and copies on successful create, keeps it on failure, and supports "Create another" with the kept-field reset.

## Commits
- Task 1: useDraftStagedFiles hook and missing-file tiles (commit message "feat(101-09): useDraftStagedFiles hook and missing-file tiles")
- Tasks 2 and 3: "feat(101-09): issue draft autosave, discard and Create another in the modal" (combined: both edit the same file and the pre-commit hook runs the full suite)

## Design notes
- Autosave effect is keyed only on `editTick`, bumped by `userDispatch` (passed to selector, sidebar, links, Summary, description) and by staged-file changes. It reads latest state through a ref, so the previous session's reducer state can never be saved after open.
- The footer draft note renders only once the draft exists in the store (not merely when an id was allocated for a file copy).
- Focus of Summary after Create another is driven by a `focusSummary` flag plus an effect that waits for `isPending` to clear (the input is disabled while pending), instead of requestAnimationFrame.
- Create-mode apiError renders the UI-SPEC lead line with the Jira message as a second `text-xs` line.

## Deviations from Plan

**1. [Rule 3 - Blocking] jsdom lacks crypto.randomUUID**
- Found during: Task 2 (existing epic-story tests failed through `useIssueDraft.ensureId`)
- Fix: `src/test/setup.ts` crypto stub now also exposes node's `randomUUID`.
- Files: taskflow/src/test/setup.ts

**2. [Rule 1 - Test fix] Existing drafts test assumed no "Draft saved" in Create mode**
- Fix: `CreateEditIssueModal.drafts.test.tsx` now asserts the single note is the footer issue-draft note while still asserting the description draft store is untouched.

**3. Tasks 2 and 3 committed together** (same file; hook runs the full suite per commit).

## Known gaps
- "Kept fields" (priority, assignee, epic, labels, fix versions, custom fields) are covered by the `keptFieldsAfterCreate` unit tests from plan 04; the modal test checks the reset of non-kept fields (summary, description, story points, staged files) rather than driving each picker.
- `resumeDraftId` is still unused (plan 10).

## Self-Check: PASSED
Full vitest suite (6711 tests), tsc and biome green at the final commit.
