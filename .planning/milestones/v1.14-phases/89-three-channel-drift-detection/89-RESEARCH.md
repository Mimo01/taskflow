# Phase 89: Three-Channel Drift Detection - Research

**Researched:** 2026-08-10
**Domain:** GitLab REST API MR discovery/reconciliation, TanStack Query multi-source derived state, React presentational list rendering (Tauri webview)
**Confidence:** HIGH (codebase patterns, GitLab API shapes, existing pagination helpers) / MEDIUM (Channel C >100-MR completeness — probe required, script provided but not yet run against live data)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (user):** The reconciled union lives in a new MR-first section on the release detail page, below the existing Issues table. The Issues table's structure and interactions are not rewritten.
- **D-02 (user):** `UnmatchedMRsSection.tsx` is absorbed into the new section, not kept beside it. Its row markup (`!iid` button, Jira-key linkification via `extractTicketKeys`, `CachedAvatar`, state badge) is the starting point. Accepted consequence: an MR that matches a fix-version issue appears in both tables.
- **D-03 (user):** The list is flat, drift-first — flagged MRs sorted to the top, clean MRs below. No state group headers. Ordering within each partition is the planner's call; make it deterministic.
- **D-04 (user, hard constraint):** The section must be compact and easily readable. Governs every rendering decision and outranks completeness of information.
- **D-05 (user):** Channel A replaces GGX-WARN-01. `fetchRecentProjectMRs` and `buildWrongMilestoneMap` are deleted; the Issues table's MR / "Wrong milestone" / "Missing MR" cell is re-sourced from the three-channel union.
- **D-06 (Claude's discretion, locked):** The Issues table's MR cell keeps its current visual treatment (`IssuesSection.tsx:136-216`). Only the data source changes.
- **D-07 (user):** Drift renders as three fixed status columns — BR / MS / TASK — each showing ✓, ⚠, or — on every row.
- **D-08 (user):** The row carries `!iid` · Jira key · title · author avatar · state badge · BR/MS/TASK.
- **D-09 (user):** Channel provenance (A/B/C) is not a visible row element — lives in the data model, exposed only in a tooltip.
- **D-10 (user, supersedes DRIFT-08's literal reading):** Merged and closed MRs are shown (muted) but never evaluated — all three columns render —. Draft MRs are treated as open: fully evaluated and counted. Do not "correct" this back toward the requirement text.
- **D-11 (user):** An MR with no parseable Jira key is flagged in the TASK column. Accepted consequence: the drift count carries a permanent floor of untraceable MRs for which Phase 90 offers no corrective action. Do not invent one, do not silently exempt keyless MRs.
- **D-12 (Claude's discretion, locked):** The TASK predicate is two-part — no extractable Jira key OR extracted key absent from the fix version's issue set. Both render ⚠; tooltip distinguishes them.
- **D-13 (user):** The aggregate number counts MRs with ≥1 flag, not total flags.
- **D-14 (user):** The Releases-list row count covers branch + milestone drift only (not task) — derived from ONE fully-paginated `state=opened` project-wide MR fetch regardless of row count (P88 D-18 fetch-once pattern). The detail-page count may legitimately exceed the row count; tooltip must explain the discrepancy.
- **D-15 (Claude's discretion, locked):** The row drift count sits beside the existing P88 branch/milestone icons in `ReleasesTab.tsx` (reserved slot at L558-561).
- **D-16 (user):** Detail-page channel queries run eagerly on mount, as their own scoped queries (staleTime 5min, gcTime Infinity). Chosen over routing through the shared project-wide open-MR fetch. Do not make drift lazy or click-to-load.
- **D-17 (locked, from P88 D-18):** Every channel fetch is fully paginated with no page cap. Channel C (`?target_branch=<release branch>`) must loop until a short page.
- **D-18 (Claude's discretion, locked):** With no matched milestone, the section renders Channel A results only, BR/MS as —, with a one-line reason above the table.
- **D-19 (locked, from P87/P88):** New data goes in `release-detail/useReleaseDetail.ts`; sections stay presentational/props-driven; the union + predicates + count go in a React-free module with unit tests; new GitLab calls go through `apiFetch('gitlab', ...)`, never raw `fetch`.
- **D-20 (Claude's discretion, locked, layout — binding not discretionary):** No `<table>` for the MR list. Use `div` + flex rows with `flex-none` explicit-px cells (`!iid`, key, avatar, state badge, BR/MS/TASK columns) and `flex-1 min-w-0` on the title.

D-01 through D-16 (excluding the discretion items) are user decisions and are hard. D-10 and D-11 override the literal text of DRIFT-08 and the natural reading of DRIFT-07 — do not "fix" the code back toward requirement wording.

### Claude's Discretion

D-06, D-12, D-15, D-18, D-20 were delegated or not opined on by the user and are Claude's recorded calls — locked for downstream agents, not open questions to re-ask. The planner may adjust implementation detail where evidence contradicts a call, but must record the deviation.

### Deferred Ideas (OUT OF SCOPE)

- Per-MR corrective actions (retarget, assign milestone) — Phase 90. D-07's status columns exist partly to give those actions an anchor; keep them extensible.
- A corrective action for keyless MRs — D-11 flags them with nothing to do about them; not this phase's problem.
- Making the detail page reuse the project-wide open-MR fetch — presented and declined (D-16).
- Fixing DRIFT-08's wording in REQUIREMENTS.md (draft is now evaluated, not excluded) — doc-only, not code, not done here.
- Virtualizing the MR list — not discussed; flex rows are the safer default given the known 0-width-column defect in the absolute-row table.
- Any corrective write (retarget, assign-milestone), merge-back verification, branch/milestone creation, permission gating, and changes to the Issues table's layout/interactions beyond re-sourcing its MR cell are all explicitly out of this phase's scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRIFT-01 | Channel A — MRs discovered via Jira issue keys of the fix version's issues | Pattern 2 (local match over full-universe fetch), `fetchAllProjectMRs` + `linkMRToTask` reuse |
| DRIFT-02 | Channel B — MRs discovered via the GitLab milestone | Existing `fetchMilestoneMRs` (`gitlab.ts:1434`) reused as-is, already fully paginated |
| DRIFT-03 | Channel C — MRs discovered via target branch = release branch, fully paginated | Pattern 1 + new `fetchBranchTargetedMRs`; probe script verifies live completeness |
| DRIFT-04 | Three channels union into one MR set retaining per-channel provenance | Pattern 3 (`unionMRs` — `Map<id, {mr, channels}>`) |
| DRIFT-05 | MR flagged when target branch ≠ release branch | Pattern 4 (`evaluateBranchDrift`) |
| DRIFT-06 | MR flagged when release milestone not assigned | Pattern 4 (`evaluateMilestoneDrift`), Pitfall 1 (milestone shape) |
| DRIFT-07 | MR flagged when Jira task not in fix version | Pattern 4 (`evaluateTaskDrift`), D-11/D-12 two-part predicate |
| DRIFT-08 | Merged/closed/draft classified so they do not pollute drift counts | D-10 override (drafts evaluated, not excluded) — Pitfall 2, Pitfall 3 (`locked` state) |
| DRIFT-09 | Release row shows an aggregate drift count | Pattern 5 (`computeRowDriftCount`), D-14/D-15 |
</phase_requirements>

## Summary

This phase is almost entirely a data-layer problem, not a new-technology problem. Every piece of infrastructure it needs already exists in the codebase in a slightly wrong shape: `fetchMilestoneMRs` is the exact fully-paginated pattern Channel C needs (just swap the query param), `linkMRToTask`/`extractTicketKeys` already do Jira-key matching, and `useReleaseDetail.ts` already resolves every input (`matchedMilestone`, `releaseBranchName`, `fixVersionIssues`, `gitlabToken`, `activeGitlabProject`) the three channels consume. The actual work is: (1) add two new fully-paginated GitLab fetchers (`fetchAllProjectMRs` for Channel A's local-match universe, `fetchBranchTargetedMRs` for Channel C), (2) widen the `GitLabMR` interface with `target_branch` and `draft` (GitLab already returns both on the list endpoint — the interface just never declared them), (3) write a pure, React-free reconciliation module that unions three MR arrays into one map keyed by MR id, carries per-MR channel provenance, and evaluates the three drift predicates, and (4) wire a new presentational section that consumes that pure module's output plus D-07's fixed BR/MS/TASK columns.

The single riskiest technical claim in this phase is completeness of Channel C's pagination — GitLab's REST list endpoint uses classic offset pagination (`page`/`per_page`), which is well-understood and already used correctly elsewhere in this codebase (`fetchMilestoneMRs`, `fetchProjectBranches`), so the *mechanism* is HIGH confidence. What's unverified is whether the team's actual release branches have ever exceeded the `per_page=100` single-page boundary that the deleted `fetchRecentProjectMRs` silently mishandled — this is exactly the roadmap's mandated probe, and a ready-to-run script is provided below (same pattern as Phase 88's `probe.sh`, targeting the same known-live instance `git.devel.sun.orange.sk` project `455`).

**Primary recommendation:** Add `fetchAllProjectMRs(baseUrl, token, projectId, state)` and `fetchBranchTargetedMRs(baseUrl, token, projectId, targetBranch, state)` to `services/gitlab.ts`, modeled byte-for-byte on `fetchMilestoneMRs`'s `while(true)` pagination loop (including its label-color enrichment pass). Widen `GitLabMR` with `target_branch: string` and `draft: boolean`. Write a new pure module (`release-detail/driftDetection.ts`, sibling to `releaseSummaries.ts` and `releaseBranch.ts`) exporting a union-and-provenance function and three predicate functions, fully unit tested. Wire three new `useQuery` calls into `useReleaseDetail.ts` matching the existing 6-query shape (own scoped queries per D-16), and build a new `MrDriftSection.tsx` that replaces `UnmatchedMRsSection` per D-02, consuming D-20's flex-row layout contract from `89-UI-SPEC.md`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Channel A/B/C GitLab MR fetches | API/Backend integration layer (`services/gitlab.ts`) | — | All GitLab calls are outbound REST calls from the Tauri app itself (no server tier in this app); `gitlab.ts` is the established boundary for every GitLab HTTP call |
| Three-channel union + provenance | Frontend Server/pure logic layer (`release-detail/*.ts`) | — | Pure, React-free, unit-tested module per P87 D-09/P88 D-12 convention — no I/O, no hooks |
| Drift predicate evaluation (BR/MS/TASK) | Frontend Server/pure logic layer | — | Same pure module; predicates are deterministic functions over already-fetched data |
| Query orchestration + caching | Frontend Server (`useReleaseDetail.ts` hook) | — | Single data-layer hook per P87 D-07; owns all TanStack Query state for the release detail page |
| MR-first section rendering | Browser/Client (React components) | — | `MrDriftSection.tsx` (new) + re-sourced `IssuesSection.tsx` MR cell — presentational, props-driven per P87 D-08 |
| Releases-list aggregate drift count | Browser/Client (`ReleasesTab.tsx`) | Frontend Server (derivation logic) | Rendering lives in the list row; the branch+milestone-only count derivation (D-14) is a pure computation over one project-wide fetch, ideally extracted to a testable function rather than inlined in the component |
| GitLab data persistence/caching | Database/Storage (TanStack Query cache) | — | No app-owned database in this phase — TanStack Query's in-memory cache (`gcTime: Infinity`, `staleTime: 5min`) is the only persistence layer, per v1.7 stale-while-revalidate convention |

## Standard Stack

### Core

No new libraries. This phase extends existing project infrastructure exclusively.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | (already installed — see `package.json`) | Query orchestration, caching, invalidation | Already the app's exclusive data-fetching layer; every existing GitLab/Jira call goes through it |
| `vitest` | (already installed) | Unit tests for the new pure module | Established test runner (`npm run test` = `vitest run`); `releaseSummaries.test.ts`/`releaseBranch.test.ts` are the direct precedent to follow |

### Supporting

None required — `lucide-react` icons (`AlertTriangle`, `GitMerge`) and `Badge`/`CachedAvatar` primitives are already imported project-wide and reused per the UI-SPEC.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local `linkMRToTask` matching for Channel A | GitLab's `/search?scope=merge_requests` endpoint per Jira key | Already exists in the codebase as `searchGitLabMRs`, but it is capped at `per_page=20`, hardcodes `state=opened` (would silently exclude merged/closed MRs Channel A needs to classify), and requires N requests (one per Jira key) instead of one fully-paginated project-wide fetch. Rejected — D-17's "no page cap" constraint and the fetch-once philosophy (D-14, GGX-WARN-01 precedent) both point at one full local-match fetch instead. |
| Offset pagination (`page`/`per_page`) | Keyset pagination (`pagination=keyset`) | GitLab recommends keyset for very large collections (soft ceiling around a 50,000-record offset) `[CITED: docs.gitlab.com/development/database/keyset_pagination]`. Every existing paginated fetcher in this codebase (`fetchMilestoneMRs`, `fetchProjectBranches`) uses offset pagination and none has hit that ceiling. A single release branch or milestone realistically carrying 50,000 MRs is not a plausible failure mode for this team — offset pagination is the correct choice for consistency with existing code, not a compromise. |

**Installation:** None — no new packages.

## Package Legitimacy Audit

Not applicable — this phase installs no new packages.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  useReleaseDetail.ts (single data-layer hook)                        │
│                                                                        │
│  matchedMilestone ──┐                                                │
│  releaseBranchName ─┼──► [existing: fixVersionIssues, gitlabToken]   │
│                      │                                                │
│  ┌───────────────────┴──────────────┐                                │
│  │ Channel A query                  │  GET /merge_requests?state=all │
│  │ fetchAllProjectMRs(project)      │  (fully paginated, ALL states) │
│  └───────────────┬───────────────────┘                                │
│  ┌───────────────┴───────────────────┐                                │
│  │ Channel B query (existing pattern)│  GET .../merge_requests        │
│  │ fetchMilestoneMRs(milestone.title)│    ?milestone=<title>&state=all│
│  └───────────────┬───────────────────┘                                │
│  ┌───────────────┴───────────────────┐                                │
│  │ Channel C query (new)             │  GET .../merge_requests        │
│  │ fetchBranchTargetedMRs(branchName)│    ?target_branch=<br>&state=all│
│  └───────────────┬───────────────────┘                                │
│                   ▼                                                   │
│         driftDetection.ts (pure, React-free)                          │
│         ┌─────────────────────────────────────────┐                   │
│         │ 1. unionMRs(A, B, C) → Map<mrId, {       │                   │
│         │      mr, channels: Set<'A'|'B'|'C'> }>   │                   │
│         │ 2. for each MR (open/draft only):        │                   │
│         │    evaluateBranchDrift(mr, releaseBranch) │                  │
│         │    evaluateMilestoneDrift(mr, milestone)  │                  │
│         │    evaluateTaskDrift(mr, fixVersionIssues) │                 │
│         │ 3. sortDriftFirst(rows)                   │                  │
│         │ 4. countFlaggedMRs(rows) — D-13            │                  │
│         └─────────────────┬───────────────────────┘                   │
└─────────────────────────────┼─────────────────────────────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │ MrDriftSection.tsx (new)       │  ← replaces
              │ (below IssuesSection's table)  │    UnmatchedMRsSection
              └───────────────┬───────────────┘
                              │ MR cell re-sourced (D-05/D-06)
              ┌───────────────▼───────────────┐
              │ IssuesSection.tsx L136-216     │  ← same visuals,
              │ (unchanged visual treatment)   │    new data source
              └────────────────────────────────┘

  Separately, on the Releases LIST page (ReleasesTab.tsx):
  ┌────────────────────────────────────┐
  │ ONE project-wide open-MR fetch      │  GET .../merge_requests
  │ (state=opened, fully paginated)     │    ?state=opened
  └───────────────┬──────────────────────┘
                  ▼
     per-row: filter to MRs matching THIS row's
     milestone.id or target_branch, evaluate BR+MS
     only (no TASK — Jira issues not loaded on list page)
                  ▼
     {n} drift badge beside existing branch/milestone icons (D-15)
```

### Recommended Project Structure

No new folders — this phase adds files to the existing `release-detail/` folder established in Phase 87.

```
taskflow/src/routes/dashboard/release-detail/
├── useReleaseDetail.ts        # extend: +3 queries (Channel A/B/C), +union call
├── driftDetection.ts          # NEW — pure union + predicates + count (React-free, unit tested)
├── driftDetection.test.ts     # NEW — unit tests, styled after releaseSummaries.test.ts
├── MrDriftSection.tsx         # NEW — presentational, replaces UnmatchedMRsSection
├── UnmatchedMRsSection.tsx    # DELETE — absorbed into MrDriftSection.tsx (D-02)
├── IssuesSection.tsx          # MODIFY — MR cell (L136-216) re-sourced from union; L224 rewired
├── releaseSummaries.ts        # MODIFY — delete buildWrongMilestoneMap (D-05); keep matchIssuesToMRs
└── releaseBranch.ts           # unchanged — releaseBranchName already exported by useReleaseDetail

taskflow/src/services/
└── gitlab.ts                  # MODIFY — GitLabMR +target_branch +draft; +fetchAllProjectMRs;
                                #          +fetchBranchTargetedMRs; DELETE fetchRecentProjectMRs

taskflow/src/routes/dashboard/
└── ReleasesTab.tsx            # MODIFY — +1 project-wide open-MR query, +D-15 indicator slot fill
```

### Pattern 1: Fully-paginated GitLab MR fetch (Channel C model)

**What:** Loop `page`, accumulate results, break when the returned page is shorter than `per_page` — never trust a single page or a `limit` parameter.
**When to use:** Any GitLab list endpoint call in this codebase, always. This is the established, correct pattern; `fetchProjectMRs` (single page) and the now-deleted `fetchRecentProjectMRs` (single page, "limit" param) are the anti-pattern this phase exists to stop propagating.
**Example (existing code — `fetchMilestoneMRs`, `gitlab.ts:1434`):**
```typescript
// Source: taskflow/src/services/gitlab.ts:1434 (existing, verified in this session)
const perPage = 100;
let page = 1;
const allMRs: GitLabMR[] = [];

while (true) {
  const url = `${base}/api/v4/projects/${projectId}/merge_requests?milestone=${encodeURIComponent(milestoneTitle)}&state=all&per_page=${perPage}&page=${page}`;
  const response = await apiFetch('gitlab', url, { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } }, 'Load Milestone MRs');
  if (!response.ok) { /* ...401/403 -> ApiError, else generic throw... */ }
  const data = (await response.json()) as GitLabMR[];
  allMRs.push(...data);
  if (data.length < perPage) break;
  page++;
}
```
**Channel C is this exact loop with `?target_branch=${encodeURIComponent(targetBranch)}` in place of `?milestone=...`.** `[VERIFIED: codebase — gitlab.ts:1434-1440]` `[CITED: docs.gitlab.com/api/merge_requests — target_branch is a documented filter parameter on GET /projects/:id/merge_requests]`

### Pattern 2: Channel A — local match over a full-universe fetch (not per-key search)

**What:** Fetch every MR in the project once (`state=all`, fully paginated — this is functionally `fetchRecentProjectMRs` uncapped), then run `linkMRToTask(mr, fixVersionIssueKeySet)` locally against each MR's title/branch, exactly as `matchIssuesToMRs` already does for the milestone-scoped list.
**When to use:** Channel A specifically. This mirrors the deleted GGX-WARN-01 heuristic's *mechanism* (one bulk list call + local match, because GitLab's list endpoint is far faster than its search endpoint) while removing its page cap — the literal bug this phase's probe exists to catch.
**Example (existing code to reuse as-is — `linkMRToTask`, `linkEngine.ts:73`):**
```typescript
// Source: taskflow/src/services/linkEngine.ts:73 (existing, verified in this session)
export function linkMRToTask(mr: GitLabMR, sprintIssueKeys: Set<string>): string | null {
  const titleKeys = extractTicketKeys(mr.title);
  const titleMatch = titleKeys.find((k) => sprintIssueKeys.has(k));
  if (titleMatch !== undefined) return titleMatch;
  const branchKeys = extractTicketKeys(mr.source_branch);
  return branchKeys.find((k) => sprintIssueKeys.has(k)) ?? null;
}
```
Channel A's new code is: `const fixVersionKeySet = new Set(fixVersionIssues.map(i => i.key)); const channelA = allProjectMRs.filter(mr => linkMRToTask(mr, fixVersionKeySet) !== null);` — no new key-extraction logic needed.

### Pattern 3: Union with provenance (new — the core deliverable)

**What:** Combine three `GitLabMR[]` arrays into one `Map<number, { mr: GitLabMR; channels: Set<'A' | 'B' | 'C'> }>` keyed by the MR's stable numeric `id` (not `iid` — `iid` is only unique per-project, and this codebase's MRs are always same-project per the "no fork handling" out-of-scope decision, but `id` is the GitLab-global identifier and is the safer key even so).
**When to use:** Once per detail-page render, in `driftDetection.ts`.
**Example (new code, illustrative):**
```typescript
// New: release-detail/driftDetection.ts
export type Channel = 'A' | 'B' | 'C';

export function unionMRs(
  channelA: GitLabMR[],
  channelB: GitLabMR[],
  channelC: GitLabMR[],
): Map<number, { mr: GitLabMR; channels: Set<Channel> }> {
  const union = new Map<number, { mr: GitLabMR; channels: Set<Channel> }>();
  const add = (mrs: GitLabMR[], channel: Channel) => {
    for (const mr of mrs) {
      const existing = union.get(mr.id);
      if (existing) existing.channels.add(channel);
      else union.set(mr.id, { mr, channels: new Set([channel]) });
    }
  };
  add(channelA, 'A');
  add(channelB, 'B');
  add(channelC, 'C');
  return union;
}
```

### Pattern 4: Drift predicates (D-10/D-11/D-12 aware)

**What:** Three independent predicate functions, each evaluated only for MRs whose `state === 'opened'` (drafts included per D-10 — GitLab's `state` field for a draft MR is still `'opened'`, `draft: true` is a separate boolean field, so no extra branching is needed to satisfy "drafts are treated as open"). Merged/closed MRs render `—` for all three columns without calling these functions at all.
**When to use:** Per MR row, in `driftDetection.ts`.
**Example (new code, illustrative):**
```typescript
export function evaluateBranchDrift(mr: GitLabMR, releaseBranchName: string | null): boolean {
  if (!releaseBranchName) return false; // D-18 degraded state — BR renders — upstream, not a flag
  return mr.target_branch !== releaseBranchName;
}

export function evaluateMilestoneDrift(
  mr: GitLabMR,
  matchedMilestone: { id: number } | null,
): boolean {
  if (!matchedMilestone) return false; // D-18 degraded state
  return mr.milestone === null || mr.milestone.id !== matchedMilestone.id;
}

export type TaskDriftReason = 'no-linked-task' | 'not-in-fix-version' | null;

export function evaluateTaskDrift(
  mr: GitLabMR,
  fixVersionIssueKeys: Set<string>,
): TaskDriftReason {
  const keys = [...extractTicketKeys(mr.title), ...extractTicketKeys(mr.source_branch)];
  if (keys.length === 0) return 'no-linked-task'; // D-11
  const matched = keys.some((k) => fixVersionIssueKeys.has(k));
  return matched ? null : 'not-in-fix-version'; // D-12's two-part predicate
}
```
Note: `evaluateTaskDrift` deliberately checks *all* extracted keys against the fix-version set (not just the first, and not `linkMRToTask`'s "first key present in a specific set" behavior) — D-11/D-12 need to know whether *any* key traces to this release, not the single best match `linkMRToTask` returns for Channel A's discovery purpose. These are two different questions asked of the same `extractTicketKeys` primitive; do not conflate them into one function.

### Pattern 5: Fully-paginated project-wide open-MR fetch for the Releases-list count (D-14)

**What:** One `state=opened`, fully-paginated, project-wide MR fetch (same pagination loop as Pattern 1) run once on the Releases list page, then filtered per row by `milestone.id === row.matchedMilestoneId` OR `target_branch === row.releaseBranchName` to approximate Channels B/C at list scale (Channel A is intentionally excluded here per D-14 — no per-row Jira fetch).
**When to use:** `ReleasesTab.tsx`, replacing/extending the existing `releaseBranches` query pattern already at L190-207.
**Example:** Model this fetch on `fetchProjectBranches` (`gitlab.ts:284`) or the new `fetchAllProjectMRs`, called with `state='opened'` and no target_branch/milestone filter (project-wide), then derive counts with a new pure function (recommend `computeRowDriftCount(mrs, releaseBranchName, matchedMilestoneId): number` in `driftDetection.ts`, callable from both the detail page's row-scale reasoning and `ReleasesTab.tsx`, to avoid duplicating the BR/MS predicate logic across two files).

### Anti-Patterns to Avoid

- **Reusing `fetchProjectMRs` or the deleted `fetchRecentProjectMRs` for any channel:** both are single-page (`page=1` only, no loop). This is the specific bug class (GGX-WARN-01) the roadmap probe exists to catch — never fetch one page and filter client-side believing it's complete.
- **Combining Channel A's discovery match (`linkMRToTask`, first-match) with the TASK drift predicate (`evaluateTaskDrift`, any-match):** they answer different questions over the same MR (see Pattern 4 note) — do not collapse them into one function to "save code."
- **Evaluating drift predicates on merged/closed MRs:** D-10 requires `—` for these rows, not a real (even if trivially-false) evaluation. Gate the predicate calls on `mr.state === 'opened'`, don't call-and-discard.
- **Using `<table>` for the new MR list:** D-20 is binding — a `<table>` synchronizes column widths across rows and reproduces the documented `feedback_table_vs_flex_rows` failure mode already logged for this codebase. Use `div` + flex rows with explicit px widths on narrow cells (see UI-SPEC Layout Contract).
- **Wrapping `statusPillClass` output in a bare `<span>`:** documented codebase gotcha (`project_statuspill_needs_flex_parent`) — not directly relevant here since MR state badges use `Badge variant="outline"` per the UI-SPEC, not `statusPillClass`, but flag it if any future variant borrows the Jira pill styling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Jira key extraction from MR title/branch | A new regex parser | `extractTicketKeys` (`linkEngine.ts:41`) | Already handles dash- and space-separated keys, case normalization, dedup, and position-ordering; two regexes tuned against real title/branch conventions in this codebase |
| Paginated GitLab list fetch | A new pagination helper from scratch | Copy `fetchMilestoneMRs`'s `while(true)` loop shape | Byte-identical pattern already proven correct (and already the fix for the exact bug class this phase targets) — reinventing it risks a subtly different (and wrong) break condition |
| GitLab API error handling (401/403/timeout) | Custom per-fetcher error branching | `apiFetch('gitlab', ...)` + the existing `ApiError`/generic-throw split every other `gitlab.ts` function uses | 15s timeout, disconnect-marking on 401, redacted devtools instrumentation all come free; a raw `fetch` bypass is a defect per `CLAUDE.md`-equivalent codebase convention (D-19) |
| Row ordering / sort stability | A custom multi-key sort | `Array.prototype.sort` with a deterministic comparator (e.g. `!iid` descending as UI-SPEC recommends) | This is genuinely simple — no library needed, just document the comparator in `driftDetection.ts` so it's testable |

**Key insight:** Every "hard part" of this phase (pagination completeness, Jira-key matching, GitLab error handling) is a solved problem already living in this codebase under a different filter parameter. The actual net-new logic is small: the union-with-provenance map and the three predicate functions. Resist the urge to build a generic "reconciliation engine" — three small pure functions plus a Map are sufficient and match the codebase's existing pure-module granularity (`releaseSummaries.ts`, `releaseBranch.ts`).

## Common Pitfalls

### Pitfall 1: Treating `GitLabMR.milestone` and `GitLabMilestone` as the same shape

**What goes wrong:** `GitLabMR.milestone` is `{ id: number; title: string } | null` — a narrow subset, NOT the full `GitLabMilestone` interface (`gitlab.ts:389`, which has `due_date`, `state`, `web_url`, etc.). Code that tries to read `mr.milestone.due_date` will compile-fail or read `undefined` depending on typing strictness.
**Why it happens:** Both interfaces are named similarly and both represent "a milestone," but GitLab's MR list endpoint embeds a slimmer object than the milestones list endpoint returns.
**How to avoid:** The MS predicate only needs `id` comparison (`mr.milestone?.id !== matchedMilestone.id`) — never destructure beyond what `GitLabMR['milestone']` actually declares.
**Warning signs:** TypeScript errors on `mr.milestone.due_date` or similar; if none surface, it means nobody tried yet, not that it's safe.

### Pitfall 2: `state === 'opened'` does not exclude drafts

**What goes wrong:** A naive `mr.state === 'opened' ? evaluate() : muted()` correctly implements D-10 (drafts ARE evaluated, since GitLab's `state` for a draft MR is `'opened'`) — but a developer who read requirement text DRIFT-08 literally ("draft excluded") might add an explicit `if (mr.draft) return muted` guard, which silently reverts D-10's override.
**Why it happens:** DRIFT-08's literal wording conflicts with D-10's locked override; both are "correct" readings of different documents, but D-10 wins per CONTEXT.md.
**How to avoid:** Do NOT add a `draft` check to the muting/evaluation gate. The gate is exactly `mr.state === 'opened' || mr.state === 'closed' /* wait — closed excludes too */` — more precisely: `const isEvaluated = mr.state === 'opened';` (covers open AND draft, since GitLab does not have a separate `'draft'` state value) `const isMuted = mr.state === 'merged' || mr.state === 'closed';`. Add a code comment citing D-10 at this exact branch so a future refactor doesn't "fix" it back.
**Warning signs:** A test asserting a draft MR renders `—` in all three columns should FAIL if D-10 is correctly implemented — if such a test exists and passes, the implementation has reverted to DRIFT-08's literal text.

### Pitfall 3: GitLab's `locked` MR state falling through undetected

**What goes wrong:** `GitLabMR.state` is typed as `'opened' | 'closed' | 'merged' | 'locked'` — a fourth value (`locked`, meaning merge is in progress / temporarily locked) that this phase's design (D-10: "merged, closed, muted"; open+draft: "evaluated") doesn't explicitly place.
**Why it happens:** `locked` is rare (transient, during merge processing) and easy to overlook since neither CONTEXT.md nor the requirements mention it by name.
**How to avoid:** Treat `locked` as muted (same bucket as merged/closed) — it is not an actionable "open" state a user would retarget or re-milestone while GitLab is actively merging it, and grouping it with open would let a transient state falsely count toward drift for a few seconds during every merge. Recommend: `const isEvaluated = mr.state === 'opened';` naturally already excludes `locked` (since `'opened' !== 'locked'`) — just confirm the muted-rendering branch's `else` doesn't crash on a value it didn't anticipate. `[ASSUMED — this specific classification of 'locked' was not discussed with the user; flag to planner as a discretionary micro-decision, not a locked one.]`

### Pitfall 4: `fetchAllProjectMRs` (Channel A) is expensive on large projects and must not be re-fetched per release

**What goes wrong:** If Channel A's fully-paginated `state=all` fetch is keyed per-version (e.g. `['gitlab-all-mrs', activeGitlabProject, versionId]`), every release detail page visit re-runs the full project-wide fetch, even though the underlying data (all MRs) doesn't depend on which version is open.
**Why it happens:** Copy-pasting the query-key shape from `milestoneMRs`/`branchResult` (which correctly ARE scoped per-version/per-branch) without noticing Channel A's fetch itself is NOT version-scoped — only the *filter applied after* the fetch is.
**How to avoid:** Key Channel A's query as `['gitlab-all-project-mrs', activeGitlabProject]` (project-scoped only, no `versionId`), matching D-16's "own scoped query" while still sharing cache across version navigations within the same session (`staleTime: 5min`, `gcTime: Infinity` per the v1.7 convention already used for every other query in this hook).
**Warning signs:** DevTools network tab shows a full re-fetch of every project MR on every release detail navigation, even to a release visited moments ago within the 5-minute staleTime window.

### Pitfall 5: Query-key collision with the deleted `fetchRecentProjectMRs`'s key

**What goes wrong:** The deleted query used key `['gitlab-recent-project-mrs', activeGitlabProject]` (`useReleaseDetail.ts:311`). If Channel A's replacement fetch accidentally reuses this exact key with different underlying data (capped-100 cached under the old key vs. now-uncapped data), a stale cache entry from before this phase's deploy could serve capped data to a client that hasn't remounted.
**Why it happens:** TanStack Query's cache persists across query-key reuse; renaming the underlying function without renaming the query key leaves old cached entries technically "valid" under the old key.
**How to avoid:** Use a NEW query key (e.g. `['gitlab-all-project-mrs', activeGitlabProject]`, not `['gitlab-recent-project-mrs', ...]`) for Channel A's fetch — don't reuse the deleted key even though the two fetches serve a conceptually similar purpose. This is a fresh cache entry, not a migration of the old one.
**Warning signs:** None will surface in a fresh dev session (cache is in-memory, cleared on reload) — this only matters for already-running long-lived sessions across a hot-reload/deploy boundary, which is a minor risk in a Tauri desktop app that restarts on update.

## Code Examples

### GitLabMR interface extension (the first change the planner should make)

```typescript
// Source: taskflow/src/services/gitlab.ts:425-436 (existing) + this phase's required extension
export interface GitLabMR {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  source_branch: string;
  target_branch: string; // NEW — DRIFT-03/DRIFT-05, D-10. GitLab returns this on
                          // the list endpoint already; GitLabMRDetail (line 446)
                          // already declares it — this is purely a missing-declaration
                          // fix, not a new API capability.
  state: 'opened' | 'closed' | 'merged' | 'locked';
  draft: boolean; // NEW — D-10 (state classification). GitLab returns this on
                  // the list endpoint already; see Pitfall 2 for why it is NOT
                  // used to gate evaluation despite its name suggesting otherwise.
  author: { id: number; name: string; username: string; avatar_url: string };
  reviewers: Array<{ id: number; name: string; username: string }>;
  updated_at: string;
  web_url: string;
  labels: GitLabLabel[];
  milestone: { id: number; title: string } | null;
}
```
`GitLabMRDetail` (`gitlab.ts:446`) already extends `Omit<GitLabMR, 'labels' | 'milestone'>` and separately declares `target_branch: string` — once `GitLabMR` itself declares `target_branch`, `GitLabMRDetail`'s own `target_branch: string;` line becomes a duplicate and must be removed to avoid a TS "duplicate property" conflict (its type is identical, so this is a pure cleanup, not a behavior change). Same check needed for `draft` if `GitLabMRDetail` also declares it independently — verify in the actual file before editing (confirmed present at `GitLabMRDetail`, `gitlab.ts:449`).

### New fetcher: `fetchBranchTargetedMRs` (Channel C)

```typescript
// New — model directly on fetchMilestoneMRs (gitlab.ts:1434), swap the filter param
export async function fetchBranchTargetedMRs(
  baseUrl: string,
  token: string,
  projectId: number,
  targetBranch: string,
  state: 'opened' | 'merged' | 'closed' | 'all' = 'all',
): Promise<GitLabMR[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  let page = 1;
  const allMRs: GitLabMR[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/merge_requests?target_branch=${encodeURIComponent(targetBranch)}&state=${state}&per_page=${perPage}&page=${page}`;
    const response = await apiFetch(
      'gitlab',
      url,
      { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
      'Load Branch-Targeted MRs',
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to fetch branch-targeted MRs', response.status, 'gitlab');
      }
      throw new Error(`Failed to fetch branch-targeted MRs: status ${response.status}`);
    }
    const data = (await response.json()) as GitLabMR[];
    allMRs.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  // Label-color enrichment pass — copy fetchMilestoneMRs's block verbatim, or
  // skip it if the MR-drift list never renders labels (confirm against UI-SPEC —
  // labels are not in D-08's row anatomy, so this enrichment is likely omittable
  // here, saving one request; verify before deciding).
  return allMRs;
}
```
`[CITED: docs.gitlab.com/api/merge_requests — target_branch documented as a list-endpoint filter param]` `[VERIFIED: codebase pattern — gitlab.ts:1434-1440, this session]`

### New fetcher: `fetchAllProjectMRs` (Channel A's universe)

```typescript
// New — same pagination shape, no filter param (project-wide, all states)
export async function fetchAllProjectMRs(
  baseUrl: string,
  token: string,
  projectId: number,
): Promise<GitLabMR[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  let page = 1;
  const allMRs: GitLabMR[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/merge_requests?state=all&per_page=${perPage}&page=${page}`;
    const response = await apiFetch(
      'gitlab',
      url,
      { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
      'Load All Project MRs',
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to fetch project MRs', response.status, 'gitlab');
      }
      throw new Error(`Failed to fetch project MRs: status ${response.status}`);
    }
    const data = (await response.json()) as GitLabMR[];
    allMRs.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  return allMRs;
}
```
This is genuinely a heavier fetch than Channels B/C on a large, long-lived project — it is the project's ENTIRE merge request history, not a scoped subset. See Open Questions #2 for the cost tradeoff this implies.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `fetchRecentProjectMRs` (100-cap, single page) + `buildWrongMilestoneMap` | Channel A: `fetchAllProjectMRs` (fully paginated) + `linkMRToTask` local match | This phase (D-05) | Removes the silent >100-MR under-report; adds request cost proportional to total project MR history instead of a flat 1-page fetch — see Open Questions #2 |
| Issues table's MR cell sourced from milestone-scoped `matchIssuesToMRs` + capped wrong-milestone heuristic | Same cell, re-sourced from the three-channel union (D-06) | This phase | Visual treatment identical; data source becomes strictly more complete (older MRs, branch-only MRs now discoverable) |

**Deprecated/outdated:** `fetchRecentProjectMRs` and `buildWrongMilestoneMap` are deleted in this phase per D-05 — do not resurrect either as a fallback path; the union replaces both.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GitLab's list merge-requests endpoint accepts `target_branch` as a filter parameter, returning MRs with that exact target branch across all states when combined with `state=all` | Pattern 1, Code Examples | If wrong, Channel C's core query fails outright (400/empty result) — this would surface immediately in manual testing, not silently, so risk is low despite being unverified against the team's live instance |
| A2 | GitLab's MR list endpoint returns `target_branch` and `draft` fields on every list-endpoint MR object (not just the single-MR detail endpoint) | Code Examples (GitLabMR extension) | If wrong, `mr.target_branch`/`mr.draft` would be `undefined` at runtime despite the TS type claiming `string`/`boolean` — BR predicate would compare `undefined !== releaseBranchName` (always true, false-flagging every MR) and D-10's evaluation gate would break. This is the single highest-impact assumption in this research; the planner should verify with one live authenticated `curl` before wiring predicates, not just trust the type declaration |
| A3 | GitLab's `locked` MR state should be treated as "muted, not evaluated" (grouped with merged/closed) | Pitfall 3 | Low impact if wrong — `locked` is transient and rare; worst case a brief false drift flag during an in-progress merge |
| A4 | Channel A's full-project MR fetch (`fetchAllProjectMRs`) is an acceptable request-cost tradeoff for this team's project size | Code Examples, Open Questions #2 | If the team's project has an unusually large total MR history (thousands+), this could be a slow, heavy fetch every 5-minute staleTime window on every release detail page visit — no request-cost ceiling has been discussed with the user |
| A5 | The Releases-list D-14 row count (branch+milestone only) should filter the one project-wide `state=opened` fetch by `milestone.id === row's matched milestone` OR `target_branch === row's release branch`, mirroring Channels B/C at list scale | Pattern 5 | This specific algorithm was not explicitly stated in CONTEXT.md beyond "derives from one request" — it is this researcher's inference of the only sensible way to satisfy that constraint. If the planner reads it differently, the exact filter logic could vary while still satisfying D-14's letter |

**These assumptions need user/planner confirmation before becoming locked, especially A2 (verify via one live `curl` against the team's real GitLab instance before implementation) and A4 (confirm no request-cost ceiling is needed, or discuss a cheaper Channel A alternative if the project's MR history is very large).**

## Open Questions

1. **Does the team's GitLab instance actually return `target_branch` and `draft` on the plain list endpoint (not just the single-MR detail endpoint)?**
   - What we know: GitLab's public API documentation and this codebase's own `GitLabMRDetail` interface both declare these fields exist on GitLab MR objects generally; multiple third-party GitLab API references confirm `target_branch` in the example list-endpoint response body.
   - What's unclear: whether THIS team's specific GitLab edition/version (self-hosted, per Phase 88's `git.devel.sun.orange.sk` — an on-prem instance, version unconfirmed) returns identical fields on the list endpoint vs. the detail endpoint. Self-hosted instances occasionally lag several GitLab minor versions behind SaaS.
   - Recommendation: The Phase 89 probe script (below) already fetches real list-endpoint MRs and should print the raw JSON keys of the first result — the planner/executor should visually confirm `target_branch` and `draft` are present before finalizing the `GitLabMR` interface change, rather than trusting only this research.

2. **What is the actual total MR count in the team's project — is `fetchAllProjectMRs` (Channel A) a light or heavy fetch?**
   - What we know: The project is `455` on `git.devel.sun.orange.sk`; Phase 88's probe fetched 265 milestones from it, suggesting an active, moderately long-lived project, but milestone count doesn't directly predict MR count.
   - What's unclear: total MR count across all history. If it's in the low thousands, `fetchAllProjectMRs` is a handful of paginated requests (fine). If it's tens of thousands, this is a real cost concern the user hasn't been asked about.
   - Recommendation: The probe script below includes a Channel A total-count check (`X-Total` header or full-page-count) so this number is known before implementation, not discovered in production.

3. **Does GitLab's list MR endpoint return the `X-Total` / `X-Total-Pages` response headers reliably, or are they disabled for large collections?**
   - What we know: GitLab documents these headers on offset-paginated list endpoints generally.
   - What's unclear: some GitLab configurations/versions omit exact counts on very large tables for performance (returning only `Link` headers for next/prev, no `X-Total`). If absent, the probe script's completeness check falls back to full pagination (still correct, just can't shortcut with a header check).
   - Recommendation: Probe script handles both cases — treats `X-Total` as informational only, never as the sole completeness proof; the actual proof is that the paginated loop's last page is short.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Live GitLab PAT + instance (for the mandated Channel C probe) | Roadmap probe requirement | Unknown to this research agent (no access to Tauri stronghold-stored secrets) | — | Probe script below must be run manually by a human/orchestrator with `GITLAB_BASE_URL`, `GITLAB_PAT`, `PROJECT_ID` set, same as Phase 88's `probe.sh` — per `88-VERIFICATION.md`, the team's live instance is `git.devel.sun.orange.sk`, project `455` |
| `curl` + `jq` | Probe script execution | Assumed present (Phase 88's `probe.sh` used both without reported issues) | — | None needed — these are near-universal on macOS/Linux dev machines |
| `vitest` | Unit tests for `driftDetection.ts` | ✓ (confirmed in `package.json`) | project-pinned | — |

**Missing dependencies with no fallback:**
- The live GitLab probe itself cannot be executed by this research agent — it requires the running app's stored PAT or manually-supplied credentials. This is not a phase blocker (implementation can proceed defensively, exactly as Phase 88 did), but the probe MUST run before the fully-paginated Channel C claim is treated as proven rather than theoretically sound.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (project-pinned version per `taskflow/package.json`) |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `npm run test -- driftDetection` (or `npx vitest run driftDetection` from `taskflow/`) |
| Full suite command | `npm run test` (= `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| DRIFT-01 | Channel A discovers MRs via Jira-key linkage to fix version issues | unit | `vitest run driftDetection -t "Channel A"` | ❌ Wave 0 |
| DRIFT-02 | Channel B discovers MRs via GitLab milestone | unit | covered by existing `fetchMilestoneMRs` reuse — no new logic to test beyond the union call | ❌ Wave 0 (union test) |
| DRIFT-03 | Channel C discovers MRs via release-branch target, fully paginated | unit (pagination loop) + manual/probe (live completeness) | `vitest run gitlab -t "fetchBranchTargetedMRs"` | ❌ Wave 0 |
| DRIFT-04 | Three channels union into one MR set retaining per-channel provenance | unit | `vitest run driftDetection -t "unionMRs"` | ❌ Wave 0 |
| DRIFT-05 | MR flagged when target branch ≠ release branch | unit | `vitest run driftDetection -t "evaluateBranchDrift"` | ❌ Wave 0 |
| DRIFT-06 | MR flagged when release milestone not assigned | unit | `vitest run driftDetection -t "evaluateMilestoneDrift"` | ❌ Wave 0 |
| DRIFT-07 | MR flagged when Jira task not in fix version (incl. D-11 keyless case) | unit | `vitest run driftDetection -t "evaluateTaskDrift"` | ❌ Wave 0 |
| DRIFT-08 | Merged/closed classified separately; drafts evaluated per D-10 override | unit | `vitest run driftDetection -t "state classification"` | ❌ Wave 0 |
| DRIFT-09 | Release row shows aggregate drift count (union of flagged MRs) | unit (count function) + manual (ReleasesTab rendering) | `vitest run driftDetection -t "countFlaggedMRs"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- driftDetection` (and `gitlab` if fetchers changed)
- **Per wave merge:** `npm run test` (full suite — must not regress `useReleaseDetail.test.tsx`, `ReleaseDetailSidebar.test.tsx`, `releaseSummaries.test.ts`, `ReleasesTab.test.tsx` per CONTEXT.md's "Consumers that must not regress" list)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus `npm run check` (biome+tsc) with zero *new* errors against the documented 2-error baseline

### Wave 0 Gaps
- [ ] `release-detail/driftDetection.test.ts` — new file, covers DRIFT-01, 04-09 (the pure predicate/union logic — the phase's primary test target per D-19)
- [ ] Extend `taskflow/src/services/gitlab.test.ts` (create if it doesn't exist — verify first) with `fetchBranchTargetedMRs`/`fetchAllProjectMRs` pagination-loop tests (mock `apiFetch` returning multi-page fixtures, assert the loop terminates correctly and accumulates all pages) — this directly tests the mechanism the roadmap probe is verifying against live data
- [ ] `ReleasesTab.test.tsx` — extend with a D-14/D-15 row-count assertion once the aggregate indicator is wired (verify the existing file's current test structure before assuming this is additive-only)

*(Verify whether `taskflow/src/services/gitlab.test.ts` currently exists before planning — this research did not locate one in the file listing gathered; if absent, this is a larger Wave 0 gap than a single new test block.)*

## Security Domain

`security_enforcement` config value not confirmed absent/false in this research session — treating as enabled per default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (new code) | Existing PAT-based auth (`PRIVATE-TOKEN` header) unchanged — this phase adds read-only GET calls using the already-validated, already-stored GitLab PAT |
| V3 Session Management | No | Not applicable — desktop app, Stronghold-backed secret storage unchanged |
| V4 Access Control | No | Explicitly out of scope per REQUIREMENTS.md ("GitLab permission/role gating... would be dead code" — team confirmed all Developer+) |
| V5 Input Validation | Yes (minor) | `encodeURIComponent` on `targetBranch`/milestone title in URL construction — already the established pattern in every existing fetcher (`fetchMilestoneMRs`, `fetchProjectBranches`); this phase's new fetchers must follow the same escaping, not introduce raw string interpolation |
| V6 Cryptography | No | No new secrets/crypto — reuses `readSecret('gitlab-pat')` unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL injection via unescaped branch/milestone name in query string | Tampering | `encodeURIComponent()` on every user/API-sourced string interpolated into a GitLab API URL — already the established codebase pattern (verified present in `fetchMilestoneMRs`, `fetchProjectBranches`); apply identically in the two new fetchers |
| Over-fetching exposing more MR data than the UI renders (e.g. full `description`, discussion threads) | — (not a security threat here, a performance one) | The list endpoint (not the detail endpoint) is used throughout this phase — it does not return `description`, discussions, or approval data, so there is no accidental over-exposure risk beyond what the existing `GitLabMR` shape already carries |

This phase introduces no new write operations (read-only per the phase boundary — "any corrective write... Phase 90"), so the write-path threat surface (CSRF-equivalent, idempotency, optimistic-update rollback) is entirely deferred to Phase 90's research, not this phase's.

## Probe Script (roadmap-mandated, run before locking Channel C's completeness claim)

Save as `.planning/phases/89-three-channel-drift-detection/probe.sh` (same invocation pattern as Phase 88's script — requires a human/orchestrator with live GitLab credentials):

```bash
#!/usr/bin/env bash
# Phase 89 — Channel C pagination-completeness probe (run ONCE against live GitLab).
# Gates DRIFT-03's "fully paginated, no page cap" claim per ROADMAP §89 probe note.
# Requires: curl, jq. Read-only (all GETs). Paste the SUMMARY block back into the chat.
#
# Usage:
#   GITLAB_BASE_URL="https://git.devel.sun.orange.sk" GITLAB_PAT="xxxx" PROJECT_ID="455" ./probe.sh
#
set -uo pipefail

: "${GITLAB_BASE_URL:?set GITLAB_BASE_URL (no trailing slash)}"
: "${GITLAB_PAT:?set GITLAB_PAT (PRIVATE-TOKEN personal access token)}"
: "${PROJECT_ID:?set PROJECT_ID (numeric GitLab project id — activeGitlabProject)}"

BASE="${GITLAB_BASE_URL%/}"
AUTH=(-H "PRIVATE-TOKEN: ${GITLAB_PAT}" -H "Content-Type: application/json")

echo "==================== PHASE 89 PROBE RESULTS ===================="
echo "base=${BASE}  project=${PROJECT_ID}"
echo

# --- Probe A: confirm target_branch and draft fields exist on the LIST endpoint (A1/A2) ---
echo "----- PROBE A: list-endpoint field shape (target_branch, draft) -----"
FIRST_PAGE=$(curl -sS --max-time 30 "${AUTH[@]}" "${BASE}/api/v4/projects/${PROJECT_ID}/merge_requests?state=all&per_page=1&page=1")
echo "$FIRST_PAGE" | jq -r '.[0] | keys' 2>/dev/null
if echo "$FIRST_PAGE" | jq -e '.[0] | has("target_branch")' >/dev/null 2>&1; then
  echo "target_branch: PRESENT"
else
  echo "target_branch: ABSENT (A2 assumption FAILS — investigate GitLab version/edition before implementing)"
fi
if echo "$FIRST_PAGE" | jq -e '.[0] | has("draft")' >/dev/null 2>&1; then
  echo "draft: PRESENT"
else
  echo "draft: ABSENT (A2 assumption FAILS)"
fi
echo

# --- Probe B: find all release/* branches, count MRs targeting each ---
echo "----- PROBE B: release branches + MR counts targeting each (DRIFT-03 core) -----"
BRANCHES_JSON="[]"
PAGE=1
while :; do
  PAGE_JSON=$(curl -sS --max-time 30 "${AUTH[@]}" "${BASE}/api/v4/projects/${PROJECT_ID}/repository/branches?per_page=100&page=${PAGE}&search=release/")
  COUNT=$(echo "$PAGE_JSON" | jq -r 'length' 2>/dev/null || echo 0)
  [ "${COUNT:-0}" -eq 0 ] && break
  BRANCHES_JSON=$(jq -s '.[0] + .[1]' <(echo "$BRANCHES_JSON") <(echo "$PAGE_JSON"))
  [ "${COUNT}" -lt 100 ] && break
  PAGE=$((PAGE + 1))
done
echo "release/* branches found: $(echo "$BRANCHES_JSON" | jq -r 'length')"
echo "$BRANCHES_JSON" | jq -r '.[].name'
echo

echo "$BRANCHES_JSON" | jq -r '.[].name' | while read -r BRANCH; do
  # Fully paginate target_branch MRs; report both the header-reported total (if present)
  # and the actual accumulated count — the two SHOULD match; a mismatch or a header total
  # exceeding 100 is exactly the completeness failure this probe exists to catch.
  TOTAL_MRS=0
  P=1
  HEADER_TOTAL=""
  while :; do
    RESP=$(curl -sS --max-time 30 -D /tmp/phase89-headers.txt "${AUTH[@]}" \
      "${BASE}/api/v4/projects/${PROJECT_ID}/merge_requests?target_branch=$(printf '%s' "$BRANCH" | jq -sRr @uri)&state=all&per_page=100&page=${P}")
    if [ "$P" -eq 1 ]; then
      HEADER_TOTAL=$(grep -i '^x-total:' /tmp/phase89-headers.txt | tr -d '\r' | awk '{print $2}')
    fi
    N=$(echo "$RESP" | jq -r 'length' 2>/dev/null || echo 0)
    TOTAL_MRS=$((TOTAL_MRS + N))
    [ "${N:-0}" -lt 100 ] && break
    P=$((P + 1))
  done
  FLAG=""
  [ "$TOTAL_MRS" -gt 100 ] && FLAG=" <== EXCEEDS SINGLE PAGE (100) — proves multi-page fetch is REQUIRED, not optional"
  echo "  ${BRANCH}: ${TOTAL_MRS} MRs (X-Total header: ${HEADER_TOTAL:-none})${FLAG}"
done
echo

# --- Probe C: if NO real branch exceeds 100, note the fixture-building fallback ---
echo "----- PROBE C: synthetic fixture note -----"
echo "If Probe B shows no release/* branch with >100 targeting MRs, the roadmap's"
echo "alternative instruction applies: build a synthetic >100-MR fixture in the unit"
echo "test suite (driftDetection.test.ts / gitlab pagination test) to prove the LOOP"
echo "MECHANISM is correct, since live data cannot prove it empirically. This is a"
echo "unit-test-level proof (mock apiFetch returning >1 page), not a live-data proof —"
echo "record which path was taken in the phase's VERIFICATION.md."
echo

echo "==================== END — paste everything above ===================="
```

This mirrors Phase 88's `probe.sh` structure exactly (same auth pattern, same paste-back-into-chat usage model) and targets the roadmap's stated probe question directly: does any real release branch carry >100 MRs, and if not, is the synthetic-fixture fallback the one that must be exercised instead.

## Sources

### Primary (HIGH confidence)
- Direct codebase reads this session: `taskflow/src/services/gitlab.ts` (full file structure, `GitLabMR`/`GitLabMRDetail`/`GitLabMilestone` interfaces, `fetchMilestoneMRs`, `fetchProjectMRs`, `fetchRecentProjectMRs`, `fetchProjectBranches`, `searchGitLabMRs`), `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts`, `releaseSummaries.ts`, `releaseBranch.ts`, `IssuesSection.tsx`, `UnmatchedMRsSection.tsx`, `taskflow/src/routes/dashboard/ReleasesTab.tsx`, `taskflow/src/services/linkEngine.ts`, `taskflow/src/services/jira.ts` (`JiraIssue`, `fetchFixVersionIssues`)
- `.planning/phases/88-release-branch-milestone-creation/probe.sh` and `88-VERIFICATION.md` — confirmed the team's live GitLab instance identity (`git.devel.sun.orange.sk`, project `455`) and the probe-script usage pattern to replicate

### Secondary (MEDIUM confidence)
- GitLab REST API merge requests documentation (`docs.gitlab.com/api/merge_requests`) — `target_branch`, `milestone`, `state` filter parameters confirmed via WebSearch cross-referencing multiple GitLab-hosted mirror docs (uchicago, brown, etc. — these are GitLab CE self-hosted instances serving the identical official docs content, not independent sources, so treat as one corroborated source, not three)
- GitLab offset-pagination behavior and keyset-pagination recommendation (`docs.gitlab.com/development/database/keyset_pagination`, `docs.gitlab.com/development/database/offset_pagination_optimization`) — WebSearch verified against GitLab's own development documentation

### Tertiary (LOW confidence)
- None — every claim in this research is either a direct codebase read (HIGH) or corroborated against GitLab's own documentation (MEDIUM). The one genuinely unverified claim (A2 — field presence on THIS team's specific instance) is flagged in Open Questions #1 and the probe script, not asserted as fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every pattern reused is read directly from the existing codebase in this session
- Architecture: HIGH — the union/predicate/query shapes follow the codebase's own established pure-module and single-hook conventions (P87 D-07/D-08/D-09) verbatim
- Pitfalls: MEDIUM-HIGH — the GitLab API shape pitfalls (Pitfall 1, 3) are HIGH (verified interfaces/docs); the live-instance field-presence risk (A2) is the one genuinely open item, mitigated by the probe script

**Research date:** 2026-08-10
**Valid until:** 30 days (stable GitLab REST API v4 surface, matching Phase 88's own 30-day estimate for the same API family) — re-verify sooner if the probe reveals an unexpected field-presence or GitLab-version behavior
