# Stack Research: GitLab REST API v4 Surface for Release Management (v1.14)

**Domain:** GitLab REST API v4 — new write/read endpoints for git-flow release coordination
**Researched:** 2026-08-10
**Confidence:** HIGH for endpoint paths/params (verified against official docs.gitlab.com and gitlab-foss source); MEDIUM for exact role-permission wording and error-code consistency (GitLab's own docs are inconsistent/incomplete here, corroborated by community-reported doc gaps)

## No New Dependencies

**Do NOT add any npm package for this milestone.** Every capability below is a single `fetch` call through the existing `apiFetch('gitlab', url, opts, label)` wrapper in `taskflow/src/services/gitlab.ts`, using the same `PRIVATE-TOKEN` header and `tauri-plugin-http` transport already in place. There is no GitLab SDK, no `@gitbeaker/*`, no GraphQL client needed — the app already proved this pattern works for 20+ REST calls including the one existing write (`updateMilestone`). Adding a GitLab SDK would introduce a second HTTP client, its own error-shape conventions, and likely its own CORS/Tauri-webview compatibility unknowns — pure downside for 5 more `fetch` calls.

## Required Endpoint Surface

All paths are relative to `${baseUrl}/api/v4`. Auth is always `PRIVATE-TOKEN: <PAT>` (matches `validateGitLab`/`updateMilestone` convention already in `gitlab.ts` — do not switch to `Authorization: Bearer`, GitLab's PAT convention is PRIVATE-TOKEN across CE/EE/SaaS/self-hosted).

### 1. Read the project's default branch

`GET /projects/:id`

- **Response field:** top-level `default_branch: string` (e.g. `"develop"`, per PROJECT.md's stated setup).
- **Permission:** Any role with read access to the project (Guest and above) — this is basic project metadata, no special scope needed.
- **Version:** part of the core Projects API since early GitLab 8.x/9.x — no version constraint for any self-hosted instance in realistic use.
- **Error modes:** `404` if the project ID is wrong or the token's user has no access to it (GitLab intentionally returns 404, not 403, to avoid leaking project existence to unauthorized callers — same convention seen elsewhere in this API).
- **Integration note:** the app already fetches project-scoped data by numeric `projectId` throughout `gitlab.ts` (`fetchProjectMilestones`, `fetchProjectMRs`, etc.) but there is currently **no function that fetches the project object itself**. This is a new, small addition: `fetchProjectDetail(baseUrl, token, projectId): Promise<{ default_branch: string; ... }>`. Cache this — it changes rarely; a 30–60min `staleTime` in TanStack Query is appropriate (not `gcTime: Infinity` since a repo's default branch can theoretically change).

### 2. Check whether a branch exists (and, for free, whether it's merged)

`GET /projects/:id/repository/branches/:branch`

- `:branch` must be URL-encoded (matters for `release/1.1.0` — encode the whole `release/1.1.0` segment, not just spaces; GitLab accepts slashes in branch names as long as they're percent-encoded in the path, i.e. `release%2F1.1.0`).
- **Response body includes `merged: boolean`** — "If `true`, the branch has been merged into the default branch." This is the single most useful finding of this research: **the branch-existence check and the post-release merge-back check (capability #6) are the SAME API call.** No need for `repository/compare` or any diff-walking.
- Full response shape: `{ name, merged, protected, default, developers_can_push, developers_can_merge, can_push, web_url, commit: { id, short_id, title, author_name, author_email, created_at, ... } }`.
- **Permission:** readable by any role with repository read access (Guest/Reporter+, or unauthenticated for public repos) — same tier as other read endpoints already used in `gitlab.ts`.
- **Version:** available since very early GitLab (branches API predates v4 itself); `merged` field has been present for years — no version risk for any realistic self-hosted instance.
- **Error modes:** `404` when the branch does not exist — this is the intended way to detect non-existence (`try { GET } catch 404 → doesn't exist`, not a boolean "exists" endpoint). `401`/`403` on auth failure, matching the existing `gitlab.ts` pattern (`ApiError` with status).
- **Integration:** one new function, e.g. `fetchBranch(baseUrl, token, projectId, branchName): Promise<GitLabBranch | null>` that returns `null` on 404 and throws (via `ApiError`, matching existing style) on 401/403/other. This single function powers:
  - **Capability #1's precondition** ("does `release/<milestone>` exist?")
  - **Capability #6** (post-release merge-back check) — call it again against the same branch name after the fix version is released, read `.merged`.

### 3. Create a branch off the project default branch

`POST /projects/:id/repository/branches`

- **Body params:** `branch` (string, the new branch name — `release/1.1.0`), `ref` (string, source ref — pass the `default_branch` value read via capability #7/#1 above, e.g. `"develop"`, not a hardcoded `"main"`/`"master"`).
- **Response:** `201 Created` with the same branch object shape as GET single branch (name/commit/protected/etc).
- **Permission:** **Developer role or above** on the project — branch creation via API requires the same permission as pushing a new branch (Developer+; Maintainer/Owner also qualify). Reporter/Guest cannot create branches. This is a real prerequisite the user must have — surface it in onboarding/error copy ("Your GitLab token's user needs at least Developer access on this project to create release branches").
- **Version:** core endpoint since GitLab 8.x — no constraint.
- **Error modes:**
  - GitLab's own docs claim `409 Conflict` for "branch already exists," but corroborated community reports (GitLab issue tracker) show this and several other "resource already exists" creation endpoints actually return **`400 Bad Request`** with a body like `{"message":"Branch already exists"}` rather than the documented 409. **Do not branch your error-handling logic on status code alone for the "already exists" case — check the response body's `message` string.** Given capability #2 already gives a reliable existence check, the recommended flow is: check-then-create (call GET branch first, only POST if 404), which sidesteps this ambiguity entirely and also matches the UX spec ("existence detected and surfaced as a release-level warning... offer to create it").
  - `400` also possible for an invalid branch name (special characters) or invalid `ref` (source branch/SHA that doesn't exist).
  - `403` for insufficient role.
  - `404` for a nonexistent project ID.
- **Integration:** new `createBranch(baseUrl, token, projectId, branch, ref): Promise<GitLabBranch>`, mirroring `updateMilestone`'s try/catch + `response.ok` + status-branch pattern, with a body-message fallback parse identical to `updateMilestone`'s existing `body?.message ?? status ${response.status}` idiom.

### 4. Create a project milestone

`POST /projects/:id/milestones`

- **Body params:** `title` (required, string — the format `1.1.0`/`2.0.0` per the milestone spec), optional `description`, `due_date` (`YYYY-MM-DD`), `start_date` (`YYYY-MM-DD`).
- **Response:** the same `GitLabMilestone` shape already defined in `gitlab.ts` (id, iid, title, description, dates, state, web_url) — no new type needed, reuse the existing `GitLabMilestone` interface.
- **Permission:** **Developer role or above** — "manage milestones" (create/edit/close) is gated at Developer+ across GitLab's permission model, same tier as branch creation. Reporter cannot create milestones.
- **Version:** core endpoint, no constraint.
- **Error modes:** `401`/`403` per the existing pattern in `updateMilestone`. GitLab does **not** enforce title uniqueness at the API level — creating a milestone with a title that already exists is documented to succeed silently rather than error, creating two milestones with the same title. **This is a real pitfall for this feature**: `fetchMilestoneMRs` filters by milestone title string, so a duplicate title would make MR-milestone matching ambiguous. Client-side, always check `fetchProjectMilestones` for an existing title match before offering "create" (the roadmap's stated UX — "latest milestones listed for reference, user types the final name" — already mitigates this if the list is checked, but the create call itself won't reject a duplicate, so client-side duplicate-guard logic is needed, not server-side).
- **Integration:** new `createMilestone(baseUrl, token, projectId, fields: { title: string; description?: string; due_date?: string })`, structured identically to the existing `updateMilestone` (same file, same error-body-parse fallback, same `GitLabMilestone` return type) — this is the most natural addition since `updateMilestone` already sits right above it in the file.

### 5. Update a merge request's target branch, and 6. Assign a milestone to an MR

**Both are the same endpoint** — GitLab's MR update endpoint accepts many fields per call:

`PUT /projects/:id/merge_requests/:merge_request_iid`

- **Relevant body params:**
  - `target_branch` (string) — set to the release branch name (e.g. `release/1.1.0`).
  - `milestone_id` (integer) — the milestone's numeric **`id`** (global ID), **not** its `iid`. Pass `0` or an empty value to unassign. This matches the existing `GitLabMilestone.id` field and the exact convention `updateMilestone` already uses (`milestoneId` param is explicitly documented in that function as "NOT `iid`" — same rule applies here).
  - Can be combined: passing both `target_branch` and `milestone_id` in one PUT body applies both corrective actions in a single request if desired, though the roadmap's stated UX (per-row inline status + retry) suggests keeping them as two separately-invokable mutations so a partial failure (e.g. retarget succeeds, milestone-assign fails) is retryable independently — recommend **two small functions sharing one underlying PUT helper**, not one combined call, to match the existing per-row optimistic-update-with-rollback pattern used elsewhere in the app (v1.12 bulk-subtask row pattern referenced in PROJECT.md).
  - The endpoint requires "at least one non-required attribute" in the body — trivially satisfied here.
- **Response:** the full updated MR object (same shape as `GitLabMRDetail`, already defined in `gitlab.ts`).
- **Permission:** **Developer role or above** on the project is sufficient to edit ANY merge request in the project (not just ones you authored) — GitLab's docs state Developer/Maintainer/Owner roles "inherently grant permission to edit merge requests in the project, regardless of authorship." (An earlier single-source claim that this required Maintainer was not corroborated by GitLab's official "Manage merge requests" permissions page and multiple independent doc mirrors, which consistently say Developer+; treat Developer+ as the correct requirement.)
- **Version:** core endpoint, no constraint.
- **Error modes:**
  - `401`/`403` per existing `gitlab.ts` pattern.
  - `404` if the MR iid doesn't exist in the project.
  - **Known GitLab behavior gap (verified via GitLab's own issue tracker, still open as of recent GitLab versions):** setting `target_branch` to a branch name that does not exist is **not reliably validated server-side** — GitLab has open bug reports showing an MR can end up pointed at a nonexistent target branch with `"diff_refs": null, "has_conflicts": true, "changes_count": null` and no clear API error, rather than a clean `400`. **Client-side mitigation is required**: before calling this PUT with `target_branch`, verify the release branch exists via capability #2's `fetchBranch` call (which the roadmap already does per-release before offering retarget). Do not rely on the PUT call itself to catch a typo'd or not-yet-created branch name.
  - Setting `milestone_id` to a milestone ID that doesn't exist in the project: expect `400`/`404` with a body message (GitLab validates milestone project-scoping) — no confirmed edge-case bug here.
- **Integration:** two new functions in `gitlab.ts`:
  - `retargetMR(baseUrl, token, projectId, mrIid, targetBranch): Promise<GitLabMRDetail>`
  - `assignMRMilestone(baseUrl, token, projectId, mrIid, milestoneId): Promise<GitLabMRDetail>`

  Both can share a small private `updateMR(baseUrl, token, projectId, mrIid, fields)` helper (mirrors `updateMilestone`'s shape exactly — PUT + JSON body + same `response.ok`/401/403/message-fallback error handling). This keeps the per-row retry story clean: each corrective action is independently callable and independently retryable, matching "per-row inline status and retry (v1.12 bulk-subtask row pattern, no 'fix all')" from PROJECT.md.

## gitlab.com vs Self-Hosted / Older GitLab

- **No divergence found** for any of these 7 capabilities between gitlab.com (SaaS) and self-hosted. All seven endpoints are in **GitLab Free/CE tier** — none require GitLab Premium/Ultimate licensing (unlike, e.g., MR approval rules which the codebase already notes are absent on CE/Free — see the existing `MRApprovals.approved_by ?? []` defensive guard in `fetchParticipatedMRs`).
- All seven endpoints are old, stable, core-API surface (branches/milestones/MR-update/project-detail have existed since early GitLab 8.x/9.x). There is no realistic self-hosted version in active use today that would lack any of them. **No version-gating flag is needed anywhere in this feature.**
- The one documented behavior that varies by *GitLab's own inconsistency* (not by edition/hosting) is the branch/resource-"already exists" status code (400 vs the documented 409) — this is a GitLab-wide quirk across multiple creation endpoints, not something specific to self-hosted or older versions. The check-then-create pattern (capability #2 before #3) avoids needing to distinguish it at all.
- PAT auth (`PRIVATE-TOKEN` header) behaves identically on gitlab.com and self-hosted — already proven by the existing `validateGitLab`/`fetchProjectMilestones`/etc. functions working across both per the app's `GitLab: Self-hosted or gitlab.com` constraint in PROJECT.md.

## Integration Pattern Summary — Match Existing `gitlab.ts` Conventions

Every new function should follow the exact shape already established by `updateMilestone` (the one existing write) and the read functions around it:

1. `const url = `${baseUrl.replace(/\/$/, '')}/api/v4/...``
2. `apiFetch('gitlab', url, { method, headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }, '<Human Label>')` inside try/catch that rethrows a plain `Error('Cannot reach ${baseUrl} — check the base URL')` on network failure.
3. On `!response.ok`: special-case `401`/`403` into `ApiError(message, status, 'gitlab')`; otherwise parse the JSON body for a `message` field and throw `Error('Failed to X: ${body?.message ?? `status ${response.status}`}')` — this is `updateMilestone`'s exact idiom and should be reused verbatim for `createBranch`, `createMilestone`, `retargetMR`, `assignMRMilestone`.
4. Reuse existing types (`GitLabMilestone`, `GitLabMRDetail`) wherever the response shape matches; add one new `GitLabBranch` interface (`{ name, merged, protected, default, web_url, commit: {...} }`) since none currently exists in the file.
5. Branch-name URL-encoding: use `encodeURIComponent(branchName)` for the `:branch` path segment (needed because `release/1.1.0` contains a `/`), the same way `fetchMilestoneMRs` already does `encodeURIComponent(milestoneTitle)` for query params.
6. All five new functions belong in `taskflow/src/services/gitlab.ts` (not a new module) — the existing file already mixes read/write GitLab calls (`updateMilestone` sits alongside `fetchProjectMilestones`), and the file is a single cohesive service, not yet split like `jira.ts` was.

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any GitLab SDK (`@gitbeaker/*`, `node-gitlab`, etc.) | Second HTTP client with its own error/auth conventions; unverified Tauri-webview CORS compatibility; the app already has a working, tested `apiFetch` pattern for 20+ GitLab calls | Plain `fetch` via `apiFetch('gitlab', ...)`, same as every existing GitLab call |
| GraphQL API for any of these 7 capabilities | The GitLab GraphQL API can do all of this, but it's a second query language/schema to maintain for zero benefit — REST already covers every capability cleanly and matches the existing codebase | REST v4, as detailed above |
| `repository/compare` for the merge-back check | Works, but requires walking a `commits` array and checking `.length === 0` — strictly more complex than the `merged: boolean` field returned directly by the single-branch GET | `GET .../repository/branches/:branch` → `.merged` |
| A dedicated "does branch exist" boolean-returning helper distinct from "is it merged" | Both facts come from the exact same API call — building two functions would mean two network round-trips where one suffices | One `fetchBranch()` returning the full branch object (or `null` on 404); read `.merged` from it wherever needed |
| Relying on HTTP status code alone to detect "branch already exists" on create | GitLab's actual behavior (400) contradicts its documented behavior (409) for this and similar creation endpoints — status-code branching here is fragile across GitLab versions | Check-then-create: `fetchBranch()` first, only `POST` if it 404'd |
| Trusting the retarget PUT to validate `target_branch` existence | Documented GitLab bug: MRs can end up pointed at a nonexistent target branch with no clean error | Verify branch existence client-side via `fetchBranch()` before calling `retargetMR()` |
| A combined "update MR" call that always sets both `target_branch` and `milestone_id` together | Breaks the per-row independent-retry UX already established in v1.12 (bulk-subtask pattern) — a single combined call means one failure blocks both corrective actions | Two independently-callable functions (`retargetMR`, `assignMRMilestone`) sharing one internal PUT helper |

## Sources

- https://docs.gitlab.com/api/branches/ — branch create/get, `merged` field confirmed in single-branch response (HIGH confidence)
- https://docs.gitlab.com/api/milestones/ — milestone create params (HIGH confidence on params; no explicit duplicate-title behavior documented, corroborated via community knowledge — MEDIUM)
- https://docs.gitlab.com/api/merge_requests/ + https://docs.gitlab.com/17.5/api/merge_requests/ — MR update params including `target_branch`/`milestone_id` (HIGH confidence on param names; global-ID note for `milestone_id` explicit in docs)
- https://docs.gitlab.com/api/projects/ — `default_branch` field confirmed on project detail response (HIGH)
- https://docs.gitlab.com/api/repositories/ + gitlab-foss `doc/api/repositories.md` — compare API details, evaluated and deliberately NOT recommended in favor of the simpler `merged` field (HIGH)
- https://docs.gitlab.com/user/permissions/ + web search corroboration on GitLab's "Manage merge requests" permissions page — Developer+ required for branch creation, milestone management, and MR editing regardless of authorship (MEDIUM-HIGH; GitLab's docs are split across multiple pages and not perfectly consistent, but multiple independent sources converge on Developer+, not Maintainer+)
- GitLab issue trackers (gitlab.org/gitlab-org/gitlab#356008, gitlab-foss#47819, gitlab-org/gitlab#591660, gitlab-org/gitlab-foss#48780) — corroborate the 400-vs-409 status code inconsistency on "already exists" creation errors, and the target_branch-existence validation gap on MR create/update (MEDIUM — community/issue-tracker sourced, not official docs, but consistent across multiple independent reports)
- `taskflow/src/services/gitlab.ts` — existing auth/fetch/error conventions studied directly (HIGH, primary source)

---
*Stack research for: GitLab REST API v4 release-management write surface*
*Researched: 2026-08-10*
