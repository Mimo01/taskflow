---
phase: 101-issue-drafts-large-create-edit-modal
plan: 10
subsystem: ui
tags: [drafts, resume, stale-validation, create-modal]
requires:
  - phase: 101-04
    provides: snapshotToFormPatch, validateSnapshot
  - phase: 101-09
    provides: modal draft autosave, staged files hook
provides:
  - useDraftResume hook (hydrate once, restore files and previews, validate stale pieces once)
  - Create modal honours resumeDraftId
affects: [101-12]
key-files:
  created:
    - taskflow/src/routes/dashboard/create-edit-issue/useDraftResume.ts
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.resume.test.tsx
  modified:
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/ModalSidebar.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts
    - taskflow/src/hooks/useDraftStagedFiles.ts
requirements-completed: [DRAFT-04, DRAFT-05, DRAFT-06]
completed: 2026-11-18
---

# Phase 101 Plan 10: Resume issue drafts Summary

Resuming a draft reopens Create with every field, the draft's own project and its staged files restored; stale epic, parent, custom field, option and fix version pieces are cleared with a muted note and never block submit.

## Commits
- df3b5a28: useDraftResume hook (plus `restore` now returns the restored Files)
- 4a332460: modal wiring, sidebar custom field notes, resume tests (10 tests)

## Design notes
- Resume waits for `useIssueDraftsHydrated()`, runs once per open session, dispatches HYDRATE after the form's open RESET, and adopts the draft id so later edits write to the same draft.
- Image files get blob previews through `setLocalPreview` (rAF retry until the lazy editor mounts); URLs revoked on close. No previews for other types.
- Validation runs once after the hydrated type matches, createmeta (and issue types) settled, and the existence lookups settled. Lookup errors map to unknown and never clear. Only changed keys are dispatched.
- The draft's project is latched per session (`resumedProjectRef`) so queries, hosts and create use it.
- Fix version validation is skipped (unknown) when the draft project differs from the active project, since `useProjectFixVersions` reads the active project.
- Editing a field clears its note via `userDispatch`.

## Deviations from Plan

**1. [Rule 3 - Blocking] Issue types loading gate**
- `useCreateEditQueries` now also returns `issueTypesLoading`; the resume hook gets `creatmetaLoading || issueTypesLoading`. Without it createmeta is disabled (type id unknown) and validation would run early with undefined createmeta and never re-run.

**2. [Rule 2] Custom field notes had no render site**
- `ModalSidebar` previously rendered only epic/parent/fixVersions notes; it now renders custom field notes below the custom fields section (needed because removed fields have no control).

**3. `staged.restore` returns the restored files** so the hook can build previews.

## Known Stubs
None.

## Self-Check: PASSED
Full vitest suite, tsc and biome green at both commits.
