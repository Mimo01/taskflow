# Architecture Research: v1.14 Release Management

**Domain:** Subsequent-milestone integration — git-flow release coordination bolted onto an existing Tauri 2 + React 18 + TanStack Query app
**Researched:** 2026-08-10
**Confidence:** HIGH (all claims verified by reading the actual files listed in `<files_to_read>`; no invented APIs)

## Standard Architecture (as it exists today — do not redesign)

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Routes (dashboard)                          │
│  ReleasesTab.tsx (list)          ReleaseDetailPage.tsx (1518 LOC, 1 file)│
│  UpcomingReleasesTimeline.tsx    ── owns ALL queries + ALL mutations +   │
│  (Dashboard card, read-only)        edit modal + issues table + sidebar │
├──────────────────────────────────────────────────────────────────────────┤
│                         TanStack Query (data + cache)                    │
│  gcTime: Infinity · stale-while-revalidate · token read in queryFn body  │
│  (never in queryKey) · broad-prefix invalidateQueries on mutation        │
├──────────────────────────────────────────────────────────────────────────┤
│                    Services layer (src/services/)                        │
│  gitlab.ts (1736 LOC, 24 exports, ONE write today: updateMilestone)      │
│  releaseLinker.ts (80 LOC, pure, zero I/O, fully unit-testable)          │
│  jira.ts (barrel over 14 domain modules — all ~60 imports use this path) │
│  linkEngine.ts (linkMRToTask — ticket-key ↔ MR matching, pure)           │
├──────────────────────────────────────────────────────────────────────────┤
│                    Zustand stores (src/stores/)                          │
│  auth.store (credentials/base URLs, NOT persisted to disk as secrets)    │
│  pinned-tabs.store, tempo-filters.store, subtask-templates.store — all   │
│  createTauriStorage('<name>.json') + Zustand persist                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (verified from source)

| Component | Responsibility | Verified detail |
|-----------|-----------------|------------------|
| `ReleasesTab.tsx` | List view: fix versions + date-matched GitLab milestone/tag link, per-version issue counts | 480 LOC, single file, no sub-decomposition — acceptable at this size |
| `ReleaseDetailPage.tsx` | Everything for one release: header, description(s), issues×MR table, unmatched-MR list, label coverage, edit modal (Jira+GitLab dual-write), sidebar metadata | 1518 LOC, **one file, one component function** |
| `services/gitlab.ts` | All GitLab REST calls. Auth via `PRIVATE-TOKEN` header (not Bearer). `apiFetch('gitlab', url, opts, label)` wrapper for logging/profiling. One write today (`updateMilestone`, PUT) | Every function follows the same try/catch → `ApiError` on 401/403 → generic "Cannot reach" on network failure pattern |
| `services/releaseLinker.ts` | Pure date-matching between a Jira fix version and a GitLab candidate (milestone/tag). No `fetch`, no imports beyond types. Fully unit-testable | This is the pattern to emulate for the new drift/discovery logic |
| `services/linkEngine.ts` (`linkMRToTask`) | Pure ticket-key extraction + MR↔issue matching, already used by `ReleaseDetailPage` for the milestone-MR list | Reused as-is by the new three-channel union — do not reimplement |
| `issue-detail/` folder | **The existing precedent for decomposing a large detail page.** `FieldsSection.tsx` (1153 LOC) + 25 sibling files: `ActivityTimeline.tsx`, `AttachmentsSection.tsx`, `SubtasksSection.tsx`, `MergeRequestsSection.tsx`, `MetaRow.tsx`, plus **hooks-as-files**: `useFieldMutation.ts`, `useLinkedMRs.ts`, `useAuthBlob.ts`, plus pure helpers: `utils.ts`, `aggregateTimeTracking.ts`, `resolvePreviewKind.ts`, and a barrel `index.ts` | This is the exact convention `ReleaseDetailPage.tsx` should follow — a same-named sibling folder, one file per section/hook/pure-helper |
| `BulkCreateSubtasksModal.tsx` (`createAllRows`) | Per-row status state machine: `pending → creating → created \| failed`, sequential loop (not `Promise.all`), `onStateChange` callback re-renders the row list, retry-failed-only via re-invoking with `states[i].status === 'created'` skip guard | This is the exact per-row inline-status + retry pattern the v1.14 CONTEXT calls out for per-MR corrective actions |
| `StatusPopover.tsx` | Optimistic-mutation trigger pattern: reads cached GreenHopper transitions, calls `onSelect(id, name)`, parent (`SprintBoard`/`Backlog`) owns the actual `useMutation` with `onMutate` (optimistic) / `onError` (rollback) / `onSettled` (invalidate) | Confirms optimistic+rollback lives in the mutation-owning component, not the trigger UI |

