---
phase: quick-261116-c5g
plan: 01
subsystem: create-edit-issue modal
tags: [jira, create-modal, epic, inheritance]
key-files:
  modified:
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
    - taskflow/src/main.tsx
  created:
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.epic-story.test.tsx
metrics:
  completed: 2026-11-16
---

# Quick 261116-c5g: Epic "Add story" inherits Account from the epic

Epic "Add story" now prefills required custom fields (Account) from the epic, following the Epic Link as it changes. The no-auto-close report could not be reproduced and its root cause is NOT identified.

## Commits

- 0af65ff7 feat: epic stories inherit required custom fields from the epic (Task 1)
- 24adc464 fix: epic story create refreshes epic detail; close-first guard (Task 2)

## Task 1: inheritance

- `useCreateEditQueries`: the `['parent-fields', key]` query takes `inheritFromKey` and is no longer limited to Subtask.
- Modal: key is the parent for subtasks, `state.epicLinkKey` for create-mode non-subtasks, undefined in edit mode (T-c5g-02).
- The prefill ref now stores source key plus labels written. When the Epic Link changes or is cleared, only inputs still equal to a label the prefill wrote are cleared, then the new source prefills.
- `useIssueMutations` needed no change for the payload: its inherit logic was already type-agnostic and sends the scalar id (`'42'`).

## Task 2: close after create (root cause)

Root cause: not found. Evidence:
- In the modal test (mocked Jira), epic story create calls `onClose` exactly once with no error, both before and after Task 1 logic; the subtask control behaves identically. The Task 2 close tests passed on first run, so there was no failing-then-fixed test for the close itself.
- `handleCreateModalClose` in main.tsx cannot throw (`invalidateGhBacklogData` is a plain `invalidateQueries`).
- Hypothesis checked and rejected: a manual Account pick being sent in a wrong shape (`wrapCustomFieldValue` already sends a bare string for tempo-accounts fields). The test with a generic autocomplete field sends `{id}`, but that is a different field type.
- Remaining plausible cause (unverified): a Jira-side 400 on the old hand-entered flow keeps the modal open with an error message. The new test confirms an error keeps the modal open and success closes it. I could not run against live Jira or the Tauri app.

Defensive changes made (not proven fixes): main.tsx now closes the modal before the backlog invalidation; success now also invalidates `['jira-issue-detail', epicKey, baseUrl]` (the Stories list was already covered by the `['jira-epic-stories']` prefix).

Needs live verification by the user: add a story from an epic and confirm the modal closes. If it still does not, a console capture is needed.

## Deviations

- Test expectation fix (test only, no prod change): a manually picked autocomplete Account is sent as `{ id: '77' }` (existing `wrapCustomFieldValue` behavior), not a bare string.
- RED was not separately committed (pre-commit runs the full suite); I did not run the Task 1 tests against pre-fix code, but the prefill could not pass before since the parent-fields query was disabled for non-subtasks.
- Plan paths: the plan's file list was correct; `node_modules` was symlinked from the main checkout to run tooling in the worktree (git-ignored).

## Self-Check: PASSED
Both commits exist; 18/18 tests in create-edit-issue pass; tsc and biome clean on touched files.
