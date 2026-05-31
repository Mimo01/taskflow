---
phase: quick-260531-php
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
autonomous: false
requirements: [QUICK-260531-php]
must_haves:
  truths:
    - "Clicking Edit on the release detail page opens a centered modal dialog overlaying the dimmed page (not a sidebar form)"
    - "The right sidebar stays read-only metadata at all times — it never swaps into an edit form"
    - "The modal contains the Jira fields (Name, Release Date, Description, Released toggle) with current behavior preserved (Save disabled when name empty)"
    - "A GitLab Milestone section (Title + Description inputs) appears in the modal only when a milestone is matched"
    - "One Save button writes both the Jira fix-version and the GitLab milestone, sending only changed fields per source"
    - "On partial failure the modal stays open and shows a per-source error indicating which side failed; the succeeded side is not rolled back"
    - "On full success the modal closes and the relevant Jira + GitLab caches are invalidated"
  artifacts:
    - path: "taskflow/src/services/gitlab.ts"
      provides: "updateMilestone() service fn (PUT /api/v4/projects/:id/milestones/:milestone_id)"
      contains: "export async function updateMilestone"
    - path: "taskflow/src/services/gitlab.test.ts"
      provides: "updateMilestone test cases (success, 401/403, changed-fields body)"
      contains: "updateMilestone"
    - path: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      provides: "Edit modal hosting Jira + GitLab fields, combined Save via Promise.allSettled"
      contains: "Dialog.Popup"
  key_links:
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      to: "updateMilestone in gitlab.ts"
      via: "Promise.allSettled combined save"
      pattern: "updateMilestone\\("
    - from: "taskflow/src/services/gitlab.ts updateMilestone"
      to: "GitLab REST milestones API"
      via: "apiFetch('gitlab', ...) PUT with PRIVATE-TOKEN"
      pattern: "projects/\\$\\{projectId\\}/milestones/\\$\\{milestoneId\\}"
---

<objective>
On the release detail page, replace the sidebar edit form with a centered modal dialog, and add editing of the matched GitLab milestone's title + description inside that same modal. One Save writes both Jira and GitLab with per-source partial-failure handling.

Purpose: The user dislikes editing in the sidebar; the sidebar should stay read-only metadata. Editing happens in a modal, and the matched GitLab milestone (currently read-only) becomes editable.
Output: New `updateMilestone()` service fn + tests; reworked edit experience as a modal in ReleaseDetailPage.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260531-php-on-release-detail-allow-editing-gitlab-m/260531-php-CONTEXT.md
@.planning/quick/260531-php-on-release-detail-allow-editing-gitlab-m/260531-php-RESEARCH.md

# Source files to mirror / modify
@taskflow/src/services/gitlab.ts
@taskflow/src/services/gitlab.test.ts
@taskflow/src/services/jira.ts
@taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
@taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
@taskflow/src/components/ui/dialog.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add updateMilestone() service fn + tests in gitlab.ts</name>
  <files>taskflow/src/services/gitlab.ts, taskflow/src/services/gitlab.test.ts</files>
  <behavior>
    - Success: a 200 response returns the parsed GitLabMilestone JSON.
    - The request is a PUT to `${baseUrl}/api/v4/projects/:projectId/milestones/:milestoneId` using the numeric milestone `id` (NOT iid), with header `PRIVATE-TOKEN: {token}` and `Content-Type: application/json`.
    - The request body is `JSON.stringify(fields)` and contains only the keys passed in (e.g. only `description` when only description changed) — empty `description: ""` is sent through (clears the field).
    - A 401 or 403 response throws `ApiError('Failed to update milestone', status, 'gitlab')`.
    - A non-ok status other than 401/403 throws `Error('Failed to update milestone: status {status}')`.
  </behavior>
  <action>