## Recommended Project Structure (delta on top of existing)

```
src/services/
├── gitlab.ts                        # MODIFIED — new write functions appended (see below)
├── releaseFlow.ts                   # NEW — pure module, sibling to releaseLinker.ts
│                                     #   (three-channel union, drift classification,
│                                     #    branch-name resolution, merge-back verdict)
├── releaseLinker.ts                 # UNCHANGED — date-matching stays scoped to its job
└── linkEngine.ts                    # UNCHANGED — reused by releaseFlow.ts

src/routes/dashboard/
├── ReleaseDetailPage.tsx            # MODIFIED — shrinks to an orchestrator (queries + layout wiring), mirrors issue-detail/index.ts pattern
├── ReleasesTab.tsx                  # MODIFIED — release-level branch-missing warning badge added to each row (small, read-only)
├── UpcomingReleasesTimeline.tsx     # UNCHANGED — Dashboard card, out of scope for write actions
└── release-detail/                  # NEW folder — mirrors issue-detail/ convention
    ├── index.ts                     # NEW — barrel (mirrors issue-detail/index.ts)
    ├── ReleaseHeaderSection.tsx      # NEW — name/id/status header (extracted, ~40 LOC)
    ├── ReleaseDescriptionSection.tsx # NEW — Jira+GitLab description blocks (extracted)
    ├── ReleaseBranchSection.tsx      # NEW — branch-existence warning + "Create branch" confirm dialog + merge-back check
    ├── ReleaseDriftSection.tsx       # NEW — three-channel drift table + per-MR retarget/assign actions
    ├── ReleaseIssuesTable.tsx        # extracted from current inline JSX (lines ~778-1064) — the existing issues×MR table
    ├── ReleaseSidebar.tsx            # extracted from current inline JSX (lines ~1104-1303) — the existing MetaRow-based right column
    ├── ReleaseEditDialog.tsx         # extracted from current inline JSX (lines ~1305-1479) — the existing Jira+GitLab dual-write edit modal
    ├── CreateMilestoneDialog.tsx     # NEW — confirm dialog, latest-milestones list, name input
    ├── CreateBranchDialog.tsx        # NEW — confirm dialog for release branch creation
    ├── useReleaseGitlabWrites.ts     # NEW — hook housing the 4 new mutations (createBranch, createMilestone, retargetMr, assignMrMilestone)
    ├── useReleaseBranchState.ts      # NEW — hook wrapping branch-existence + merge-back queries
    └── MetaRow.tsx                   # reuse issue-detail/MetaRow.tsx directly (already generic) OR duplicate — see Anti-Patterns
```

### Structure Rationale

- **`release-detail/` mirrors `issue-detail/` exactly** — same-named sibling folder pattern, one responsibility per file, hooks live as `.ts` files beside `.tsx` sections, pure helpers separate from anything doing I/O. This is not a new convention; it is the one the codebase already uses for its other 1000+ line detail page.
- **`releaseFlow.ts` is a new pure module, not an extension of `releaseLinker.ts`.** `releaseLinker.ts`'s docstring is scoped tightly ("date matching between Jira fix versions and GitLab milestones/tags") and its match thresholds (`exact`/`fuzzy`/`none` by day-diff) are a different algorithm from set-union + drift classification. Keeping them separate keeps each pure module single-purpose and independently unit-testable, matching the existing precedent of `linkEngine.ts` also living apart from `releaseLinker.ts` despite both being "MR↔release matching" adjacent.
- **GitLab writes append to `gitlab.ts`, not a new file.** The service is a flat 1736-line file with 24 exports and one write (`updateMilestone`); there is no `services/gitlab/` domain-split (unlike `jira.ts`, which was split into 14 modules in v1.4). Splitting `gitlab.ts` now would be an unrelated refactor and contradicts "study it, do not redesign it." Follow `updateMilestone`'s exact shape for every new write.

## Architectural Patterns

### Pattern 1: Pure discovery/drift module, network-free (emulates `releaseLinker.ts`)

