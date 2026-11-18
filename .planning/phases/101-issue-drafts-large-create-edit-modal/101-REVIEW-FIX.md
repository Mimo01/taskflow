---
phase: 101-issue-drafts-large-create-edit-modal
fixed_at: 2026-11-18T11:08:31Z
review_path: .planning/phases/101-issue-drafts-large-create-edit-modal/101-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 101: Code Review Fix Report

**Fixed at:** 2026-11-18T11:08:31Z
**Source review:** .planning/phases/101-issue-drafts-large-create-edit-modal/101-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (2 critical, 7 warning; Info findings out of scope)
- Fixed: 9
- Skipped: 0

Every finding was reproduced first. Each one has a regression test that failed against the pre-fix code, and that test is in the same commit as the fix. The pre-commit hook (biome, tsc and the full vitest suite) passed on every commit. The last commit (79ac1fd5) ran 453 files and 6751 tests, all green.

## Fixed Issues

### CR-01: Hidden / off-screen field values are still sent after an issue-type switch

**Files modified:** `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts`, `issue-field-diff.ts`, `useCreateEditQueries.ts`, `CreateEditIssueModal.tsx`, `ModalSidebar.tsx`, `CreateEditIssueModal.resume.test.tsx`
**Commit:** 3667959b
**Applied fix:** The create payload now sends custom fields, labels and fixVersions only when the current type's createmeta offers them. The values stay in form state, so switching back restores them. An empty createmeta counts as unknown and keeps the old behaviour. The Labels row now hides in create mode when the known create screen has no Labels field, the same way Fix version already did.
**Status:** fixed: requires human verification. This is a logic change. Check that a real Bug or Defect create screen still shows Labels where Jira offers it.

### CR-02: Resume validation treats an empty/failed createmeta as authoritative and wipes custom-field data

**Files modified:** `taskflow/src/routes/dashboard/create-edit-issue/useDraftResume.ts`, `taskflow/src/services/jira.ts`, `taskflow/src/services/jira.test.ts`, `CreateEditIssueModal.resume.test.tsx`
**Commit:** 8b56c8ce
**Applied fix:** Resume validation now treats an empty createmeta as unknown, so it never strips draft custom fields because of it. `fetchCreatemeta` now follows the paginated endpoint past the first 50 fields (`startAt`, `isLast`/`total`, capped at 20 pages). The existing "no longer on this screen" test now uses a non-empty createmeta. Not done: "keep the original draft until the user edits". Autosave already only fires on user edits, and with this fix nothing is stripped by a transient failure.
**Status:** fixed: requires human verification (logic)

### WR-01: Removing a file while its disk copy is still being written resurrects it in the draft

**Files modified:** `taskflow/src/hooks/useDraftStagedFiles.ts`, `useDraftStagedFiles.test.tsx`
**Commit:** dcbb82d0
**Applied fix:** The hook tracks which File objects are still staged. A copy that resolves after its file was removed is ignored. WR-02 also deletes that late copy from disk.

### WR-02: Staged files are keyed by name only (clipboard images collide)

**Files modified:** `taskflow/src/lib/issue-draft-files.ts`, `issue-draft-files.test.ts`, `taskflow/src/hooks/useDraftStagedFiles.ts`, `useDraftStagedFiles.test.tsx`, plus the `issue-draft-files` mocks in `CreateEpicDialog.test.tsx`, `CreateEditIssueModal.{createAnother,issueDrafts,resume}.test.tsx`
**Commit:** 976f5eed
**Applied fix:** Each copy is stored at `issue-drafts/<id>/<uuid>-<safeName>`, and `ref.name` keeps the original name. Refs are tracked by File identity, so `remove()` drops only that file's ref and deletes its disk copy through the new `removeDraftFile`. Test mocks that stub `stageDraftFile` gained `removeDraftFile`. The first commit attempt failed with an unhandled "No removeDraftFile export" error in `CreateEpicDialog.test.tsx`.

### WR-03: Resumed Subtask drafts lose parent inheritance and show an editable parent input

**Files modified:** `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx`, `CreateEditIssueModal.resume.test.tsx`
**Commit:** 5c4d3ca4
**Applied fix:** A resumed Subtask draft's parent is latched for the session, the same way the draft's project already was. While the form still holds that parent, it is the fixed parent: it drives `inheritFromKey`, the parent summary and type, and the read-only parent display. If resume validation clears a deleted parent, the free-text input comes back, and the existing test for that still passes.
**Status:** fixed: requires human verification (logic)

### WR-04: Fix-version picker uses the active project, not the resumed draft's project

**Files modified:** `taskflow/src/hooks/useProjectFixVersions.ts`, `useProjectFixVersions.test.tsx` (new), `FixVersionField.tsx`, `FixVersionField.test.tsx`, `ModalSidebar.tsx`, `useDraftResume.ts`
**Commit:** 69b36412
**Applied fix:** `useProjectFixVersions(enabled, projectKey?)` falls back to the active project. The cache key is unchanged (`['jira-fix-versions', project, base]`), and FieldsSection still uses the active project. The Create modal's picker passes the modal's `projectKey`. Resume validation now checks the draft's saved versions against the draft's own project, so the `sameProject` gate is gone.

### WR-05: Draft-file path from the persisted store is used unvalidated

**Files modified:** `taskflow/src/lib/draft-file-path.ts` (new, dependency-free), `issue-draft-files.ts`, `issue-draft-files.test.ts`, `taskflow/src/stores/issue-drafts.store.ts`, `issue-drafts.store.test.ts`
**Commit:** 0c11b8d9
**Applied fix:** `readDraftFile` and `removeDraftFile` now require `issue-drafts/<id>/<one segment>`, with no `..` or `.` segment. The store has a persist `merge` that calls `sanitizePersistedDrafts`. It keeps only well-formed issue and epic drafts and drops any file ref with an unsafe path. The path helper is its own module, because tests that mock `issue-draft-files` would otherwise break store rehydrate.

### WR-06: Draft edits made before store hydration are silently dropped

**Files modified:** `taskflow/src/hooks/useIssueDraft.ts`, `useIssueDraft.test.tsx`
**Commit:** 5fe0d396
**Applied fix:** When `flush` runs before hydration, the edit stays pending and the hook subscribes once to `onFinishHydration`. When hydration finishes, it unsubscribes and flushes, using the latest `flush` through a ref.

### WR-07: Uncommitted label text is lost on Cmd+Enter submit and on close

**Files modified:** `taskflow/src/routes/dashboard/create-edit-issue/LabelsField.tsx`, `CreateEditIssueModal.tsx`, `CreateEditIssueModal.labels.test.tsx`
**Commit:** 79ac1fd5
**Applied fix:** On Cmd/Ctrl+Enter the label input now commits its pending text with `flushSync`. The form's key handler calls the latest `trySubmit` through a ref, so a label the user just typed also satisfies a required-Labels guard. Two tests cover this: a plain label, and a required label. Not changed: "commit on unmount / close". Closing with the X or the backdrop blurs the input first, which already commits, and I had no failing repro for the close path.

## Skipped Issues

None.

---

_Fixed: 2026-11-18T11:08:31Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
