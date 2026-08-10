# Phase 88: Release Branch & Milestone Creation - Research

**Researched:** 2026-08-10
**Domain:** GitLab REST API writes (branch + milestone creation) inside a mature React/Tauri release-detail feature; git ref validation
**Confidence:** HIGH (codebase patterns, GitLab API shapes) / MEDIUM (RELMS-04 live-data probe not executed — see Probe section)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (user correction, supersedes RELMS-03's stated format):** REQUIREMENTS.md says milestone titles use the format `1.1.0` / `2.0.0`. **This is wrong.** The team's real GitLab milestone titles are `X.Y.Z (DD.MM.YYYY)` — e.g. `33.5.0 (21.07.2026)`. Every downstream decision about title format, duplicate matching, and branch-name derivation follows this real format, not the requirement text. The planner should treat RELMS-03's `1.1.0` example as a documentation error, not a spec to implement.
- **D-02:** The create dialog **enforces** the format: submit is blocked unless the title matches `X.Y.Z (DD.MM.YYYY)` exactly. The date portion is **prefilled from the Jira fix version's release date**; the user types/confirms the version portion. The exact input decomposition (single validated field vs. version field + prefilled date) is the planner's call as long as an off-format title cannot be submitted.
- **D-03:** The dialog lists the **latest existing milestone names** above the input so the user can see what was recently released and pick a consistent next version (RELMS-03).
- **D-04:** The created milestone gets **title + `due_date` from the Jira fix version release date**. The due date is not optional: `resolveGitLabMatch` matches milestones to fix versions **by date**, so a dateless milestone would be created and still render as "No GitLab milestone matched". No description is synced in this phase.
- **D-05:** Duplicate detection and the reference list **reuse the existing date-windowed milestone query** (`fetchProjectMilestonesInRange` in `useReleaseDetail.ts`). No new full-project milestone fetch. The windowed query key must stay byte-identical — it is a cross-component cache contract with `ReleasesTab` and `UpcomingReleasesTimeline` (Phase 87 D-11).
- **D-06:** **Inherited group (ancestor) milestones are excluded** from both the duplicate check and the reference list. A group milestone with the same title is not a project-level conflict.
- **D-07 (Claude's discretion):** To satisfy D-06 while reusing the windowed list (D-05), extend the `GitLabMilestone` interface with `project_id` / `group_id` (GitLab already returns these) and filter locally on `project_id === activeGitlabProject`. This avoids a second request and leaves the query key untouched. If the probe shows these fields absent, a dialog-scoped `include_ancestors=false` fetch is the fallback — but D-05's "no extra query" preference stands unless that happens.
- **D-08 (Claude's discretion):** Accepted consequence of D-05 — a milestone whose date falls **outside** the window is invisible to the client-side duplicate check, so GitLab will reject creation server-side instead. That is acceptable: the client check is best-effort, GitLab is the authority. The rejection message body must be surfaced verbatim in the dialog (the `updateMilestone` error-body pattern at `gitlab.ts:786` already does this correctly).
- **D-09 (supersedes RELBR-01's literal reading):** RELBR-01 says the branch is `release/<milestone title>`. With real titles like `33.5.0 (21.07.2026)`, that is **not a valid git ref** — spaces and parentheses are disallowed. The actual convention is **`release/<version component only>`**, e.g. milestone `33.5.0 (21.07.2026)` → branch **`release/33.5.0`**. The ` (DD.MM.YYYY)` suffix is stripped. RELBR-01 should be read as "derived from the milestone title's version component".
- **D-10:** **The milestone is a hard prerequisite for the branch.** Milestone matching is date-based and frequently returns nothing; with no matched milestone there is no derivable branch name. In that state the branch status/create UI is **disabled** with an explicit "create the milestone first" reason. There is no fallback to the Jira fix version name and no free-text branch entry.
- **D-11 (RELBR-05):** If a matched milestone's title contains no parseable `X.Y.Z` version (legacy/off-convention titles), the branch name is shown as **unresolvable and create is disabled**, with the reason stated. Never sanitize-and-guess, never create a junk branch.
- **D-12 (Claude's discretion):** Version parsing + git-ref validation live in a **pure, React-free module** in `release-detail/` (new `releaseBranch.ts`, or added to `releaseSummaries.ts`) with unit tests — matching Phase 87's D-09 pattern. This is the phase's primary unit-test target: version extraction, missing-version titles, ref-rule validation (no spaces, no `..`, no trailing `.lock`, no control chars).
- **D-13 (Claude's discretion):** Existence check via **`GET /projects/:id/repository/branches/:branch`** (URL-encoded name), treating **404 as "missing", not an error**. `gitlab.ts` currently throws on any non-ok response, so this needs an explicit 404 path — confirmed in research below. The list-level check (D-17) may make this redundant for the detail view if the same cache is shared; planner's call.
- **D-14 (RELBR-04):** The project **`default_branch`** is fetched from the project itself — add a `fetchProject(projectId)` to `gitlab.ts` and extend the `GitLabProject` interface with `default_branch` (it currently has only `id`, `name`, `name_with_namespace`, `path_with_namespace`). No hardcoded `main`, no new setting. This also serves Phase 91's merge-back check.
- **D-15:** On successful branch creation: close the dialog, **invalidate and re-fetch** the branch query so the state flips from real server data. **No optimistic update, no toast.** Optimistic writes are explicitly Phase 90's territory; Phase 88 stays read-mostly with confirmed writes.
- **D-16 (Claude's discretion):** Creation failures (403, protected-branch rule, branch-already-exists race) are surfaced **inside the dialog, which stays open** for retry or cancel, showing GitLab's message body. Same treatment for milestone creation failures (D-08).
- **D-17 (user decision):** The Releases list rows **do** get a small indicator when the branch or milestone is missing — the user wants drift visible without opening each release.
- **D-18 (Claude's discretion — fetch strategy for D-17):** Fetch the branch set **once** via `GET /projects/:id/repository/branches?search=release/`, **fully paginated with no page cap**, cache it, and match each row's derived branch name against that set locally. One request regardless of row count, shared with the detail view. **Do not** issue one query per row, and **do not** fetch all project branches unfiltered. (This is the known fetch-once page-cap trap: a single capped page plus client-side filtering silently under-reports.)
- **D-19 (Claude's discretion — indicator form):** A small muted warning **icon with an explanatory tooltip** ("No release branch" / "No GitLab milestone"), not a text badge — the release rows are already dense and an icon adds no layout weight. Planner may match whatever status affordance the row already uses.
- **D-20 (Claude's discretion — detail-view placement):** Branch and milestone status render as **rows in the sidebar Details block** (`ReleaseDetailSidebar.tsx`), each showing exists/missing with an inline Create action — this is release metadata and belongs with the other release metadata. The existing "No GitLab milestone matched" alert at `IssuesSection.tsx:64` stays as-is (it explains why MR linking is unavailable, a different concern) and should not be grown to cover the branch. A release-level banner was considered and rejected as too heavy for a state most unreleased versions will be in.
- **D-21:** New data goes into the existing single hook `release-detail/useReleaseDetail.ts` (Phase 87 D-07); section components stay **presentational and props-driven** (D-08); derived/pure logic goes in a React-free module with tests (D-09); new GitLab calls go in `services/gitlab.ts` via the instrumented `apiFetch('gitlab', ...)` wrapper (D-12a), never raw `fetch`.
- **D-22:** `gitlab.ts` currently has **exactly one write operation** (`updateMilestone`). This phase adds the second and third (create milestone, create branch). Follow `updateMilestone`'s shape precisely: `apiFetch` with method, `ApiError` on 401/403, and GitLab's `body.message` surfaced on other failures.

**Hard user decisions (not open to re-litigation):** D-01, D-02, D-04, D-09, D-10, D-17.
**Claude's discretion (locked for downstream agents, not open questions):** D-07, D-08, D-12, D-13, D-16, D-18, D-19, D-20 — deviate only with evidence and record the deviation.

### Claude's Discretion

The user delegated D-07, D-08, D-12, D-13, D-16, D-18, D-19, D-20 (listed above). These are Claude's recorded calls and are locked for downstream agents — not open questions to re-ask. The planner may adjust implementation detail where evidence contradicts a call (e.g. the probe shows `project_id` isn't returned on milestones), but must record the deviation.

### Deferred Ideas (OUT OF SCOPE)

- **Fixing RELMS-03's `1.1.0` format in `REQUIREMENTS.md`** — the requirement text is factually wrong (D-01). Worth a small doc correction so future phases and audits don't re-derive the wrong format. Not code, so not done in this phase.
- **Syncing the milestone description from the Jira fix version on create** — considered and dropped (D-04 creates title + due_date only). `EditReleaseModal` already handles description sync after the fact.
- **A configurable release-branch prefix** — `release/` is hardcoded per RELBR-01. If another convention appears, that's a settings change, its own change.
- **Aggregate drift indicator on release rows** — Phase 89 already plans a drift count on the row. The D-19 missing-branch/milestone icon should be designed so Phase 89's count can sit beside it without a redesign.

Additional out-of-scope items from the phase boundary (CONTEXT.md `<domain>`): MR discovery/drift detection (Phase 89), per-MR retarget or milestone assignment (Phase 90), merge-back verification (Phase 91), permission/role gating (team is all Developer+; a 403 surfaces as a normal `ApiError`), editing or deleting existing branches/milestones.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RELBR-01 | Release branch name resolves as `release/<milestone title>` from the matched GitLab milestone (`release/` prefix hardcoded) — **read per D-09 as version-component-only**, e.g. `release/33.5.0` | Pattern 3 (`deriveReleaseBranchName`/`extractVersionFromMilestoneTitle` in new `releaseBranch.ts`); D-10/D-11 gating logic |
| RELBR-02 | User sees whether the release branch exists on the release detail view | Pattern 1 (`fetchBranch` 404-as-missing); D-20 sidebar `MetaRow` placement |
| RELBR-03 | User sees a release-level warning when the release branch is missing | Same as RELBR-02 — sidebar row exists/missing state per UI-SPEC copy contract |
| RELBR-04 | User can create the missing release branch off the GitLab project default branch, behind a confirm dialog | Code Examples: `fetchProject` (default_branch), `createBranch`; `CreateBranchDialog.tsx` (copies `ConfirmSprintMoveDialog`); D-15 invalidate-on-success |
| RELBR-05 | Branch name is validated against git ref rules before creation | Pattern 3 (`isValidGitRefName`); Common Pitfalls #1 |
| RELMS-01 | User sees when no GitLab milestone matches the Jira fix version | Already-implemented `resolveGitLabMatch`/`gitlabMatch.type === 'none'` (Phase 87, unchanged) — this phase adds the Create action alongside it |
| RELMS-02 | User can create a GitLab milestone from the release view, behind a confirm dialog | Pattern 2 (`createMilestone`); `CreateMilestoneDialog.tsx` (copies `BoardResolutionDialog`) |
| RELMS-03 | The create dialog lists the latest existing milestones for reference and lets the user type the final name (format corrected per D-01 to `X.Y.Z (DD.MM.YYYY)`) | D-02/D-03 UI contract (88-UI-SPEC.md "Recent milestones" + format helper text); D-05/D-07 windowed+ancestor-filtered reference list |
| RELMS-04 | Duplicate milestone title is detected and blocked before creation | Common Pitfalls #5 (best-effort client check + D-08 server fallback); **probe.sh required before locking the exact-match algorithm — see Open Questions #1** |

</phase_requirements>

## Summary

This phase adds the app's second and third GitLab write operations (branch create, milestone create) to a codebase that already has one write op (`updateMilestone`) to copy verbatim, and a fully decomposed `release-detail/` folder (Phase 87) with an established single-hook + pure-module + presentational-section architecture. Almost nothing here is novel engineering — it is disciplined reuse: extend `GitLabProject`/`GitLabMilestone` with two new fields GitLab already returns, add three read functions and two write functions to `services/gitlab.ts` following `updateMilestone`'s exact shape, add a pure `releaseBranch.ts` module for version-parsing and git-ref validation (mirroring `releaseSummaries.ts`), and two new confirm dialogs copied structurally from `confirm-sprint-move-dialog.tsx` / `BoardResolutionDialog.tsx`.

The one piece of unverified information — whether the team's real GitLab milestone titles contain whitespace/near-duplicate collisions that would confuse an exact-title client-side duplicate check (RELMS-04) — could not be resolved in this research session because it requires a live authenticated GitLab query and this research agent has no access to the app's stored PAT (Tauri stronghold, unlockable only from the running app). A ready-to-run probe script has been written to `.planning/phases/88-release-branch-milestone-creation/probe.sh`; it must be run by a human against the real GitLab instance before RELMS-04's duplicate-check logic is finalized. Everything else in this phase — GitLab API request/response shapes, git ref validation rules, the existing code to extend, and the UI/dialog patterns to copy — is HIGH confidence from official docs and direct codebase reading.

**Primary recommendation:** Extend `gitlab.ts` with `fetchProject`, `createMilestone`, `fetchBranch` (404-as-missing), `createBranch`; add a pure `release-detail/releaseBranch.ts` (version extraction + git-ref validation, unit-tested); wire both into `useReleaseDetail.ts` following the existing query/enabled-guard shape; build `CreateBranchDialog.tsx` and `CreateMilestoneDialog.tsx` by copying `ConfirmSprintMoveDialog`/`BoardResolutionDialog` structure; run `probe.sh` against live GitLab before locking RELMS-04's duplicate-match algorithm.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Branch/milestone existence check | API / Backend (GitLab, called from frontend) | Frontend Server (SSR) — N/A, this is a Tauri desktop app | This is a Tauri desktop app with no server tier; the "backend" is GitLab itself. The React renderer calls GitLab directly via `apiFetch`. |
| Branch/milestone creation (writes) | API / Backend (GitLab) | Client (confirm dialog, validation) | Git-ref validation happens client-side pre-flight (fast feedback), but GitLab is the authority — server-side rejection is still handled (D-08). |
| Version parsing / git-ref validation | Client (pure module, `releaseBranch.ts`) | — | Pure, deterministic, unit-testable logic with no I/O — belongs in the React-free module tier per Phase 87's established convention (D-12). |
| Query caching / cache invalidation | Client (TanStack Query) | — | No server tier exists; the query cache IS the app's only caching layer. |
| List-row missing-indicator fetch (D-18) | Client (React Query, single paginated branch-search fetch) | — | Same tier as everything else in this desktop app; the key research finding is "one fetch, not N," not a tier question. |

## Standard Stack

### Core
No new third-party libraries are introduced by this phase. All work extends existing first-party modules.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.90.21 (already installed) `[VERIFIED: package.json]` | Query/mutation state, cache invalidation for the two new write ops | Already the app's only data-fetching layer; `useMutation` pattern already established (`useFieldMutation.ts`, `useIssueMutations.ts`, `WatcherToggle.tsx`) |
| `@tauri-apps/plugin-http` | already installed | Underlying `fetch` used by `apiFetch` | CORS bypass requirement for the Tauri webview, already the only fetch path in `gitlab.ts` |

### Supporting
None — no new packages needed. `lucide-react`, `shadcn` dialog/button/input/label/alert are already installed per `88-UI-SPEC.md`.

### Alternatives Considered
Not applicable — this phase is additive within an established stack with zero new dependencies.

**Installation:**
```bash
# No new packages required for this phase.
```

**Version verification:** `@tanstack/react-query` version confirmed directly from `taskflow/package.json` (`^5.90.21`) — no registry lookup needed since it's an existing, already-installed dependency, not a new one.

## Package Legitimacy Audit

> Not applicable — this phase installs zero new external packages. Skipping the Package Legitimacy Gate protocol per its own preconditions (no packages to audit).

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
ReleaseDetailSidebar (renders status rows)          ReleasesTab (renders per-row indicator)
        |                                                     |
        v                                                     v
useReleaseDetail() ---------- new queries -------->  new one-shot query:
  |  existing: fixVersions, issueCounts,             GET /repository/branches?search=release/
  |  milestones(windowed), fixVersionIssues,          (D-18: fully paginated, ONE request,
  |  milestoneMRs, recentProjectMRs                    cached, matched locally per row)
  |
  +-- resolveGitLabMatch(releaseDate, milestones)  -> matchedMilestone | none  [existing, D-10 gate]
  |
  +-- NEW: deriveReleaseBranchName(matchedMilestone.title)   [pure, releaseBranch.ts]
  |         -> { branchName: "release/33.5.0" } | { error: "unresolvable" } | blocked (no milestone)
  |
  +-- NEW query: fetchBranch(baseUrl, token, projectId, branchName)
  |         -> exists | 404-as-missing (never throws on 404)
  |
  +-- NEW query: fetchProject(baseUrl, token, projectId) -> { default_branch }
  |
  User clicks "Create branch" -> CreateBranchDialog (confirm-only, D-16 error stays in-dialog)
        -> createBranch(baseUrl, token, projectId, { branch, ref: default_branch })
        -> onSuccess: invalidate branch query (D-15, no optimism, no toast)

  User clicks "Create milestone" -> CreateMilestoneDialog (title input + reference list, D-02/D-03)
        -> client-side format check (X.Y.Z (DD.MM.YYYY)) + client-side duplicate check
           against the EXISTING windowed+ancestor-filtered milestone list (D-05/D-07)
        -> createMilestone(baseUrl, token, projectId, { title, due_date })
        -> onSuccess: invalidate ['gitlab-milestones', ...] windowed key (D-15)
        -> onError (server-side duplicate, D-08): show body.message verbatim, dialog stays open
```

### Recommended Project Structure
```
taskflow/src/routes/dashboard/release-detail/
├── useReleaseDetail.ts        # extend: 2-3 new queries (fetchProject, fetchBranch, [D-18 list fetch lives in ReleasesTab, not here])
├── releaseBranch.ts            # NEW — pure module: version extraction + git-ref validation
├── releaseBranch.test.ts       # NEW — unit tests (primary test surface for this phase)
├── CreateBranchDialog.tsx      # NEW — confirm-only dialog (copies ConfirmSprintMoveDialog)
├── CreateMilestoneDialog.tsx   # NEW — input + reference-list dialog (copies BoardResolutionDialog)
├── ReleaseDetailSidebar.tsx    # extend: 2 new MetaRow entries (branch, milestone status+create)
├── IssuesSection.tsx           # UNCHANGED (D-20 — existing alert stays as-is)
taskflow/src/services/
└── gitlab.ts                   # extend: GitLabProject.default_branch, GitLabMilestone.project_id/group_id,
                                 #         fetchProject(), fetchBranch(), createBranch(), createMilestone()
taskflow/src/routes/dashboard/
└── ReleasesTab.tsx              # extend: D-18 one-shot branch-search fetch + D-19 row icon
```

### Pattern 1: 404-as-missing branch existence check (D-13)
**What:** `GET /projects/:id/repository/branches/:branch` returns `404` with body `{"message":"404 Branch Not Found"}` `[CITED: GitLab issue #25290 reproduction, python-gitlab client behavior — MEDIUM, no official docs page states the exact 404 body verbatim but is consistently reproduced across multiple independent sources]` when the branch doesn't exist. This must NOT be treated as a thrown error — it is a valid "missing" state, unlike every other `gitlab.ts` function's `if (!response.ok) throw` pattern.
**When to use:** The one new read function (`fetchBranch`) that needs a tri-state result (exists / missing / real error), not the boolean-throw pattern the rest of `gitlab.ts` uses.
**Example:**
```typescript
// New function in gitlab.ts — 404 branch to a discriminated result, not a throw
export async function fetchBranch(
  baseUrl: string,
  token: string,
  projectId: number,
  branchName: string,
): Promise<{ exists: true } | { exists: false }> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`;
  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
      'Load Release Branch',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (response.status === 404) return { exists: false };
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to check release branch', response.status, 'gitlab');
    }
    throw new Error(`Failed to check release branch: status ${response.status}`);
  }
  return { exists: true };
}
```

### Pattern 2: Write-op template (`updateMilestone`'s shape, reused twice)
**What:** Every existing write in `gitlab.ts` (there is exactly one: `updateMilestone` at L786) follows: `apiFetch` with `method`, `PRIVATE-TOKEN` + `Content-Type` headers, `ApiError` thrown on 401/403, and on any other non-ok response, parse `response.json().catch(() => null)` for a `{ message?: string }` body and surface `body.message` verbatim (falling back to the status code). D-22 requires both new writes (`createBranch`, `createMilestone`) to follow this exactly.
**When to use:** Both new POST operations.
**Example:**
```typescript
// Source: taskflow/src/services/gitlab.ts:786 (updateMilestone) — the locked template
export async function createMilestone(
  baseUrl: string,
  token: string,
  projectId: number,
  fields: { title: string; due_date: string },
): Promise<GitLabMilestone> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/milestones`;
  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        method: 'POST',
        headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      },
      'Create Milestone',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to create milestone', response.status, 'gitlab');
    }
    const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new Error(`Failed to create milestone: ${msg ?? `status ${response.status}`}`);
  }
  return (await response.json()) as GitLabMilestone;
}
```
Note: GitLab validation error bodies commonly return `message` as an **array of strings** (e.g. `{"message":["Title has already been taken"]}`), not always a single string — the `updateMilestone` template's `body?.message` typing (`string?`) should be widened to `string | string[]` for both new writes, or the duplicate-title server error will render as `[object Object]`. `[ASSUMED — GitLab's typical Rails-style validation error array shape; not confirmed against this exact endpoint's response in this session]`

### Pattern 3: Pure version-extraction + git-ref validation module (D-12, D-09, D-11)
**What:** A React-free module (`releaseBranch.ts`) extracting the `X.Y.Z` version component from a milestone title in the real `X.Y.Z (DD.MM.YYYY)` format, and validating the resulting branch name against a practical subset of git's ref-name rules.
**When to use:** Called from `useReleaseDetail.ts` (or a section component) to derive `release/{version}` and to gate the Create button.
**Example:**
```typescript
// NEW file: taskflow/src/routes/dashboard/release-detail/releaseBranch.ts
// Source: git-check-ref-format(1) rules — see Common Pitfalls below for citation

/** Extracts the leading X.Y.Z semver-shaped token from a milestone title.
 *  Real titles are "33.5.0 (21.07.2026)" (D-01); this deliberately does NOT
 *  require the full "(DD.MM.YYYY)" suffix to be present, so legacy/off-format
 *  titles with a valid leading version still resolve (D-11 only blocks when
 *  NO version token is found at all).
 */
export function extractVersionFromMilestoneTitle(title: string): string | null {
  const match = title.trim().match(/^(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

export function deriveReleaseBranchName(milestoneTitle: string): string | null {
  const version = extractVersionFromMilestoneTitle(milestoneTitle);
  return version ? `release/${version}` : null;
}

/** Practical subset of git-check-ref-format(1) worth enforcing client-side
 *  before a create call (GitLab still validates server-side; this is fast
 *  UX feedback, not the source of truth). */
export function isValidGitRefName(name: string): boolean {
  if (!name || name.length > 255) return false;
  if (name.startsWith('/') || name.endsWith('/')) return false;
  if (name.endsWith('.lock')) return false;
  if (name.endsWith('.')) return false;
  if (name.includes('..')) return false;
  if (name.includes('//')) return false;
  if (name.includes('@{')) return false;
  if (name === '@') return false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — validating ASCII control chars are absent
  if (/[\x00-\x1f\x7f]/.test(name)) return false;
  if (/[\s~^:?*[\\]/.test(name)) return false;
  if (name.split('/').some((seg) => seg.startsWith('.'))) return false;
  return true;
}
```

### Anti-Patterns to Avoid
- **Refetching the full unwindowed milestone list to check duplicates (violates D-05):** Reuse `fetchProjectMilestonesInRange`'s already-cached windowed data; do not add a second `fetchProjectMilestones` call inside the dialog.
- **Treating GET-branch 404 as an error (violates D-13):** `gitlab.ts`'s universal `if (!response.ok) throw` pattern must be special-cased for this one endpoint — a naive copy-paste of any existing read function will incorrectly throw on the common "branch doesn't exist yet" case, which is this feature's entire reason to exist.
- **Per-row branch-existence fetch in the Releases list (violates D-18, GGX-WARN-01-class bug):** This codebase has hit the "fetch-once page-cap trap" bug class twice already (per STATE.md). Fetch the branch set ONCE with `search=release/` fully paginated, never one call per row.
- **Silent-guess branch names from unparseable titles (violates D-11):** Never fall back to slugifying the raw milestone title. `deriveReleaseBranchName` returning `null` must disable Create, not produce a sanitized guess.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirm-before-write dialog shell | A new dialog component from scratch | Copy `ConfirmSprintMoveDialog`/`BoardResolutionDialog` structure verbatim (Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter/DialogClose, `showCloseButton={false}`, controlled `open`/`onOpenChange`) | Two working precedents exist in this exact codebase; UI-SPEC explicitly mandates copying them |
| Mutation + cache invalidation | Bespoke fetch-then-setState | `useMutation` from `@tanstack/react-query`, mirroring `useFieldMutation.ts`'s `onError`/`onSettled` shape (minus optimistic update — D-15 explicitly wants none) | Established, tested pattern already used for every other write in the app |
| Branch-name / git-ref validation | A hand-rolled "no spaces" check only | The fuller rule set from `git-check-ref-format(1)` (see Pattern 3 above) | RELBR-05 explicitly calls out that milestone titles "may contain spaces, slashes, or unicode" — a partial check would pass invalid refs through to a confusing GitLab 400 |
| Milestone title format enforcement | Free-text regex reinvented per call site | One shared regex/validator in `releaseBranch.ts` (or a small `releaseMilestone.ts` sibling) exporting `MILESTONE_TITLE_FORMAT_RE` for both the create-dialog's live validation and any future consumer | D-02 requires exact enforcement; a single source of truth avoids the format drifting between the input validator and any duplicate-check normalization |

**Key insight:** This phase's complexity is almost entirely in domain logic (version parsing, git-ref rules, date-windowed duplicate matching) which is precisely the kind of thing worth a small hand-rolled pure function — but the *dialog shell*, *mutation plumbing*, and *cache invalidation* are commodity patterns already solved three times over in this codebase and must not be reinvented.

## Common Pitfalls

### Pitfall 1: `git-check-ref-format` rules are non-obvious and easy to under-enforce
**What goes wrong:** A branch-name validator that only checks for spaces will pass through `..`, a leading `.`, a trailing `.lock`, or control characters, all of which GitLab's own git backend rejects — producing a confusing late-stage 400 instead of the fast client-side rejection RELBR-05 asks for.
**Why it happens:** Most people only remember "no spaces" from git ref rules; the full spec (`git-check-ref-format(1)`) has ~10 distinct rules.
**How to avoid:** Use the rule set in Pattern 3 above — it directly enforces: no leading `/`, no trailing `/`, no `..`, no trailing `.lock`, no trailing `.`, no `//`, no `@{`, not literally `@`, no ASCII control chars, no `~^:?*[\`, no path segment starting with `.`.
**Warning signs:** A branch-name unit test suite that only covers "has a space" and "is empty" — Pattern 3's example tests should assert against `..`, `.lock`, leading `/`, and control chars too.
**Source:** `[ASSUMED — training-knowledge summary of git-check-ref-format(1); this is a well-established, stable POSIX/git spec not subject to version drift, but was not re-verified against a live `man git-check-ref-format` in this session]`

### Pitfall 2: 404-as-missing must be a deliberate exception to the codebase's universal throw-on-!ok pattern
**What goes wrong:** Every other function in `gitlab.ts` throws on any non-2xx response. If `fetchBranch` is written by copy-pasting an existing function (the natural instinct given D-22's "follow the template" directive), the 404 case will throw instead of resolving to `{ exists: false }`, and the "missing branch" UI state will never render — it'll show as a persistent error instead.
**Why it happens:** Copy-paste from the dominant pattern in the file, without registering that THIS ONE endpoint needs a status-code branch before the generic `!response.ok` check.
**How to avoid:** Check `response.status === 404` and return the missing-state FIRST, before the generic `if (!response.ok)` block (see Pattern 1).
**Warning signs:** A unit/integration test that mocks a 404 response and asserts the function throws — that's the pattern being tested backwards.

### Pitfall 3: GitLab milestone validation error bodies can be `message: string[]`, not `message: string`
**What goes wrong:** `updateMilestone`'s existing error-body typing assumes `{ message?: string }`. GitLab's Rails-style ActiveRecord validation errors commonly return `message` as an **array** (e.g. `["Title has already been taken"]`). If `createMilestone` copies the exact typing, a duplicate-title server rejection renders as `Failed to create milestone: Title has already been taken` only if `message` happens to be a string for this specific endpoint — but if it's an array, template-literal interpolation produces the ugly `Failed to create milestone: Title has already been taken` (array joins with commas by default in JS template literals, which is usually fine for a single-element array but breaks for multi-error responses).
**Why it happens:** GitLab's API is not perfectly consistent about scalar-vs-array error message shapes across endpoints.
**How to avoid:** Widen the type to `string | string[]` and explicitly `Array.isArray(body?.message) ? body.message.join(', ') : body?.message` (shown in Pattern 2). Confirm against the real error body when D-08's server-side-rejection path is manually tested during execution (a milestone with a date outside the windowed query, per D-08, is the accepted trigger case).
**Source:** `[ASSUMED — general GitLab/Rails API convention, not confirmed against this exact endpoint's live error body in this session]`

### Pitfall 4: 400 vs 409 status code inconsistency on "already exists" conditions
**What goes wrong:** Code that branches its error handling on `response.status === 409` for "branch already exists" or "milestone title taken" will never trigger — GitLab returns `400 Bad Request` for both conditions, not the semantically-correct `409 Conflict`.
**Why it happens:** This is a documented, longstanding GitLab API inconsistency (their own docs state 409 is correct for "conflicting resource," but the actual endpoints return 400).
**How to avoid:** Do not special-case 409 anywhere in this phase's status-code handling. Both `createBranch` and `createMilestone` should treat any non-401/403/2xx status (including the "already exists" case) as a generic failure whose `body.message` is surfaced verbatim in the dialog (D-16) — the message text itself ("Branch already exists" / "Title has already been taken"), not the status code, is what distinguishes the collision case for the user.
**Warning signs:** An `if (response.status === 409)` branch anywhere in `createBranch`/`createMilestone` — that branch will be dead code.
**Source:** `[CITED: GitLab issue #356008, GitLab issue #22739 — both confirm 400-not-409 as a known, still-open API design inconsistency]`

### Pitfall 5: The client-side duplicate check is best-effort, not authoritative (accepted per D-08)
**What goes wrong:** Building the create-milestone dialog's duplicate check as if it were exhaustive — e.g. disabling the whole dialog rather than just the submit button when a match is found, or treating "no client-side match" as proof the title is free.
**Why it happens:** The windowed query (`fetchProjectMilestonesInRange`, ±7 days around the release date) intentionally does NOT fetch the full project milestone list — a milestone whose due_date falls outside that window is invisible to the client check.
**How to avoid:** D-08 already accepts this: the client check blocks submit only when a match IS found in the windowed+ancestor-filtered list; when no match is found, the dialog still submits and lets GitLab's server-side validation be the final authority — and D-16 requires the resulting server error to render inside the dialog, not crash or silently fail.
**Warning signs:** Any code path that treats an empty client-side duplicate-check result as a guarantee of uniqueness (e.g., skipping error-body display on the POST because "we already checked").

## Code Examples

Verified patterns from official sources / direct codebase reads:

### GitLab: fetch a single project (for `default_branch`, D-14)
```typescript
// New function, mirrors listGitLabProjects()'s error-handling shape exactly
// Source: https://docs.gitlab.com/api/projects/#get-single-project (default_branch field confirmed)
export async function fetchProject(
  baseUrl: string,
  token: string,
  projectId: number,
): Promise<GitLabProject> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}`;
  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
      'Load Project',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch project', response.status, 'gitlab');
    }
    throw new Error(`Failed to fetch project: status ${response.status}`);
  }
  return (await response.json()) as GitLabProject;
}
```

### GitLab: create a branch off the default branch (D-14, D-04-analogue for branches)
```typescript
// Source: https://docs.gitlab.com/api/branches/ — POST /projects/:id/repository/branches
export async function createBranch(
  baseUrl: string,
  token: string,
  projectId: number,
  branchName: string,
  ref: string,
): Promise<{ name: string; web_url: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/repository/branches`;
  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        method: 'POST',
        headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: branchName, ref }),
      },
      'Create Release Branch',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to create branch', response.status, 'gitlab');
    }
    const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new Error(`Failed to create branch: ${msg ?? `status ${response.status}`}`);
  }
  return (await response.json()) as { name: string; web_url: string };
}
```

### GitLab: milestone `project_id`/`group_id` distinguishing filter (D-07)
```typescript
// Extends GitLabMilestone interface (gitlab.ts:226):
export interface GitLabMilestone {
  // ...existing fields...
  project_id?: number | null;
  group_id?: number | null;
}

// Local filter to exclude inherited group (ancestor) milestones from duplicate
// check + reference list, reusing the ALREADY-FETCHED windowed list (D-05/D-07):
function ownProjectMilestones(
  milestones: GitLabMilestone[],
  activeGitlabProject: number,
): GitLabMilestone[] {
  return milestones.filter((m) => m.project_id === activeGitlabProject);
}
```
`[CITED: GitLab milestones API docs + confirmed cross-referenced behavior — project milestones carry project_id, group milestones (including inherited ancestors surfaced via include_ancestors=true) carry group_id instead — MEDIUM confidence, this exact field-presence-on-inherited-entries behavior was corroborated via web search of GitLab's documented response shape, not via a live query against this team's instance. The probe (probe.sh Probe B) verifies this against real data.]`

### Existing template (unchanged, for reference): `updateMilestone`
```typescript
// Source: taskflow/src/services/gitlab.ts:786-825 — read verbatim, this is the locked template
```
(See file directly — already fully quoted in Pattern 2 above with the two required adaptations.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A | N/A | — | This phase does not touch a fast-moving external dependency; GitLab's branches/milestones/projects REST API v4 shapes used here have been stable for years and are not expected to have changed recently. |

**Deprecated/outdated:**
- `include_parent_milestones` — GitLab deprecated this milestone-query param in favor of `include_ancestors` as of GitLab 16.7. The codebase already uses the correct current name (`include_ancestors=true`, `gitlab.ts:708`) — no change needed, noted for awareness only. `[CITED: GitLab milestones API changelog reference found during research]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Full git-check-ref-format rule set (Pattern 3 validator) is complete/correct without re-verifying `man git-check-ref-format` live in this session | Architecture Patterns / Common Pitfalls #1 | Low — these rules are a stable, decades-old git spec; worst case a rare edge-case ref (e.g. an obscure Unicode combining-character rule) slips through client-side and GitLab's server-side git backend rejects it anyway (D-16 already handles server rejections gracefully) |
| A2 | GitLab milestone creation validation error bodies use `message: string \| string[]` (Rails-style array-or-scalar) | Common Pitfalls #3, Pattern 2 code example | Medium — if wrong, a duplicate-title server error could render awkwardly (e.g. `[object Object]`) instead of a clean message; low severity (cosmetic), easily caught in manual UAT of D-08's trigger case |
| A3 | Inherited group milestones surfaced via `include_ancestors=true` carry `group_id` populated and `project_id` null/absent, letting the D-07 local filter work without a second request | Code Examples (project_id/group_id filter), D-07 | Medium — if the real GitLab instance behaves differently (e.g. `project_id` populated with the ANCESTOR project's id rather than null), the D-07 filter would silently show inherited milestones as "own" duplicates, incorrectly blocking a legitimate title. `probe.sh` Probe B is designed specifically to catch this before implementation locks in — planner should treat D-07 as provisional until the probe runs. |
| A4 | GET single branch 404 response body is exactly `{"message":"404 Branch Not Found"}` | Pattern 1 | Low — the exact body text doesn't matter for `fetchBranch`'s logic (it only branches on `response.status === 404`, never parses the 404 body), so this assumption has near-zero blast radius even if slightly wrong |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **RELMS-04 live-data probe not executed — real milestone title collision risk unknown**
   - What we know: The real title format is `X.Y.Z (DD.MM.YYYY)` (D-01, user-confirmed). The client-side duplicate check will compare against the windowed+ancestor-filtered list (D-05/D-07).
   - What's unclear: Whether the team's actual GitLab project has any existing whitespace-padded, case-variant, or off-format milestone titles that would confuse an exact-string duplicate match, and whether `include_ancestors=true` behaves as documented (project_id/group_id presence, A3 above) on this specific GitLab instance/version.
   - Recommendation: `probe.sh` (written to this phase's directory) must be run by a human with `GITLAB_BASE_URL`, `GITLAB_PAT`, and `PROJECT_ID` env vars set, against the real GitLab instance, before RELMS-04's exact-match-vs-fuzzy-match decision is locked in a plan. This is a manual-run script (same convention as Phase 85's `probe.sh`) — this research agent has no access to the app's stored PAT (Tauri stronghold, unlockable only inside the running desktop app) and cannot execute it directly.

2. **Exact GitLab edition/version running on the team's instance is unconfirmed**
   - What we know: The codebase already targets GitLab API v4 (`/api/v4/...`) consistently across `gitlab.ts`; `include_ancestors` (the current, non-deprecated param name) is already in use, implying a reasonably current GitLab version (16.7+).
   - What's unclear: The precise GitLab CE/EE version and whether any self-hosted customization affects the exact response shapes documented above.
   - Recommendation: Not blocking for this phase — the API shapes used (branches, milestones, projects) have been stable across many GitLab releases. If `probe.sh` surfaces an unexpected response shape, escalate then.

## Environment Availability

> Skipped — this phase has no new external tool/runtime dependencies beyond the already-configured GitLab connection (PAT + base URL), which the app already requires and validates during onboarding. No new CLI tools, databases, or services are introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 `[VERIFIED: package.json]` |
| Config file | `taskflow/vitest.config.ts` (jsdom environment, globals, `./src/test/setup.ts`) |
| Quick run command | `npm run test -- src/routes/dashboard/release-detail/releaseBranch.test.ts` |
| Full suite command | `npm run test` (== `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RELBR-01 | Branch name resolves as `release/<version>` from matched milestone title | unit | `npm run test -- releaseBranch.test.ts -t "deriveReleaseBranchName"` | ❌ Wave 0 |
| RELBR-02 | Branch existence surfaced on release detail view | manual + integration (mocked `fetchBranch` 404/200 in a component test, or manual UAT) | manual click-through (sidebar row renders exists/missing) | ❌ Wave 0 (component test optional; manual UAT sufficient per Phase 87 precedent) |
| RELBR-03 | Release-level warning when branch missing | manual UAT | manual click-through | n/a |
| RELBR-04 | Create branch off default branch, behind confirm dialog | unit (dialog copy/derivation logic) + manual (actual GitLab write, since this is a live-write action best verified once manually, mirroring D-16's error-in-dialog manual check) | `npm run test -- releaseBranch.test.ts` for pure logic; manual UAT for the live write | ❌ Wave 0 |
| RELBR-05 | Branch name validated against git ref rules before creation | unit | `npm run test -- releaseBranch.test.ts -t "isValidGitRefName"` | ❌ Wave 0 |
| RELMS-01 | User sees when no milestone matches | manual UAT (existing `resolveGitLabMatch`/`gitlabMatch.type === 'none'` logic, already unit-tested in `releaseSummaries.test.ts`) | existing suite | ✅ (logic already covered) |
| RELMS-02 | Create milestone behind confirm dialog | manual UAT (live write) | manual click-through | n/a |
| RELMS-03 | Dialog lists recent milestones, format-enforced input | unit (format regex) + manual (dialog rendering of the reference list) | `npm run test -- releaseBranch.test.ts -t "MILESTONE_TITLE_FORMAT"` (or a sibling `releaseMilestone.test.ts`) | ❌ Wave 0 |
| RELMS-04 | Duplicate title detected and blocked client-side | unit (pure duplicate-match function against a fixture list) | new test file, e.g. `releaseMilestoneDuplicate.test.ts` | ❌ Wave 0 — also gated on the live probe (see Open Questions #1) |

### Sampling Rate
- **Per task commit:** `npm run test -- <touched test file>`
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`; additionally, `npm run check` (biome+tsc) must show zero NEW errors relative to the documented 2-error `BacklogPage.tsx`/`BacklogRow.tsx` baseline (STATE.md).

### Wave 0 Gaps
- [ ] `release-detail/releaseBranch.test.ts` — covers RELBR-01, RELBR-05 (version extraction + git-ref validation), and ideally the milestone title format regex for RELMS-03 (or split into a sibling test file if the format constant lives in a separate module)
- [ ] A duplicate-detection unit test fixture (windowed milestone list + candidate title → match/no-match) — covers RELMS-04's pure logic; live-instance edge cases depend on the probe (Open Questions #1)
- [ ] Framework install: none — Vitest is already configured and used by `releaseSummaries.test.ts` in the same folder

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Out of scope — PAT-based auth already established, unchanged by this phase |
| V3 Session Management | no | N/A — desktop app, no session concept beyond the stored PAT |
| V4 Access Control | no (explicitly out of scope) | Team is all Developer+ role; a 403 from GitLab surfaces as a normal `ApiError` via the existing pattern — no client-side gating logic is built (REQUIREMENTS.md "Out of Scope" table, user-confirmed) |
| V5 Input Validation | yes | Client-side git-ref validation (`isValidGitRefName`) and milestone-title format validation (`X.Y.Z (DD.MM.YYYY)` regex) before any write call — defense-in-depth alongside GitLab's own server-side validation, never a substitute for it |
| V6 Cryptography | no | No new cryptographic operations — the GitLab PAT continues to be read via the existing `readSecret('gitlab-pat')` / Tauri stronghold path, unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Injection via unvalidated branch name into a URL path segment | Tampering | `encodeURIComponent(branchName)` on every path-segment interpolation (already the established pattern in every existing `gitlab.ts` function that interpolates user/derived strings into a URL, e.g. `fetchMilestoneMRs`'s `encodeURIComponent(milestoneTitle)`) |
| Client-side-only validation bypassed by a crafted request | Tampering | Not a real risk here — the PAT is the same trust boundary as the interactive user; GitLab's own server-side validation is the actual authority (D-08 already designs around this: client checks are best-effort, server response is trusted) |
| Leaking the PAT in devtools/logs during a write call | Information Disclosure | Already handled by `apiFetch`'s existing header redaction (`PRIVATE-TOKEN` -> `[REDACTED]` in `apiFetch.ts:85`) — no new work needed, both new writes go through `apiFetch` like everything else |

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `taskflow/src/services/gitlab.ts`, `taskflow/src/routes/dashboard/release-detail/{useReleaseDetail.ts,releaseSummaries.ts,ReleaseDetailSidebar.tsx,IssuesSection.tsx}`, `taskflow/src/routes/dashboard/ReleasesTab.tsx`, `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx`, `taskflow/src/routes/dashboard/BoardResolutionDialog.tsx`, `taskflow/src/services/releaseLinker.ts`, `taskflow/src/lib/apiFetch.ts`, `taskflow/src/lib/api-error.ts`, `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts`, `taskflow/vitest.config.ts`, `taskflow/package.json`
- https://docs.gitlab.com/api/branches/ — GET single branch + POST create branch request/response shapes
- https://docs.gitlab.com/api/milestones/ — GET list + POST create milestone params, `title` exact-match filter, `include_ancestors`
- https://docs.gitlab.com/api/projects/#get-single-project — `default_branch` field confirmed

### Secondary (MEDIUM confidence)
- https://gitlab.com/gitlab-org/gitlab/-/issues/356008 and https://gitlab.com/gitlab-org/gitlab/-/issues/22739 — 400-vs-409 status code inconsistency for "already exists" conditions, confirmed via two independent GitLab-hosted issue reports
- GitLab milestone `project_id`/`group_id` inheritance-distinguishing behavior — corroborated across multiple independently-sourced doc excerpts, but not verified against this team's live instance (see probe.sh, A3)
- GET single branch 404 body shape (`{"message":"404 Branch Not Found"}`) — corroborated across a GitLab issue reproduction and the python-gitlab client's documented error handling

### Tertiary (LOW confidence)
- Git-check-ref-format rule enumeration (Pattern 3) — standard training knowledge of a stable, well-known git spec; not re-verified against a live `man git-check-ref-format` in this session (A1)
- GitLab milestone validation error body being `string | string[]` — general GitLab/Rails API convention pattern-matched from experience, not confirmed against this exact endpoint (A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all patterns read directly from the existing codebase
- Architecture: HIGH — directly extends an already-decomposed, well-documented Phase 87 structure with explicit CONTEXT.md decisions to follow
- Pitfalls: MEDIUM-HIGH — GitLab API shapes are HIGH confidence (official docs); the RELMS-04 real-data collision risk is unresolved pending the human-run probe (MEDIUM until probe.sh runs)

**Research date:** 2026-08-10
**Valid until:** 30 days (stable GitLab REST API v4 surface; re-verify if `probe.sh` reveals an unexpected GitLab version/edition behavior)