**What:** All three-channel MR discovery, set-union, and drift classification logic lives in `services/releaseFlow.ts` as plain functions over already-fetched data. It takes arrays (Jira issues, GitLab MRs from 3 sources, the release branch name, the matched milestone) and returns a computed drift result. It performs **zero fetching**.

**Why this avoids the fetch-once-page-cap pitfall:** The pitfall (recorded in project memory as `project_fetch_once_pagecap_pitfall.md`, and explicitly fixed in v1.13 Phase 82 per `fetchAllSearchPages`) is pickers/components that fetch ONE capped page of data and then filter/search it client-side, silently truncating results. The fix pattern already established in this codebase (My Tasks "all assigned" scope, `fetchAllSearchPages`) is: **paginate fully in the service layer, keep the pure/computation layer separate from the paginating fetch layer.**

For release MR discovery specifically:
- Channel A (Jira-key linkage → fix-version issues): already paginated fully by `fetchFixVersionIssues` (loops `startAt` until `allIssues.length >= data.total`) — no risk here, reuse as-is.
- Channel B (milestone-carrying MRs): `fetchMilestoneMRs` already pages fully (`while(true)` loop until `data.length < perPage`) — reuse as-is, **do not** reach for `fetchRecentProjectMRs` (the deliberately-capped-at-100 "recent MRs" helper) for this channel; that helper exists ONLY for the existing "wrong milestone" heuristic and is explicitly documented as a bounded, accuracy-tradeoff optimization (GGX-WARN-01 comment in `ReleaseDetailPage.tsx` line 1148-1171) — reusing it for authoritative drift detection would reintroduce exactly the silent-truncation bug this pitfall warns about.
- Channel C (release-branch-targeting MRs): **needs a new, fully-paginated GitLab call** — `GET /merge_requests?target_branch=release/X&state=all` with the same `while(true) per_page=100` loop used everywhere else in `gitlab.ts` (see `fetchMilestoneMRs`, `fetchProjectMilestones`, `fetchMRDiscussions` for the exact loop shape to copy). **Do not** cap this at `per_page=100` with no continuation — that is precisely the anti-pattern the memory note warns about.

**Input/output shape (proposed):**
```typescript
// services/releaseFlow.ts
export interface ReleaseFlowInput {
  releaseBranchName: string;                 // `release/<milestone title>`
  fixVersionIssueKeys: string[];              // Channel A source
  milestoneCarryingMRs: GitLabMR[];           // Channel B (from fetchMilestoneMRs, already paginated)
  branchTargetingMRs: GitLabMR[];             // Channel C (new fully-paginated fetch)
  matchedMilestoneId: number | null;
}

export type DriftReason =
  | 'wrong-target-branch'   // MR carries a fix-version Jira key but targets something other than releaseBranchName
  | 'missing-milestone'     // MR targets the release branch but doesn't carry the release milestone
  | 'not-in-fix-version';   // MR carries the release milestone/branch but its Jira key isn't in this fix version

export interface UnionedMR {
  mr: GitLabMR;
  foundVia: Array<'jira-key' | 'milestone' | 'branch-target'>;
  driftReasons: DriftReason[];
}

export function unionReleaseMRs(input: ReleaseFlowInput): UnionedMR[];
export function classifyDrift(unioned: UnionedMR[], fixVersionIssueKeys: string[]): UnionedMR[]; // or folded into unionReleaseMRs
```

Fully unit-testable with fixture arrays — no `fetch`, no Tauri runtime, no mocking, exactly like `releaseLinker.test.ts` today.

### Pattern 2: GitLab write mutations — confirm-dialog vs direct-optimistic split (per CONTEXT.md, verified against `updateMilestone`'s shape)

**What:** Four new `gitlab.ts` exports, each following `updateMilestone`'s exact signature convention (`baseUrl, token, projectId, ...params, fields`) and error-handling shape (network catch → generic message; `!response.ok` → 401/403 `ApiError`; else surface GitLab's JSON `message` body, falling back to `status ${code}`):

