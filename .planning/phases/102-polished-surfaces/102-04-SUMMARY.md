---
phase: 102-polished-surfaces
plan: 04
subsystem: create-edit-issue
tags: [epic, drafts, payload, sanitizer]
requires: []
provides:
  - IssueType includes 'Epic'
  - EpicDraftSnapshot with optional sidebar fields + sanitizeEpicSnapshot
  - toEpicSnapshot, epicSnapshotToIssueSnapshot, epicSnapshotToFormPatch
  - buildEpicCreateFields payload builder
affects: [102-06]
key-files:
  created:
    - taskflow/src/routes/dashboard/create-edit-issue/epic-create-fields.ts
    - taskflow/src/routes/dashboard/create-edit-issue/epic-create-fields.test.ts
  modified:
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
    - taskflow/src/stores/issue-drafts.store.ts
    - taskflow/src/stores/issue-drafts.store.test.ts
    - taskflow/src/lib/issue-draft-snapshot.ts
    - taskflow/src/lib/issue-draft-snapshot.test.ts
decisions:
  - Epic drafts sanitized field by field; assignee rebuilt as a typed PersonValue (no cast)
  - buildEpicCreateFields leaves summary to createIssue's own argument; epic name sent once via epicNameFieldKey
metrics:
  tasks: 3
  completed: 2026-11-18
---

# Phase 102 Plan 04: Epic data layer Summary

Pure data layer for the Create Epic upgrade: `'Epic'` added to `IssueType`, epic drafts store sidebar fields safely, snapshot helpers feed `validateSnapshot`, and a tested `buildEpicCreateFields` builds the payload (D-08, D-09).

## Tasks

1. Widened `ISSUE_TYPES` with `'Epic'` (tsc clean, no other file needed changes). Extended `EpicDraftSnapshot` with optional sidebar fields and added `sanitizeEpicSnapshot`: old `{epicName, description}` drafts still load, malformed optional fields are dropped, drafts missing name/description are dropped, `isFileRef` filtering retained.
2. Added `toEpicSnapshot`, `epicSnapshotToIssueSnapshot`, `epicSnapshotToFormPatch` (patch carries only stored sidebar fields, no link/parent/estimate keys). Tested through `validateSnapshot` stale-field note.
3. Added `buildEpicCreateFields` mirroring `createMutation` offered-filtering, with epic name sent once, no epic link/parent/timetracking.

## Deviations from Plan

- All three tasks landed in a single commit rather than one per task. The pre-commit hook runs the full vitest suite, and under heavy machine load (load average ~80 from parallel executors) the suite hit unrelated timeouts (WorklogsPage, EpicDetailSheet, IssueDetailParts), so earlier per-task commit attempts were rejected by the hook and the work was bundled into the eventual passing commit. Those tests pass in isolation.
- Test-only fix: story-points/custom-field "unknown createmeta" cases pass `[]` instead of `undefined` because a default parameter swallowed `undefined` in the test helper.
- A `node_modules` symlink to the main checkout was created in the worktree (git-ignored) to run tooling.

## Known Stubs

None.

## Self-Check: PASSED

Code commit b8f8e5ac present; files exist. Hook was run with VITEST_MAX_WORKERS=3 because the machine was heavily loaded.
