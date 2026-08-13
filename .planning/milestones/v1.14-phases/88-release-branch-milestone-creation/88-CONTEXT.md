# Phase 88: Release Branch & Milestone Creation - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

On the release detail view, the user can see whether the GitLab **milestone** and the **release branch** exist for a Jira fix version, and create either one when missing, behind a confirm dialog. The Releases list additionally shows a lightweight per-row indicator when either is missing.

**In scope:** milestone existence/creation (title format enforcement, duplicate blocking, reference list), release-branch name derivation + validation + existence check + creation off the project default branch, the UI surfaces for both, the new GitLab service calls they need, and a per-row missing indicator in the releases list.

**Out of scope:** MR discovery/drift detection (Phase 89), per-MR retarget or milestone assignment (Phase 90), merge-back verification (Phase 91), permission/role gating (team is all Developer+; a 403 surfaces as a normal `ApiError`), editing or deleting existing branches/milestones.

</domain>

<decisions>
## Implementation Decisions

### Milestone title format — REQUIREMENTS CORRECTION

- **D-01 (user correction, supersedes RELMS-03's stated format):** REQUIREMENTS.md says milestone titles use the format `1.1.0` / `2.0.0`. **This is wrong.** The team's real GitLab milestone titles are `X.Y.Z (DD.MM.YYYY)` — e.g. `33.5.0 (21.07.2026)`. Every downstream decision about title format, duplicate matching, and branch-name derivation follows this real format, not the requirement text. The planner should treat RELMS-03's `1.1.0` example as a documentation error, not a spec to implement.
- **D-02:** The create dialog **enforces** the format: submit is blocked unless the title matches `X.Y.Z (DD.MM.YYYY)` exactly. The date portion is **prefilled from the Jira fix version's release date**; the user types/confirms the version portion. The exact input decomposition (single validated field vs. version field + prefilled date) is the planner's call as long as an off-format title cannot be submitted.
- **D-03:** The dialog lists the **latest existing milestone names** above the input so the user can see what was recently released and pick a consistent next version (RELMS-03).
- **D-04:** The created milestone gets **title + `due_date` from the Jira fix version release date**. The due date is not optional: `resolveGitLabMatch` matches milestones to fix versions **by date**, so a dateless milestone would be created and still render as "No GitLab milestone matched". No description is synced in this phase.

### Milestone existence, duplicates, and data scope

- **D-05:** Duplicate detection and the reference list **reuse the existing date-windowed milestone query** (`fetchProjectMilestonesInRange` in `useReleaseDetail.ts`). No new full-project milestone fetch. The windowed query key must stay byte-identical — it is a cross-component cache contract with `ReleasesTab` and `UpcomingReleasesTimeline` (Phase 87 D-11).
- **D-06:** **Inherited group (ancestor) milestones are excluded** from both the duplicate check and the reference list. A group milestone with the same title is not a project-level conflict.
- **D-07 (Claude's discretion):** To satisfy D-06 while reusing the windowed list (D-05), extend the `GitLabMilestone` interface with `project_id` / `group_id` (GitLab already returns these) and filter locally on `project_id === activeGitlabProject`. This avoids a second request and leaves the query key untouched. If the probe shows these fields absent, a dialog-scoped `include_ancestors=false` fetch is the fallback — but D-05's "no extra query" preference stands unless that happens.
- **D-08 (Claude's discretion):** Accepted consequence of D-05 — a milestone whose date falls **outside** the window is invisible to the client-side duplicate check, so GitLab will reject creation server-side instead. That is acceptable: the client check is best-effort, GitLab is the authority. The rejection message body must be surfaced verbatim in the dialog (the `updateMilestone` error-body pattern at `gitlab.ts:786` already does this correctly).

### Release branch name derivation

- **D-09 (supersedes RELBR-01's literal reading):** RELBR-01 says the branch is `release/<milestone title>`. With real titles like `33.5.0 (21.07.2026)`, that is **not a valid git ref** — spaces and parentheses are disallowed. The actual convention is **`release/<version component only>`**, e.g. milestone `33.5.0 (21.07.2026)` → branch **`release/33.5.0`**. The ` (DD.MM.YYYY)` suffix is stripped. RELBR-01 should be read as "derived from the milestone title's version component".
- **D-10:** **The milestone is a hard prerequisite for the branch.** Milestone matching is date-based and frequently returns nothing; with no matched milestone there is no derivable branch name. In that state the branch status/create UI is **disabled** with an explicit "create the milestone first" reason. There is no fallback to the Jira fix version name and no free-text branch entry.
- **D-11 (RELBR-05):** If a matched milestone's title contains no parseable `X.Y.Z` version (legacy/off-convention titles), the branch name is shown as **unresolvable and create is disabled**, with the reason stated. Never sanitize-and-guess, never create a junk branch.
- **D-12 (Claude's discretion):** Version parsing + git-ref validation live in a **pure, React-free module** in `release-detail/` (new `releaseBranch.ts`, or added to `releaseSummaries.ts`) with unit tests — matching Phase 87's D-09 pattern. This is the phase's primary unit-test target: version extraction, missing-version titles, ref-rule validation (no spaces, no `..`, no trailing `.lock`, no control chars).

### Branch existence check & creation

- **D-13 (Claude's discretion):** Existence check via **`GET /projects/:id/repository/branches/:branch`** (URL-encoded name), treating **404 as "missing", not an error**. `gitlab.ts` currently throws on any non-ok response, so this needs an explicit 404 path — the researcher should confirm GitLab's actual 404 body/shape before locking. The list-level check (D-17) may make this redundant for the detail view if the same cache is shared; planner's call.
- **D-14 (RELBR-04):** The project **`default_branch`** is fetched from the project itself — add a `fetchProject(projectId)` to `gitlab.ts` and extend the `GitLabProject` interface with `default_branch` (it currently has only `id`, `name`, `name_with_namespace`, `path_with_namespace`). No hardcoded `main`, no new setting. This also serves Phase 91's merge-back check.
- **D-15:** On successful branch creation: close the dialog, **invalidate and re-fetch** the branch query so the state flips from real server data. **No optimistic update, no toast.** Optimistic writes are explicitly Phase 90's territory; Phase 88 stays read-mostly with confirmed writes.
- **D-16 (Claude's discretion):** Creation failures (403, protected-branch rule, branch-already-exists race) are surfaced **inside the dialog, which stays open** for retry or cancel, showing GitLab's message body. Same treatment for milestone creation failures (D-08).

### UI placement

- **D-17 (user decision):** The Releases list rows **do** get a small indicator when the branch or milestone is missing — the user wants drift visible without opening each release.
- **D-18 (Claude's discretion — fetch strategy for D-17):** Fetch the branch set **once** via `GET /projects/:id/repository/branches?search=release/`, **fully paginated with no page cap**, cache it, and match each row's derived branch name against that set locally. One request regardless of row count, shared with the detail view. **Do not** issue one query per row, and **do not** fetch all project branches unfiltered. (This is the known fetch-once page-cap trap: a single capped page plus client-side filtering silently under-reports.)
- **D-19 (Claude's discretion — indicator form):** A small muted warning **icon with an explanatory tooltip** ("No release branch" / "No GitLab milestone"), not a text badge — the release rows are already dense and an icon adds no layout weight. Planner may match whatever status affordance the row already uses.
- **D-20 (Claude's discretion — detail-view placement):** Branch and milestone status render as **rows in the sidebar Details block** (`ReleaseDetailSidebar.tsx`), each showing exists/missing with an inline Create action — this is release metadata and belongs with the other release metadata. The existing "No GitLab milestone matched" alert at `IssuesSection.tsx:64` stays as-is (it explains why MR linking is unavailable, a different concern) and should not be grown to cover the branch. A release-level banner was considered and rejected as too heavy for a state most unreleased versions will be in.

### Structural constraints inherited from Phase 87

- **D-21:** New data goes into the existing single hook `release-detail/useReleaseDetail.ts` (Phase 87 D-07); section components stay **presentational and props-driven** (D-08); derived/pure logic goes in a React-free module with tests (D-09); new GitLab calls go in `services/gitlab.ts` via the instrumented `apiFetch('gitlab', ...)` wrapper (D-12a), never raw `fetch`.
- **D-22:** `gitlab.ts` currently has **exactly one write operation** (`updateMilestone`). This phase adds the second and third (create milestone, create branch). Follow `updateMilestone`'s shape precisely: `apiFetch` with method, `ApiError` on 401/403, and GitLab's `body.message` surfaced on other failures.

### Claude's Discretion

The user delegated D-07, D-08, D-12, D-13, D-16, D-18, D-19, D-20. These are Claude's recorded calls and are **locked for downstream agents** — not open questions to re-ask. The planner may adjust implementation detail where evidence contradicts a call (e.g. the probe shows `project_id` isn't returned on milestones), but must record the deviation. **D-01, D-02, D-04, D-09, D-10, D-17 are user decisions and are hard.**

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase / milestone context
- `.planning/ROADMAP.md` §Phase 88 — goal, success criteria, and the probe note (milestone whitespace/near-duplicate scan; permission gating explicitly out of scope)
- `.planning/REQUIREMENTS.md` — RELBR-01…05, RELMS-01…04. **Read with D-01 and D-09 in hand:** RELMS-03's `1.1.0` title format and RELBR-01's `release/<milestone title>` are both corrected by this document.
- `.planning/phases/87-release-detail-decomposition/87-CONTEXT.md` — the structural decisions (D-07 single hook, D-08 presentational sections, D-09 pure module, D-11 query-key contract, D-12a `apiFetch`) that constrain where this phase's code lands
- `.planning/PROJECT.md` §Current Milestone — v1.14 goal

### Code this phase extends
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` — the single data-layer hook; new branch/milestone/project queries go here. Note the existing windowed milestone query and its cache key.
- `taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts` + `releaseSummaries.test.ts` — the pure-module + unit-test pattern for D-12
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` — Details block, destination for the status rows (D-20)
- `taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx` L64 — the existing "No GitLab milestone matched" alert; left unchanged
- `taskflow/src/services/gitlab.ts` — `GitLabProject` (L33, needs `default_branch`), `GitLabMilestone` (L226, may need `project_id`/`group_id`), `fetchProjectMilestones` (L696, `include_ancestors=true`), `fetchProjectMilestonesInRange` (L756), `updateMilestone` (L786 — **the write-op template**, incl. its error-body handling)
- `taskflow/src/services/releaseLinker.ts` — `matchGitLabToFixVersion`: matching is **date-based only**, which is why D-04 requires `due_date` and D-10 makes the milestone a prerequisite

### Consumers that must not regress
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` + `ReleasesTab.test.tsx` — shares the milestone query cache; also the host for the D-17 row indicator
- `taskflow/src/routes/dashboard/UpcomingReleasesTimeline.tsx` + `.test.tsx` — same cache
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — the page shell (322 LOC post-refactor)

### UI precedents
- `taskflow/src/components/ui/dialog.tsx` — the Dialog primitive
- `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx` — existing confirm-dialog precedent
- `taskflow/src/routes/dashboard/BoardResolutionDialog.tsx` — dialog with a form field and validation

No external ADRs or design specs exist for this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `release-detail/` folder (Phase 87) — all new UI lands here; conventions already established
- `ui/dialog.tsx`, `confirm-sprint-move-dialog.tsx`, `BoardResolutionDialog.tsx` — confirm-dialog patterns to copy rather than invent
- `updateMilestone` (`gitlab.ts:786`) — the only existing GitLab write op; its `apiFetch` + `ApiError` on 401/403 + `body.message` on other failures shape is the template for both new writes
- `releaseSummaries.test.ts` — established unit-test harness for pure release logic

### Established Patterns
- All GitLab/Jira calls go through `apiFetch('gitlab'|'jira', ...)` — 15s timeout, disconnect-marking on 401, redacted devtools instrumentation. Raw `fetch` is a defect.
- Feature hooks co-locate in the feature folder; `src/hooks/` is cross-feature only
- Query keys are a cross-component contract — changing the windowed milestone key silently breaks `ReleasesTab`/`UpcomingReleasesTimeline` cache sharing
- Quality gate is `npm run check`. **Baseline is 2 pre-existing biome formatting errors** in `BacklogPage.tsx`/`BacklogRow.tsx`, not a clean run. Gate on **zero new errors relative to that baseline**; do not fix the Backlog files here.

### Integration Points
- `useReleaseDetail` already resolves `gitlabMatch` / `matchedMilestone` — the branch name derives from `matchedMilestone.title`, and the D-10 prerequisite gate is `gitlabMatch.type === 'none'`
- `activeGitlabProject` + `gitlabToken` (from `readSecret('gitlab-pat')`) are already in the hook — new queries reuse them and the same `enabled` guard shape
- `ReleasesTab` rows are the new surface for D-17/D-18/D-19

### Gaps this phase must fill
- **No branch API surface at all** in `gitlab.ts` — no list, no get, no create
- **No `default_branch` anywhere in the codebase** — `GitLabProject` doesn't carry it and nothing fetches a single project
- **No milestone create** — only `fetchProjectMilestones` / `…InRange` / `updateMilestone` exist

</code_context>

<specifics>
## Specific Ideas

- The user corrected the requirement document mid-discussion: real milestone titles are `33.5.0 (21.07.2026)`, not `1.1.0`. This single fact invalidated the literal reading of RELBR-01 (spaces/parens are illegal in git refs) and is the origin of D-09's version-only branch derivation. **Downstream agents must not "fix" the code back toward the requirement text.**
- The user wants strict enforcement on milestone titles — this is a convention they care about keeping clean, not a nice-to-have. Format enforcement blocks submission.
- The user wants missing-branch/missing-milestone visible from the **list**, not just the detail page — they don't want to click into each release to find drift. This is the one place they overrode a scope-conservative recommendation.
- The user delegated most implementation mechanics (8 of 14 decisions), consistent with Phase 87 — low ceremony wanted, the interesting decisions are the domain conventions.

</specifics>

<deferred>
## Deferred Ideas

- **Fixing RELMS-03's `1.1.0` format in `REQUIREMENTS.md`** — the requirement text is factually wrong (D-01). Worth a small doc correction so future phases and audits don't re-derive the wrong format. Not code, so not done in this phase.
- **Syncing the milestone description from the Jira fix version on create** — considered and dropped (D-04 creates title + due_date only). `EditReleaseModal` already handles description sync after the fact.
- **A configurable release-branch prefix** — `release/` is hardcoded per RELBR-01. If another convention appears, that's a settings change, its own change.
- **Aggregate drift indicator on release rows** — Phase 89 already plans a drift count on the row. The D-19 missing-branch/milestone icon should be designed so Phase 89's count can sit beside it without a redesign.

</deferred>

---

*Phase: 88-Release Branch & Milestone Creation*
*Context gathered: 2026-08-10*