```typescript
// gitlab.ts additions
export async function fetchProjectDefaultBranch(baseUrl, token, projectId): Promise<string>;
// GET /projects/:id → { default_branch }. Confirms CONTEXT.md's "read from API, no configuration".

export async function fetchBranch(baseUrl, token, projectId, branchName): Promise<GitLabBranch | null>;
// GET /projects/:id/repository/branches/:branch (URL-encode slash). 404 → null (not "doesn't exist" thrown —
// existence-check is an expected negative case, not an error).

export async function createBranch(baseUrl, token, projectId, branchName, ref): Promise<GitLabBranch>;
// POST /projects/:id/repository/branches?branch=X&ref=Y

export async function createMilestone(baseUrl, token, projectId, title, description?): Promise<GitLabMilestone>;
// POST /projects/:id/milestones — sibling write to the existing updateMilestone (PUT)

export async function updateMRTargetBranch(baseUrl, token, projectId, mrIid, targetBranch): Promise<GitLabMRDetail>;
// PUT /projects/:id/merge_requests/:iid  { target_branch }

export async function assignMRMilestone(baseUrl, token, projectId, mrIid, milestoneId): Promise<GitLabMRDetail>;
// PUT /projects/:id/merge_requests/:iid  { milestone_id }

export async function fetchBranchMergeStatus(baseUrl, token, projectId, sourceBranch, targetBranch): Promise<{ merged: boolean }>;
// GET /projects/:id/repository/compare?from=targetBranch&to=sourceBranch — merged when `commits.length === 0`
// (release branch has zero commits not already reachable from default branch)
```

**Confirm-then-refetch (create-branch, create-milestone):** These are irreversible-ish, low-frequency, one-shot actions gated behind a `Dialog` (same `@base-ui/react/dialog` component `ReleaseDetailPage.tsx`'s edit modal already uses). No optimistic UI needed — show a loading state on the confirm button, `await` the mutation, `invalidateQueries` on success, surface the GitLab error message on failure (reuse the `jiraError`/`gitlabError` per-source-error state pattern already in `ReleaseDetailPage.tsx`'s `handleSave`).

**Optimistic + rollback (retarget MR, assign milestone):** These apply directly per-row with no confirm step, per CONTEXT.md. Follow the `createAllRows` per-row status shape from `BulkCreateSubtasksModal.tsx` — but note that pattern is a *sequential* loop for "create all," while retarget/assign are *independent per-row* actions (no "fix all" per CONTEXT.md), so each row owns its own `useMutation` (or a shared mutation keyed by MR iid) with:
- `onMutate`: optimistically flip the row's drift badge to "fixed" / patch the cached MR's `target_branch` or `milestone` in the TanStack Query cache directly (`queryClient.setQueryData`) so the row re-renders immediately — same technique as drag-to-rank/drag-to-transition's optimistic local order.
- `onError`: roll back the cache patch, surface an inline per-row error + retry button (same `RowState` shape: `idle | pending | success | error`).
- `onSettled`: `invalidateQueries` on the channel-C branch-targeting-MRs query key AND the channel-B milestone-MRs query key (a retarget can move an MR in or out of either channel's result set) — this is a **broad-prefix invalidation**, matching the existing convention (`['gitlab-milestone-mrs', activeGitlabProject]` prefix invalidation in `ReleaseDetailPage.tsx`'s `handleSave`).

**Query keys to invalidate on write:**
| Mutation | Invalidates |
|----------|-------------|
| `createBranch` | `['gitlab-branch', activeGitlabProject, releaseBranchName]` |
| `createMilestone` | `['gitlab-milestones', activeGitlabProject]` (broad prefix — same as existing) |
| `updateMRTargetBranch` | `['gitlab-branch-target-mrs', activeGitlabProject, releaseBranchName]`, `['gitlab-milestone-mrs', activeGitlabProject]` |
| `assignMRMilestone` | `['gitlab-milestone-mrs', activeGitlabProject]`, `['gitlab-branch-target-mrs', activeGitlabProject, releaseBranchName]` |

Token is never in any query key, per the established convention — read inside `queryFn`/`mutationFn` via `readSecret('gitlab-pat')`.

### Pattern 3: Branch-existence and merge-back as plain TanStack Query, not Zustand

**What:** Both are per-release, server-derived, cacheable, and need the exact same three-state (Empty/Error/Stale) degradation as everything else GitLab in this codebase. Zustand in this codebase is reserved for **client-owned, persisted** state (pinned tabs, filters, templates) — never for server-derived facts. Branch existence and merge-back status are facts *about GitLab*, not app state, so they belong in `useQuery`, exactly like `milestones`/`milestoneMRs`/`recentProjectMRs` already do in `ReleaseDetailPage.tsx`.

