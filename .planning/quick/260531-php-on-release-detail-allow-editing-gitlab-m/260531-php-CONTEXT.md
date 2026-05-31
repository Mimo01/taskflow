# Quick Task 260531-php: Redo release editing as a modal + add GitLab milestone editing - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Task Boundary

On the release detail page (`taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`, route `/release/:versionId`), rework the editing experience:

1. **Move editing out of the right sidebar into a modal dialog.** Today the "Edit" button swaps the right sidebar into an inline form that edits the Jira fix-version fields (name, release date, description, released). The user dislikes editing in the sidebar. The sidebar must revert to read-only metadata; editing happens in a centered modal overlay.
2. **Add GitLab milestone editing.** The matched GitLab milestone's **title** and **description** become editable within the same modal — currently they are read-only.

</domain>

<decisions>
## Implementation Decisions

### Edit location (where editing happens)
- **Modal dialog.** The "Edit" button opens a centered modal overlaying the (dimmed) page. The right sidebar no longer hosts an edit form — it stays read-only metadata. All editable fields live in the modal.
- Reuse the existing dialog primitive `taskflow/src/components/ui/dialog.tsx`. Closest structural analog to mirror: `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` (and `taskflow/src/routes/dashboard/CreateEditIssueModal.tsx`) — a modal form with fields + Save/Cancel + pending/error states.

### Modal contents
- **Jira section:** the existing editable fields — Name, Release Date, Description, Released toggle (preserve current behavior/validation, e.g. Save disabled when name empty).
- **GitLab Milestone section:** Title + Description inputs. Rendered/enabled **only when a GitLab milestone is matched** (`gitlabMatch.type !== 'none'` and `matchedMilestone` is truthy). When no milestone is matched, omit the GitLab section.

### Save model
- **One Save button writes both sources.** A single Save persists the Jira fix-version fields (via existing `updateFixVersion`) AND the GitLab milestone title/description (via a new `updateMilestone` service fn).
- **Partial-failure handling:** attempt both; if one side fails, **keep the modal open** and show a per-source error indicating which side failed. The side that succeeded is NOT rolled back (no transactional rollback is possible across two systems). On full success, close the modal and invalidate the relevant caches.

### Scope of GitLab fields
- **Title + description only.** Do NOT add due_date / state editing in this task.

### Claude's Discretion
- Exact modal layout, section headers/dividers, input components (reuse existing `Input`/`Textarea` from the codebase), and error message copy.
- Whether to dirty-track / only PUT changed fields, but prefer sending only changed fields to each API to avoid clobbering.
- Whether Save is disabled until something changed.

</decisions>

<specifics>
## Specific Ideas

- Existing edit state in `ReleaseDetailPage.tsx`: `editing`, `editName`, `editDate`, `editDescription`, `editReleased` (lines ~168-173), `startEditing()` (~342-350), `cancelEditing()` (~352-355), Jira `useMutation` calling `updateFixVersion` (~358-378), inline sidebar form (~846-952). This logic moves into the modal.
- Jira update service: `updateFixVersion()` in `taskflow/src/services/jira.ts` (~1079-1118). NOTE: per memory, all imports use the legacy `jira.ts`, not `jira/` modules — edit `jira.ts`.
- GitLab milestone type: `GitLabMilestone` in `taskflow/src/services/gitlab.ts` (~172-181): `{ id, iid, title, description, start_date, due_date, state, web_url }`. `description` was recently added.
- New service fn needed: `updateMilestone()` in `taskflow/src/services/gitlab.ts` — `PUT /api/v4/projects/:projectId/milestones/:milestoneId` with `PRIVATE-TOKEN: {token}` header, body `{ title?, description? }`, returns updated `GitLabMilestone`.
  - **Open question for research/planner:** GitLab's milestone update endpoint path param — confirm whether it takes the milestone numeric `id` or the project-scoped `iid`. (GitLab REST uses the milestone `id` for `/projects/:id/milestones/:milestone_id`.) Mirror the existing fetch functions' auth/header/error conventions in `gitlab.ts`.
- GitLab token retrieval: mirror existing secret access; Jira uses `readSecret('jira-pat')`. GitLab likely `readSecret('gitlab-pat')` — confirm the actual secret key used by existing GitLab fetches.
- Project id for the PUT: the active GitLab project (`activeGitlabProject`) already used by `['gitlab-milestones', ...]` queries.
- On GitLab save success, invalidate `['gitlab-milestones', activeGitlabProject, ...]`; on Jira save success, invalidate `['jira-fix-versions', activeJiraProject]` (existing behavior).

</specifics>

<canonical_refs>
## Canonical References

- No external specs. GitLab REST milestone API: `PUT /api/v4/projects/:id/milestones/:milestone_id` (params: `title`, `description`, `due_date`, `start_date`, `state_event`). Auth via `PRIVATE-TOKEN` header (existing pattern in `gitlab.ts`).

</canonical_refs>