Add `updateMilestone(baseUrl: string, token: string, projectId: number, milestoneId: number, fields: { title?: string; description?: string }): Promise<GitLabMilestone>` to `gitlab.ts`, placing it near the other milestone fns (after `fetchProjectMilestonesInRange`). Mirror the exact structure of the existing GitLab fetch fns (see `fetchMRDetail` ~L769-796 and `updateFixVersion` in jira.ts ~L1079-1118): build the URL with `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/milestones/${milestoneId}`, call `apiFetch('gitlab', url, { method: 'PUT', headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }, 'Update Milestone')` inside a try/catch that rethrows `Error(\`Cannot reach ${baseUrl} — check the base URL\`)`. On `!response.ok`: 401/403 → `throw new ApiError('Failed to update milestone', response.status, 'gitlab')`; else `throw new Error(\`Failed to update milestone: status ${response.status}\`)`. Return `(await response.json()) as GitLabMilestone`. The path param MUST be the milestone numeric `id`, not `iid` (confirmed: GitLab REST `PUT /projects/:id/milestones/:milestone_id`). Use `apiFetch`, not raw fetch, matching the redaction/timeout conventions already imported at the top of gitlab.ts.

In `gitlab.test.ts`, import `updateMilestone` and add a `describe('updateMilestone', ...)` block following the existing `vi.mock('@tauri-apps/plugin-http')` / `vi.mocked(mockFetch).mockResolvedValue({ ok, status, json } as Response)` pattern: (a) success returns the parsed milestone; (b) 401 and 403 throw `ApiError`; (c) when called with only `{ description: 'x' }`, assert the captured fetch init body parses to exactly `{ description: 'x' }` (no `title` key) and the URL ends in `/projects/{id}/milestones/{id}` using the numeric id. Read the mocked call args via `vi.mocked(mockFetch).mock.calls[0]` to assert URL + body.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/services/gitlab.test.ts</automated>
  </verify>
  <done>New `updateMilestone` exported from gitlab.ts; gitlab.test.ts updateMilestone cases pass (success, 401/403 ApiError, changed-fields-only body + correct id-based URL).</done>
</task>

<task type="auto">
  <name>Task 2: Move release editing into a modal + wire combined Jira+GitLab Save</name>
  <files>taskflow/src/routes/dashboard/ReleaseDetailPage.tsx</files>
  <action>
Rework the edit experience in `ReleaseDetailPage.tsx` from the inline sidebar form into a centered modal, and revert the sidebar to read-only metadata.

1. Sidebar: remove the `editing ? <edit form> : <read-only>` branch in the sidebar region (~L846-952 edit form). Keep the read-only metadata markup (~L953-1081) rendering unconditionally. The "Edit" button continues to call `startEditing()` (which sets `editing = true`), but now that opens the modal instead of swapping the sidebar.

2. Add GitLab edit state alongside the existing Jira edit state (`editName`, `editDate`, `editDescription`, `editReleased` ~L168-173): `editMilestoneTitle` and `editMilestoneDescription`. Seed them in `startEditing()` from `matchedMilestone?.title ?? ''` and `matchedMilestone?.description ?? ''` (matchedMilestone is at ~L256-260). Reset/seeding happens the same way the Jira fields are seeded in `startEditing()` (~L342-350).

3. Build the modal by mirroring the raw Base UI primitive skeleton in `CreateEditIssueModal.tsx` (~L150-528) — import `{ Dialog } from '@base-ui/react/dialog'`. Do NOT use the `ui/dialog` `DialogContent` wrapper (capped at `sm:max-w-sm`, too narrow). Structure: `<Dialog.Root open={editing} onOpenChange={(o) => { if (!o) cancelEditing(); }}>` → `Dialog.Portal` → `Dialog.Backdrop` (dimmed overlay) → `Dialog.Popup` (centered, ~`w-[680px] max-h-[85vh] overflow-y-auto`, flex column). Inside: a header with title + a `Dialog.Close` X button; the Jira fields section (lift the existing Jira field markup ~L860-918 verbatim — Name `Input`, Release Date `Input`, Description `Textarea`, Released toggle — reusing the `Input`/`Textarea` already imported ~L36/L39); a GitLab Milestone section rendered ONLY when `gitlabMatch.type !== 'none' && matchedMilestone` (same guard already used ~L475-478) containing Title `Input` (bound to `editMilestoneTitle`) and Description `Textarea` (bound to `editMilestoneDescription`); a footer with Cancel and Save. Disable inputs + Save while saving; Save label swaps to `Saving...`. Keep Save disabled when `!editName.trim()` (existing rule ~L928). Per CONTEXT discretion, also allow Save only when something is dirty.

