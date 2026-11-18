---
phase: 101-issue-drafts-large-create-edit-modal
plan: 01
subsystem: create-edit-issue
tags: [forms, reducer, jira, labels, fix-versions]
requires: []
provides:
  - FormState.labels / fixVersions (Create and Edit)
  - formReducer HYDRATE and RESET_KEEP actions, exported buildInitialState / formReducer
  - issue-field-diff.ts create-body and no-clobber edit-diff helpers
  - onSuccess(created) from the create mutation
affects: [101-02, 101-03, 101-04]
key-files:
  created:
    - taskflow/src/routes/dashboard/create-edit-issue/issue-field-diff.ts
    - taskflow/src/routes/dashboard/create-edit-issue/issue-field-diff.test.ts
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.test.ts
  modified:
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts
    - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
    - taskflow/src/routes/dashboard/issue-detail/issue-actions.ts
    - taskflow/src/routes/dashboard/issue-detail/issue-actions.test.ts
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
decisions:
  - Clone copies labels but starts with no fix versions (release-specific)
  - Edit diff never sends labels/fixVersions when the seeded initial value is absent
metrics:
  tasks: 3
  completed: 2026-11-18
---

# Phase 101 Plan 01: Shared contract for labels, fix versions, draft actions Summary

Labels and fix versions are now real form state in Create and Edit (seeded from Jira in Edit, sent without clobbering), the reducer has HYDRATE and RESET_KEEP for draft resume and Create another, and create success returns the new issue key.

## Tasks

1. D-03 docs descope: UI-01 and the Phase 101 success criterion no longer mention subtasks (commit 825dbdbd).
2. Form state, HYDRATE / RESET_KEEP, queries flags (`labelsRequired`, `fixVersionsOffered`, `fixVersionsRequired`, `labels`/`fixVersions` in CORE_FIELD_IDS), Edit seeding and Clone handling (commit de2b2e1c).
3. `issue-field-diff.ts`, wiring in `useIssueMutations.ts`, `onSuccess(created?)` (commit e2c05b16).

## Deviations from Plan

None to the code. Process note: the pre-commit hook runs the full vitest suite and failed several times with timeouts (machine load average 40-60 from sibling agents, unrelated tests in EpicDetailSheet, IssueDetailParts, WorklogsPage). Commits were retried unchanged without `--no-verify` until the suite passed. A worktree base mismatch at start was corrected with the sanctioned `git reset --hard` to the expected base.

## Known Stubs

None.

## Self-Check: PASSED
