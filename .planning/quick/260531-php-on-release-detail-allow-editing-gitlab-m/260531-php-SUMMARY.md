---
phase: quick-260531-php
plan: 01
subsystem: release-detail
tags: [gitlab, jira, modal, milestone, editing]
requires:
  - GitLabMilestone type + apiFetch/ApiError conventions (gitlab.ts)
  - updateFixVersion (jira.ts)
  - Base UI Dialog primitive (@base-ui/react/dialog)
provides:
  - updateMilestone() service fn (PUT /projects/:id/milestones/:milestone_id)
  - Modal-based release editing on ReleaseDetailPage with combined Jira+GitLab save
affects:
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
tech-stack:
  added: []
  patterns:
    - "Promise.allSettled per-source partial-failure save (no cross-system rollback)"
    - "Changed-fields-only PUT bodies (dirty-diff per source)"
    - "Raw Base UI Dialog.Root/Popup modal (not the capped ui/dialog DialogContent)"
key-files:
  created: []
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/gitlab.test.ts
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
decisions:
  - "Modal editing (not sidebar); sidebar reverted to read-only metadata"
  - "GitLab section shown only when a milestone is matched; title + description only"
  - "GitLab update uses numeric milestone id (not iid)"
  - "Save disabled until name non-empty AND something dirty"
metrics:
  duration: ~12m
  completed: 2026-05-31
  tasks: 2
  files: 3
---

# Phase quick-260531-php Plan 01: Release editing modal + GitLab milestone editing Summary

Replaced the release detail sidebar edit form with a centered Base UI modal and added editing of the matched GitLab milestone's title + description; one Save writes both Jira and GitLab via `Promise.allSettled`, sending only changed fields with per-source partial-failure handling.

## What Was Built

### Task 1: `updateMilestone()` service fn + tests (TDD)
- Added `updateMilestone(baseUrl, token, projectId, milestoneId, fields)` to `gitlab.ts`, placed after `fetchProjectMilestonesInRange`. Issues `PUT ${base}/api/v4/projects/:id/milestones/:milestone_id` via `apiFetch('gitlab', ...)` with `PRIVATE-TOKEN` header, body `JSON.stringify(fields)`. Uses the milestone's numeric `id` (not `iid`). 401/403 → `ApiError('Failed to update milestone', status, 'gitlab')`; other non-ok → `Error('Failed to update milestone: status N')`; network failure → `Cannot reach … — check the base URL`.
- Added a `describe('updateMilestone')` block in `gitlab.test.ts`: success returns parsed milestone; PUT to numeric-id path with `PRIVATE-TOKEN` and changed-fields-only body (`{ description: 'x' }` with no `title` key); 401/403 throw `ApiError`; generic 500 error.
- TDD cycle: RED commit (`test(...)`, `9894bb91`) with 5 failing cases → GREEN commit (`feat(...)`, `fd8fdb79`). No refactor needed.

### Task 2: Modal editing + combined save
- Sidebar reverted to read-only metadata unconditionally (removed the `editing ? <form> : <read-only>` branch). The "Edit" button still calls `startEditing()` which now opens the modal.
- Added GitLab edit state (`editMilestoneTitle`, `editMilestoneDescription`) seeded from `matchedMilestone` in `startEditing()`; replaced single `mutationError` with per-source `jiraError` / `gitlabError` and an `isSaving` flag.
- Built the modal with the raw `Dialog.Root` / `Dialog.Backdrop` / `Dialog.Popup` skeleton (`w-[680px] max-h-[85vh]`) mirroring `CreateEditIssueModal`. Contains the Jira fields (Name, Release Date, Description, Released toggle) always, and a GitLab Milestone section (Title + Description) only when `gitlabMatch.type !== 'none' && matchedMilestone`.
- `handleSave` now builds two changed-field diffs (`buildJiraDiff`, `buildGitlabDiff`), creates a promise per source only when that source changed, runs `Promise.allSettled`, sets per-source error on rejection, invalidates caches for whichever side fulfilled (`['jira-fix-versions', …]` + `['jira-version-counts', …]` for Jira; `['gitlab-milestones', activeGitlabProject]` prefix for GitLab), and closes the modal only on full success.
- Save disabled while saving, when name is empty, or when nothing is dirty (`isEditDirty`).

## Verification
- `npx vitest run src/services/gitlab.test.ts` → 64/64 pass (5 new updateMilestone cases).
- `npm run check` (biome + tsc) → clean, 438 files, no errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing node_modules in worktree**
- **Found during:** Task 1 verify (vitest startup failed: `@vitejs/plugin-react` not found).
- **Issue:** The git worktree has no installed `taskflow/node_modules`; the full install lives in the main checkout.
- **Fix:** Symlinked `taskflow/node_modules` → main checkout's `taskflow/node_modules` so vitest/tsc/biome resolve real deps. The symlink is gitignored (not committed).
- **Files modified:** none committed.

**2. [Rule 1 - Bug] Removed now-unused `useMutation` import**
- **Found during:** Task 2 (biome warning after replacing the Jira `useMutation` with `Promise.allSettled`).
- **Fix:** Dropped `useMutation` from the `@tanstack/react-query` import.
- **Commit:** `dcb4dc75`.

**3. [formatting] biome reformatted one assertion line in `gitlab.test.ts`**
- **Found during:** Task 2 `npm run check`.
- **Issue:** A multi-line `expect(calledUrl).toBe(...)` was collapsed to one line by the formatter.
- **Fix:** Applied `biome check --write`; the formatting-only change to `gitlab.test.ts` was folded into the Task 2 commit (`dcb4dc75`) since it surfaced during Task 2's gate.

## Known Stubs
None.

## Threat Flags
None — `updateMilestone` reuses the existing GitLab auth surface (`PRIVATE-TOKEN` + `apiFetch('gitlab', …)`); no new trust boundary introduced.

## TDD Gate Compliance
- RED gate: `9894bb91` `test(quick-260531-php): add failing tests for updateMilestone` (5 failing cases).
- GREEN gate: `fd8fdb79` `feat(quick-260531-php): add updateMilestone service fn`.
- REFACTOR: none required.

## Commits
- `9894bb91` test(quick-260531-php): add failing tests for updateMilestone
- `fd8fdb79` feat(quick-260531-php): add updateMilestone service fn
- `dcb4dc75` feat(quick-260531-php): move release editing into modal + combined Jira/GitLab save

## Notes for UAT
- Edit opens a centered modal over the dimmed page; the right sidebar never becomes a form.
- The GitLab Milestone section is hidden when no milestone is matched.
- Saving a description-only change PUTs only `{ description }`; an empty description clears the GitLab field (intended).
- On partial failure (e.g. Jira ok, GitLab fails) the modal stays open showing only the failed side's error; re-saving re-diffs so the already-succeeded side is skipped.

## Self-Check: PASSED
- All modified files exist (gitlab.ts, gitlab.test.ts, ReleaseDetailPage.tsx) and SUMMARY.md present.
- All three commits found in git log (9894bb91, fd8fdb79, dcb4dc75).
- `updateMilestone` export and `Dialog.Popup` modal markup confirmed present.