```typescript
// release-detail/useReleaseBranchState.ts
const { data: branch, isError: branchError } = useQuery({
  queryKey: ['gitlab-branch', activeGitlabProject, releaseBranchName],
  queryFn: () => fetchBranch(gitlabBaseUrl, gitlabToken, activeGitlabProject, releaseBranchName),
  enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && !!releaseBranchName,
  staleTime: 5 * 60_000,
});
// branch === null means "confirmed does not exist" (a valid, renderable state — NOT an error)
// branchError means "couldn't determine" (GitLab unreachable) — degrade independently

const { data: mergeStatus, isError: mergeStatusError } = useQuery({
  queryKey: ['gitlab-merge-back', activeGitlabProject, releaseBranchName, defaultBranch],
  queryFn: () => fetchBranchMergeStatus(gitlabBaseUrl, gitlabToken, activeGitlabProject, releaseBranchName, defaultBranch),
  enabled: !!defaultBranch && !!releaseBranchName && version?.released === true, // only check post-release
  staleTime: 5 * 60_000,
});
```

**Independent degradation:** This codebase's established pattern (Standup Notes' 4 independently-degrading sections, Dashboard's per-card independent loading/empty/error states, `ReleasesTab.tsx`'s separate `milestonesError` banner vs the hard Jira `ErrorState`) is: **each server-derived fact is its own query with its own `isError`, rendered as its own inline warning, never one that blanks the whole page.** `ReleaseBranchSection.tsx` should render its own `AlertTriangle` + "GitLab unreachable — branch status unknown" line when `branchError`/`mergeStatusError` is true, exactly like `ReleasesTab.tsx`'s existing `{milestonesError && <span>...GitLab unavailable</span>}` treatment — while the rest of the release detail page (Jira-sourced description, issues list) keeps rendering normally.

## Data Flow

### Three-channel discovery + drift (new)

```
ReleaseDetailPage mounts, resolves version + releaseBranchName = `release/${version.name}`
    │
    ├─ Channel A: fixVersionIssues (existing fetchFixVersionIssues, fully paginated)
    ├─ Channel B: milestoneMRs (existing fetchMilestoneMRs, fully paginated, gated on gitlabMatch)
    └─ Channel C: branchTargetingMRs (NEW fetchBranchTargetingMRs, fully paginated, gated on releaseBranchName)
                    │
                    ▼
         services/releaseFlow.ts: unionReleaseMRs(...) — pure, no I/O
                    │
                    ▼
         release-detail/ReleaseDriftSection.tsx renders drift rows
                    │
          user clicks "Retarget" or "Assign milestone" on a row
                    │
                    ▼
         useReleaseGitlabWrites.ts mutation → optimistic cache patch → GitLab PUT
                    │
              onSettled → invalidate Channel B + C query keys → re-run union → row updates
```

### Branch lifecycle (new)

```
ReleaseDetailPage mounts
    │
    ├─ fetchProjectDefaultBranch (cached, rarely changes — long staleTime candidate)
    ├─ fetchBranch(releaseBranchName) → exists? render status : render warning + "Create branch" button
    │
    └─ (confirm dialog) createBranch(releaseBranchName, ref=defaultBranch)
             │
             onSuccess → invalidate ['gitlab-branch', ...] → re-render as "exists"

Post-release (version.released === true):
    │
    └─ fetchBranchMergeStatus(from=defaultBranch, to=releaseBranchName)
             │
             merged === false → "Release unfinished — release/X not yet merged" warning persists
             merged === true  → warning clears
```

## Anti-Patterns

### Anti-Pattern 1: Reusing `fetchRecentProjectMRs` for Channel C

**What people might do:** Since `fetchRecentProjectMRs` already exists and fetches "all MRs for a project," it's tempting to reuse it for the branch-targeting channel instead of writing a new paginated fetch.
**Why it's wrong:** It is explicitly capped at 100 (`GGX-WARN-01` documents this as an intentional performance/accuracy trade for a *secondary heuristic*, "wrong milestone" hinting — not for authoritative drift detection). Using it as an authoritative channel would silently drop older release-branch MRs, which is exactly the fetch-once-page-cap pitfall this project has hit before (My Tasks, MR discussion pickers, assignee pickers — see project memory).
**Do this instead:** Write `fetchBranchTargetingMRs` with the same `while(true) per_page=100` full-pagination loop already used by `fetchMilestoneMRs`/`fetchProjectMilestones` in the same file.