4. Convert the single Jira `useMutation` (~L358-378) into a combined save covering both sources using `Promise.allSettled`. Build two field diffs: the Jira diff exactly as `handleSave` does today (~L380-393, only changed of name/releaseDate/description/released); a GitLab diff including `title` only if `editMilestoneTitle !== matchedMilestone.title`, and `description` only if `editMilestoneDescription !== (matchedMilestone.description ?? '')`. If a source has no changed fields, skip its API call (don't PUT an empty body). Run `Promise.allSettled([jiraPromise?, gitlabPromise?])` where each promise is created only when that source has changes. Jira call: existing `updateFixVersion(jiraBaseUrl, token, versionId, fields)` with `readSecret('jira-pat')`. GitLab call: `updateMilestone(gitlabBaseUrl ?? '', gitlabToken ?? '', activeGitlabProject ?? 0, matchedMilestone.id, gitlabFields)` — reuse the already-loaded `gitlabToken` state (~L147/L160-166), `gitlabBaseUrl`/`activeGitlabProject` from `useAuthStore()` (~L135), and `matchedMilestone.id` (the numeric id, NOT iid).

5. Partial-failure handling: maintain two error states (e.g. `jiraError`, `gitlabError`) instead of the single `mutationError`. After `allSettled`: clear both errors first; for any rejected result set that source's error to `.reason?.message`. If ANY rejected → keep the modal open and render a per-source destructive error block (mirror the `rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive` block at CreateEditIssueModal ~L502-506) for whichever side(s) failed. The succeeded side is NOT rolled back. Re-running Save re-diffs, so an already-succeeded side has no changes and is skipped.

6. On full success (no rejections): invalidate caches and close the modal. Jira: `['jira-fix-versions', activeJiraProject]` and `['jira-version-counts', versionId]` (existing). GitLab (only if a GitLab write happened): `queryClient.invalidateQueries({ queryKey: ['gitlab-milestones', activeGitlabProject] })` (prefix match covers all window variants). Then `setEditing(false)`.

Do NOT add due_date / state editing — title + description only. Do NOT introduce a "v1"/simplified variant; deliver the full combined-save behavior.
  </action>
  <verify>
    <automated>cd taskflow && npm run check</automated>
  </verify>
  <done>Edit opens a centered modal (sidebar stays read-only); modal shows Jira fields always and the GitLab Title/Description section only when a milestone is matched; one Save writes both sources via Promise.allSettled sending only changed fields; partial failure keeps the modal open with a per-source error; full success closes the modal and invalidates Jira + GitLab caches; `npm run check` passes.</done>
</task>

</tasks>

<verification>
- `cd taskflow && npx vitest run src/services/gitlab.test.ts` — updateMilestone cases pass.
- `cd taskflow && npm run check` — biome + tsc clean (no new errors).
- Manual sanity (executor may note for UAT): Edit opens modal; GitLab section hidden when no milestone matched; saving a description-only change PUTs only `{ description }`.
</verification>

<success_criteria>
- Editing happens in a centered modal; the right sidebar never hosts an edit form.
- GitLab milestone Title + Description are editable in the modal, shown only when matched.
- One Save persists both Jira and GitLab, changed-fields-only, with partial-failure per-source errors and no cross-system rollback.
- Full success closes the modal and invalidates the correct Jira + GitLab caches.
- New `updateMilestone()` is tested; `npm run check` and the gitlab vitest suite pass.
</success_criteria>

<output>
Create `.planning/quick/260531-php-on-release-detail-allow-editing-gitlab-m/260531-php-SUMMARY.md` when done.
</output>