### Anti-Pattern 2: Growing `ReleaseDetailPage.tsx` further instead of decomposing first

**What people might do:** Add the new branch/drift/create-milestone UI as more inline JSX inside the existing 1518-line component, the same way the file grew from its original size.
**Why it's wrong:** The file already mixes 6+ concerns (header, dual description, issues table, unmatched MRs, edit modal, sidebar) in one function component with no sub-decomposition — a stark contrast to `issue-detail/`'s 25-file decomposition for a comparable-complexity surface. Continuing to append will make the file unreviewable and untestable at the section level (note `FieldsSection.test.tsx` exists as a 659-line focused test for one 1153-line section — that granularity is impossible against a monolithic `ReleaseDetailPage.tsx`).
**Do this instead:** Extract the *existing* sections into `release-detail/` first (mechanical, low-risk, no behavior change), then add every new v1.14 section as a new sibling file in that folder from day one.

### Anti-Pattern 3: Treating "branch doesn't exist" as an error state

**What people might do:** Throw/surface `fetchBranch` 404s through the same `ErrorState`/`ApiError` path as auth failures.
**Why it's wrong:** A missing release branch is an expected, common, actionable state (the whole point of RELEASE-01/02 is to detect and offer to fix it) — treating it as an error would trigger the app's `ErrorState` full-page treatment or a `StaleDataBanner`, both wrong UX for "here's a warning with a button to fix it."
**Do this instead:** `fetchBranch` returns `null` on 404 (not a thrown error); only network failures / 401/403 go through `ApiError`. The section renders three states: loading / exists / missing-with-create-button, and a *separate* `isError` flag for "couldn't determine" (GitLab unreachable).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitLab REST v4 | `apiFetch('gitlab', url, opts, label)` via `tauri-plugin-http`, `PRIVATE-TOKEN` header | All new endpoints (`repository/branches`, `repository/compare`, milestone POST, MR PUT) are documented, standard GitLab API — no probe-gated unknowns like AIO had |
| Jira REST v2 | Unchanged — no new Jira write surface in v1.14; `fetchFixVersionIssues`/`fetchFixVersions` reused as-is | Channel A source only |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `releaseFlow.ts` ↔ `gitlab.ts`/`jira.ts` | One-directional: `release-detail/` hooks call the fetch functions, pass plain-object results into `releaseFlow.ts`'s pure functions | Mirrors `releaseLinker.ts`'s existing boundary — never let the pure module import `apiFetch`/`fetch` |
| `release-detail/*.tsx` sections ↔ `ReleaseDetailPage.tsx` orchestrator | Props only — no `createContext`/`useContext` anywhere in this codebase (explicit decision, see PROJECT.md Key Decisions: "Prop threading for onIssueClick (not React context)") | The orchestrator owns all `useQuery`/`useMutation` calls and passes data + callbacks down, same as `issue-detail/index.ts` does today |
| `ReleaseDriftSection.tsx` mutations ↔ TanStack Query cache | `queryClient.setQueryData` for optimistic patch, `invalidateQueries` broad-prefix on settle | No React Compiler manual memo anywhere — do not add `useMemo`/`useCallback`/`React.memo` to any new component |
| `MetaRow` reuse | `issue-detail/MetaRow.tsx` (8 LOC) is already generic (`label` + `children`) but `ReleaseDetailPage.tsx` currently defines its own **local** `MetaRow` at the bottom of the file (duplicate, not shared) | When decomposing, either import the existing `issue-detail/MetaRow.tsx` directly (cross-folder import — check no other coupling implied) or keep a `release-detail/MetaRow.tsx` duplicate; either is consistent with current codebase style (some duplication already exists between `ReleasesTab.tsx` and `ReleaseDetailPage.tsx`'s own `fetchVersionIssueCounts`, which the file's own comment calls out as "duplicated... to keep self-contained") |

## Build Order

Ordered by dependency; items marked **[shippable]** can go out as their own phase/PR without the later items existing.

1. **Decompose `ReleaseDetailPage.tsx` into `release-detail/`** (mechanical extraction of existing sections: header, description, issues table, unmatched-MRs, sidebar, edit dialog — zero new behavior). **[shippable]** — do this first so every subsequent addition lands in the new structure, not the monolith. Low risk: existing tests (if any cover this page) should pass unchanged since it's pure extraction.

2. **Branch existence (read-only)**: `fetchProjectDefaultBranch`, `fetchBranch` in `gitlab.ts`; `ReleaseBranchSection.tsx` rendering exists/missing/unknown; release-level warning surfaced on `ReleasesTab.tsx` rows too (small addition there). **[shippable]** — delivers RELEASE-01 (branch existence + warning) alone, no writes yet.

3. **Create branch (write, confirm-gated)**: `createBranch` in `gitlab.ts`; `CreateBranchDialog.tsx`; wired into `ReleaseBranchSection.tsx`. Depends on (2) for the "missing" trigger state. **[shippable]** — delivers RELEASE-02.

4. **Three-channel MR discovery + drift (read-only)**: new `fetchBranchTargetingMRs` in `gitlab.ts`; `services/releaseFlow.ts` pure module + its unit tests; `ReleaseDriftSection.tsx` rendering the union/drift table. Depends on (2) for `releaseBranchName` resolution (branch doesn't need to exist yet — the query for Channel C simply returns empty if the branch has no targeting MRs). Can build in parallel with (3). **[shippable]** — delivers RELEASE-03/04 as a read-only drift report before any corrective-action UI exists.

5. **Per-MR corrective actions (write, optimistic)**: `updateMRTargetBranch`, `assignMRMilestone` in `gitlab.ts`; `useReleaseGitlabWrites.ts` mutations with optimistic+rollback; per-row status UI in `ReleaseDriftSection.tsx`. Hard dependency on (4) — needs the drift rows to act on. **[shippable]** — delivers RELEASE-05.

6. **Create milestone (write, confirm-gated)**: `createMilestone` in `gitlab.ts`; `CreateMilestoneDialog.tsx` (latest-milestones list for reference + name input). Independent of (4)/(5) — only needs the existing `matchGitLabToFixVersion`/`gitlabMatch.type === 'none'` state that already exists in `ReleaseDetailPage.tsx` today. Could ship as early as after (1), in parallel with (2)-(5). **[shippable]** — delivers RELEASE-06.

7. **Post-release merge-back check**: `fetchBranchMergeStatus` in `gitlab.ts`; extend `ReleaseBranchSection.tsx` (or a small dedicated sub-section) to check `version.released === true` and render the unfinished-release warning. Depends on (2) for `defaultBranch`/`releaseBranchName`. Logically last since it only activates for already-released versions, but has no hard code dependency on (3)-(6) — could ship right after (2) if desired. **[shippable]** — delivers RELEASE-07.

**Recommended phase grouping:** `[1]` (refactor phase, no user-visible change) → `[2, 6]` (parallel — both are independent read/write additions with no shared new module) → `[3, 4]` (parallel — branch creation and drift discovery are independent) → `[5]` (depends on 4) → `[7]` (can slot in anywhere after 2, but naturally closes the milestone as the "verify the loop closed" feature).

## Sources

- `taskflow/src/services/gitlab.ts` (read in full, 1737 lines) — auth header, error-handling, pagination-loop conventions for every existing endpoint
- `taskflow/src/services/releaseLinker.ts` (read in full, 80 lines) — the pure-module pattern to emulate
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` (read in full, 1518 lines) — current monolith structure, exact line ranges for extraction targets
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` (read in full, 480 lines) — list-view conventions, `milestonesError` independent-degradation precedent
- `taskflow/src/routes/dashboard/issue-detail/` (directory listing + `FieldsSection.tsx`/hooks inspected) — the established decomposition precedent for a comparable-complexity detail page
- `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx` (`createAllRows`, read in part) — per-row status/retry pattern source
- `taskflow/src/routes/dashboard/StatusPopover.tsx` (read in part) — confirms optimistic mutations live in the mutation-owning component, not the trigger
- `.planning/PROJECT.md` — v1.14 milestone goal, target features, Key Decisions table (React Compiler, prop threading not context, per-source partial-failure save pattern)
- GitLab REST API v4 reference (branches, repository/compare, milestones, merge_requests) — training-data knowledge of standard, stable GitLab endpoints; not independently re-verified against live docs in this pass (MEDIUM confidence on exact endpoint paths/params, though these are long-stable GitLab API surfaces unlikely to have changed)

---
*Architecture research for: Taskflow v1.14 Release Management*
*Researched: 2026-08-10*
