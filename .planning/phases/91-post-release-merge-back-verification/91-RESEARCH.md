# Phase 91: Post-Release Merge-Back Verification - Research

**Researched:** 2026-08-11
**Domain:** GitLab REST API (repository comparison, MR discovery), pure verdict-resolution logic, sidebar UI wiring
**Confidence:** HIGH

## Summary

This phase adds exactly two new read-only GitLab API surfaces (`GET /repository/compare` and `GET /merge_requests?source_branch=…`), one new pure verdict-resolution module modeled directly on the existing `resolveBranchState`/`BranchState` pattern in `releaseBranch.ts`, two new gated queries in `useReleaseDetail.ts`, one new sidebar `MetaRow`, and a wording edit to an existing row. No new npm packages are required — this is 100% first-party code extending `services/gitlab.ts` and the `release-detail/` folder. All 15 CONTEXT.md decisions are locked; this research supplies the technical facts needed to implement them, not alternatives to reconsider.

GitLab's official docs confirm the `repository/compare` endpoint's parameter and response shape exactly as CONTEXT.md's canonical-refs section expected: `from`/`to` (not `from`/`to` swapped — the D-01/D-04 fallback is `from=<default_branch>&to=<tag>`), `straight` defaults to `false` (three-dot / merge-base comparison, which is what this phase wants), and the response carries `commit`, `commits[]`, `diffs[]`, `compare_timeout`, `compare_same_ref`, `web_url`. The authoritative "no content difference" signal is `diffs.length === 0`, NOT `compare_same_ref` (which only fires when `from` and `to` resolve to the literal same commit SHA — a strictly narrower condition than "no diff between them", since a squash/merge-commit workflow can produce a different SHA on the target with zero net diff). `compare_timeout: true` must map to `couldn't-verify`, never `likely-not-merged`, because the docs explicitly say `diffs` may be incomplete when a timeout occurs — an incomplete diff must not be read as "no diff".

The tracking-MR lookup is a straightforward `GET /projects/:id/merge_requests?source_branch=<branch>&state=all` call, and the project-scoped list endpoint's `state` param defaults to `all` and the endpoint returns every MR in the project (not scoped to the calling user, unlike the global `/merge_requests` endpoint) — so `state=all` should still be passed explicitly for clarity/stability, and must NOT be page-capped (the fetch-once page-cap trap this codebase has hit twice). A release branch typically has zero or one tracking MR (source branches aren't reused after merge), so full pagination is cheap here but should still follow the established paginated-fetch template (`fetchBranchTargetedMRs`) for consistency and correctness under an edge case (multiple abandoned/retried MRs from the same source branch).

**Primary recommendation:** Add `fetchSourceBranchMRs` and `compareRefs` to `services/gitlab.ts` following the `fetchBranchTargetedMRs`/`fetchBranch` templates exactly (paginated list + 404-as-data respectively), add a new `mergeBackVerification.ts` pure module sibling to `releaseBranch.ts` with a `MergeBackVerdict` discriminated union and a `resolveMergeBackVerdict` resolver, wire two new gated queries into `useReleaseDetail.ts` off the existing `releasedVersion` flag, and add the "Merged back" `MetaRow` per the UI-SPEC's locked copy.

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 (user):** When the release branch is already deleted and no tracking MR is found, the content-comparison fallback compares the **`v<version>` tag** against the default branch. The tag is the surviving artifact — Phase 88's live probe found only `release/33.7.0` alive across 265 milestones, so **branch-deleted is the normal case**, and `repository/compare` has no branch ref to work with. When there is no tag either, the verdict is `couldn't-verify` (D-08) — Phase 88 established tags are an incomplete record, so tag-absence is **never** evidence a release did not ship.

**D-02 (Claude's discretion):** A tracking MR that is **closed but not merged** is *not* negative evidence — it falls through to the tag comparison. `merged` is the **only** positive MR signal; every other MR state defers to content.

**D-03 (user-supplied fact — RESOLVES THE ROADMAP PROBE):** The team's GitLab project uses **merge commits** (Settings → Merge requests → Merge method), not squash and not rebase/fast-forward. **The probe does not need to run.**

**D-04 (Claude's discretion):** Despite D-03, comparison is **diff-based, not commit-based** — treat an empty diff between the tag and the default branch as "landed", rather than counting commits.

**D-05 (Claude's discretion):** The check runs **automatically, for released fix versions only, on page load**. Unreleased versions fire **zero** extra GitLab calls. Not lazy/on-demand.

**D-06 (Claude's discretion):** **Detail page only.** No Releases-list per-row indicator.

**D-07 (Claude's discretion):** The verdict is a **new "Merged back" row in the sidebar Details block**, directly below the existing `Release Branch` row. **Not** folded into the Release Branch row. **No release-level banner.**

**D-08 (Claude's discretion, follow-on to D-07):** The existing `released` branch-state wording **must be softened**. That row must report only what it knows (the branch is absent; a tag exists) and leave the merge verdict to the new row. This is a required change, not an optional polish.

**D-09 (Claude's discretion):** **"No evidence either way" is its own visible state.** Four outcomes: `merged` / `likely-not-merged` / `couldn't-verify` / hidden.

**D-10 (Claude's discretion):** **Factual one-line verdict text naming the real default branch, with the evidence in the hover tooltip.**
```
Merged back    ✓ Merged into develop · 21 Jul
                 ⤷ tooltip: via !4821, merged 21.07.2026
Merged back    ⚠ Likely not merged into develop
                 ⤷ tooltip: v33.7.0 has 12 commits not in develop
Merged back    ? Couldn't verify
                 ⤷ tooltip: no tracking MR and no v33.7.0 tag found
```
The default branch name is always the **fetched** `project.default_branch` (P88 D-14) — never a hardcoded `main`/`develop`.

**D-11 (Claude's discretion):** The row is **hidden entirely** when the check cannot be attempted — version not released, or no matched milestone so no version/branch is derivable. No dead `—` row.

**D-12 (user, hard — descopes MERGE-03):** There is **no manual override control of any kind**. **MERGE-03 is therefore DESCOPED, not satisfied.** Must be recorded as an intentional descope, the same handling as DASH-06 (P84 UAT) and DRIFT-09 (P89 UAT) — must **not** be treated as a gap or invent a confirmation affordance to close it. Nothing in this phase persists to a Zustand/Tauri store, to Jira, or to GitLab.

**D-13 (Claude's discretion, follow-on to D-12):** The negative wording **stays as locked in D-10** (`⚠ Likely not merged into develop`) and is not softened further into pure measurement.

**D-14:** New queries go in the single hook `release-detail/useReleaseDetail.ts` (P87 D-07); section components stay **presentational and props-driven** (P87 D-08); verdict resolution is a **pure, React-free module with unit tests** (P87 D-09) — model it on `releaseBranch.ts`'s `resolveBranchState` discriminated union. New GitLab calls go in `services/gitlab.ts` via `apiFetch('gitlab', …)` (P87 D-12a).

**D-15:** This phase is **read-only**. Cache invalidation, where needed at all, is at **project granularity, never a windowed key** (P88 CR-02). Never `?? 0` a project id into a URL (WR-10) — throw instead.

### Claude's Discretion

D-02, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-13 were delegated to Claude and are locked for downstream agents — not open questions to re-ask. The planner may adjust implementation detail where evidence contradicts a call, but must record the deviation.

### Deferred Ideas (OUT OF SCOPE)

- A manual override / confirmation, in any persisted form — MERGE-03, descoped by D-12.
- A Releases-list merge-back indicator — declined in D-06 on fan-out cost.
- Linking the verdict out to GitLab's compare view or the tracking MR — raised and set aside; nothing is clickable.
- The released-version-with-a-surviving-branch case (drift in the other direction) — noted, not in scope.
- Closing `flattenGitLabError` back into the P88 create dialogs — carried from P90, not blocking here.
- Correcting RELMS-03's `1.1.0` milestone format in `REQUIREMENTS.md` — documentation-only, still outstanding.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MERGE-01 | Once the Jira fix version is marked released, user sees whether `release/[tag]` has been merged back into the project default branch | New "Merged back" `MetaRow` (D-07/D-10); gated on `releasedVersion` (D-05); `mergeBackVerification.ts` resolver produces the four-state verdict |
| MERGE-02 | Detection prefers the tracking MR's state and falls back to content comparison when no such MR exists | `fetchSourceBranchMRs` (tracking-MR lookup) checked first; `compareRefs` (repository/compare) as fallback; strict precedence order documented below in "Verdict resolution module design" |
| MERGE-03 | The verdict is presented as advisory with a manual override | **DESCOPED by D-12** — no override of any kind. Record as intentional descope, same handling as DASH-06/DRIFT-09. Advisory tone is carried entirely by D-10's wording ("Likely") — no interactive override element exists or should be built. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tracking-MR lookup (`source_branch=` query) | API / Backend (GitLab REST, called from renderer) | — | New `services/gitlab.ts` function; Tauri app has no server tier — all GitLab calls originate client-side via `apiFetch` |
| Content comparison (`repository/compare`) | API / Backend (GitLab REST) | — | Same as above |
| Verdict resolution (precedence logic) | Frontend Server / Pure logic module | — | React-free pure function in `release-detail/mergeBackVerification.ts`, mirroring `resolveBranchState`; not a "backend" in the traditional sense but architecturally equivalent to a service-layer business-rule module |
| Query orchestration / gating | Frontend Server (React Query hook) | — | `useReleaseDetail.ts` — single data-layer hook per P87 D-07 |
| "Merged back" row rendering | Browser / Client (React component) | — | `ReleaseDetailSidebar.tsx`, presentational per P87 D-08 |
| "Release Branch" row wording softening | Browser / Client | — | Same file, existing row, text-only change |

This phase has no CDN/static, no Database/Storage tier — Taskflow is a local-only Tauri client with no server component (per PROJECT.md's no-server constraint, which is also why D-12's override could never persist server-side).

## Standard Stack

### Core

No new libraries. This phase extends two existing modules:

| Module | Purpose | Why Standard (for this codebase) |
|--------|---------|-------------------------------|
| `src/services/gitlab.ts` | Two new functions: `fetchSourceBranchMRs`, `compareRefs` | Every GitLab call in this codebase lives here, called via `apiFetch('gitlab', …)` — established in P87 D-12a and followed without exception through P88-90 |
| `src/routes/dashboard/release-detail/*` | New pure module `mergeBackVerification.ts` + wiring in `useReleaseDetail.ts` + a row in `ReleaseDetailSidebar.tsx` | Established `release-detail/` folder structure from P87; `releaseBranch.ts` is the direct precedent (CONTEXT D-14) |

### Supporting

No supporting libraries needed — this phase adds zero UI primitives (UI-SPEC confirms: "No new shadcn components are needed," native `title` tooltip, existing `MetaRow`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `title` attribute tooltip | shadcn `Tooltip`/`Popover` | Rejected by UI-SPEC — every sibling row in this file uses native `title`; introducing a JS tooltip for one row breaks visual/interaction consistency |
| Custom verdict-state React component | Inline JSX in `ReleaseDetailSidebar.tsx` (matching `branchState.kind` pattern) | Inline matches the existing file's established per-kind conditional-render pattern exactly (see `branchState.kind === …` chain at L209-275); no reason to extract a component for one row |

**Installation:** none — no new packages.

**Version verification:** N/A — no new npm/pip/cargo dependencies introduced by this phase. Skipping the standard package-version-verification step for that reason.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages — it is pure first-party TypeScript extending existing modules (`services/gitlab.ts`, `release-detail/*`). No `npm install` step exists in any plan for this phase. If a future plan revision introduces a package, the Package Legitimacy Gate must be run at that time.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  ReleaseDetailPage.tsx (page shell)                              │
│    useReleaseDetail(versionId) ──────────────────────────────┐   │
└────────────────────────────────────────────────────────────┼───┘
                                                                │
┌───────────────────────────────────────────────────────────  ▼   ┐
│  useReleaseDetail.ts (single data-layer hook)                    │
│                                                                    │
│  releasedVersion (existing flag, L181)                            │
│    │                                                               │
│    ├─ enabled: releasedVersion && releaseBranchName !== null      │
│    │   ┌─────────────────────────────────────────┐                │
│    │   │ useQuery(['gitlab-mrs-source', ...])     │                │
│    │   │   → fetchSourceBranchMRs(...)            │──► GitLab API  │
│    │   └─────────────────────────────────────────┘   /merge_requests?
│    │                                                   source_branch=
│    │                                                   release/X&state=all
│    │
│    ├─ enabled: releasedVersion && (tagName found via widened tag gate)
│    │       && defaultBranch !== null
│    │   ┌─────────────────────────────────────────┐                │
│    │   │ useQuery(['gitlab-compare', ...])        │                │
│    │   │   → compareRefs(default, tag)            │──► GitLab API  │
│    │   └─────────────────────────────────────────┘   /repository/compare?
│    │                                                   from=<default>&to=<tag>
│    │
│    ▼
│  resolveMergeBackVerdict({                                        │
│    releasedVersion, trackingMRs, compareResult,                   │
│    tagName, defaultBranch, ...                                    │
│  })  ── pure function, release-detail/mergeBackVerification.ts    │
│    │
│    ▼
│  MergeBackVerdict (discriminated union: merged | likely-not-merged │
│                      | couldnt-verify | hidden)                    │
└────────────────────────────────────────────────────────────┬─────┘
                                                                │ props
┌───────────────────────────────────────────────────────────  ▼   ┐
│  ReleaseDetailSidebar.tsx (presentational)                       │
│    <MetaRow label="Release Branch"> ... (softened D-08 wording)  │
│    <MetaRow label="Merged back"> ... (new row, D-07/D-10)        │
└────────────────────────────────────────────────────────────────┘
```

Data flow for the primary use case: page mounts → `useReleaseDetail` resolves `releasedVersion` and `releaseBranchName`/`matchedVersionNumber` from existing state → two new queries fire only if released → their results (or `undefined` while loading, or error flags) feed `resolveMergeBackVerdict` → the resulting discriminated union is threaded as a prop to `ReleaseDetailSidebar`, which renders one of four branches per D-10's locked copy.

### Recommended Project Structure

```
src/routes/dashboard/release-detail/
├── mergeBackVerification.ts        # NEW — pure module (MergeBackVerdict + resolveMergeBackVerdict)
├── mergeBackVerification.test.ts   # NEW — unit tests, sibling to releaseBranch.test.ts
├── releaseBranch.ts                # UNCHANGED — the model this phase copies
├── useReleaseDetail.ts             # MODIFIED — two new queries + resolver call, widened tag gate
├── ReleaseDetailSidebar.tsx         # MODIFIED — new "Merged back" MetaRow, softened "released" wording
└── ReleaseDetailSidebar.test.tsx    # MODIFIED — new row's tests, updated "released" wording assertions
```

`services/gitlab.ts` gains two functions (`fetchSourceBranchMRs`, `compareRefs`) and two interfaces (`GitLabCompareResult`, reuse of existing `GitLabMR`). No new file — this file already holds every GitLab call in the app.

### Pattern 1: Discriminated-union verdict resolver (mirrors `resolveBranchState`)

**What:** A pure function taking explicit primitive/plain-object parameters (never live query objects) and returning a closed set of `{ kind: ... }` variants, evaluated in a strict, comment-justified precedence order.

**When to use:** Any time UI must render one of several mutually-exclusive states derived from multiple async/uncertain data sources — the exact shape of this phase's problem.

**Example (proposed shape, following `resolveBranchState`'s signature style):**
```typescript
// Source: modeled on src/routes/dashboard/release-detail/releaseBranch.ts:92-192
export type MergeBackVerdict =
  | { kind: 'hidden' }
  | { kind: 'couldnt-verify'; reason: 'no-mr-no-tag' | 'check-failed' }
  | {
      kind: 'merged';
      defaultBranch: string;
      mrIid: number;
      mrUrl: string;
      mergedAt: string; // ISO 8601
    }
  | { kind: 'likely-not-merged'; defaultBranch: string; tagName: string; commitsNotInDefault: number };

export function resolveMergeBackVerdict(params: {
  releasedVersion: boolean;
  hasMatchedMilestone: boolean;
  defaultBranch: string | null;
  // tracking-MR channel
  trackingMRs: GitLabMR[] | undefined; // undefined = loading
  trackingMRsCheckFailed: boolean;
  // content-compare channel (only queried when no merged tracking MR was found)
  tagName: string | null; // from findReleaseTag — null = no tag exists
  compareResult: { diffCount: number; timedOut: boolean } | undefined; // undefined = loading or not attempted
  compareCheckFailed: boolean;
}): MergeBackVerdict {
  // D-11: hidden entirely when the check cannot be attempted at all.
  if (!params.releasedVersion || !params.hasMatchedMilestone) {
    return { kind: 'hidden' };
  }

  // D-02: `merged` is the ONLY positive MR signal. Closed-but-not-merged MRs
  // fall through — they are not negative evidence.
  const mergedMR = params.trackingMRs?.find((mr) => mr.state === 'merged');
  if (mergedMR) {
    return {
      kind: 'merged',
      defaultBranch: params.defaultBranch ?? '',
      mrIid: mergedMR.iid,
      mrUrl: mergedMR.web_url,
      mergedAt: /* from GitLabMRDetail.merged_at — see Open Questions */ '',
    };
  }

  // D-01: no tag ⇒ couldn't-verify, NEVER negative — tags are an incomplete
  // record (Phase 88 finding: only 1/265 milestones had a surviving branch,
  // and tag coverage is known-partial).
  if (params.tagName === null) {
    return { kind: 'couldnt-verify', reason: 'no-mr-no-tag' };
  }

  if (params.compareCheckFailed || params.trackingMRsCheckFailed) {
    return { kind: 'couldnt-verify', reason: 'check-failed' };
  }

  if (params.compareResult === undefined) {
    // Still loading — caller should also gate rendering on an explicit
    // loading flag; 'couldnt-verify' is the safe placeholder if forced to
    // pick a terminal state early (see Open Questions #2).
    return { kind: 'couldnt-verify', reason: 'no-mr-no-tag' };
  }

  // D-04: diff-based, not commit-based. compare_timeout means diffs[] may be
  // INCOMPLETE (GitLab docs) — an incomplete diff must never be read as "no
  // diff", so timeout maps to couldn't-verify, not likely-not-merged.
  if (params.compareResult.timedOut) {
    return { kind: 'couldnt-verify', reason: 'check-failed' };
  }

  if (params.compareResult.diffCount === 0) {
    return {
      kind: 'merged',
      defaultBranch: params.defaultBranch ?? '',
      mrIid: -1, // no MR — content-verified merge; UI must branch on this
      mrUrl: '',
      mergedAt: '',
    };
  }

  return {
    kind: 'likely-not-merged',
    defaultBranch: params.defaultBranch ?? '',
    tagName: params.tagName,
    commitsNotInDefault: params.compareResult.commitCount ?? 0,
  };
}
```

**Note on the `merged` variant's shape:** the two paths that produce `merged` (tracking-MR vs content-compare) carry different evidence (MR ref+date vs nothing). D-10's tooltip copy differs per path (`via !4821, merged 21.07.2026` vs presumably a tag-based equivalent — **not specified by D-10/UI-SPEC, which only shows the MR-sourced tooltip example**). Recommend the resolver return a discriminated sub-variant (`{ kind: 'merged'; via: 'tracking-mr'; ... } | { kind: 'merged'; via: 'content-compare'; ... }`) rather than a single flat `merged` shape with optional fields — flag this as an Open Question for the planner/UI, since neither CONTEXT.md nor UI-SPEC specify the tooltip text for a content-compare-derived `merged` verdict.

### Pattern 2: 404-as-data for `compareRefs` (mirrors `fetchBranch`)

**What:** GitLab's `repository/compare` endpoint's behavior on a nonexistent `from`/`to` ref is undocumented (confirmed via WebSearch — no official-docs statement found), but the codebase's own `fetchBranch` establishes the pattern of treating expected-but-unusual GitLab responses as data, not exceptions. Given the tag is looked up first via `findReleaseTag`/`searchProjectTags` (which already returns `[]` on failure, never throwing), `compareRefs` should only ever be called with a `to` ref (the tag) that is already confirmed to exist as a tag name string — but `from` (the default branch) could theoretically be stale/renamed between the `fetchProject` call and this call. Treat any non-2xx response from `compareRefs` as `compareCheckFailed: true` (feeding `couldnt-verify`), not a thrown, uncaught exception — this keeps a transient/edge-case ref problem from crashing the merge-back row instead of gracefully degrading to `couldn't verify`.

**Example:**
```typescript
// Source: modeled on fetchBranch (services/gitlab.ts:1192-1229) and
// searchProjectTags's defensive-return convention (services/gitlab.ts:352-385)
export interface GitLabCompareResult {
  diffCount: number;
  commitCount: number;
  timedOut: boolean;
}

export async function compareRefs(
  baseUrl: string,
  token: string,
  projectId: number,
  from: string,
  to: string,
): Promise<GitLabCompareResult> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v4/projects/${projectId}/repository/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
      'Compare Release Tag',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to compare refs', response.status, 'gitlab');
    }
    // Undocumented ref-not-found behavior (WebSearch confirms no official
    // spec) — a 404/422/500 here is DATA (ref problem), not necessarily an
    // app error. Callers gate this behind trackingMRsCheckFailed/
    // compareCheckFailed to fall through to couldn't-verify, mirroring the
    // fetchBranch 404-as-missing template's INTENT even though the specific
    // status code is unconfirmed.
    throw new Error(`Failed to compare refs: status ${response.status}`);
  }

  const data = (await response.json()) as {
    diffs: unknown[];
    commits: unknown[];
    compare_timeout: boolean;
  };

  return {
    diffCount: data.diffs.length,
    commitCount: data.commits.length,
    timedOut: data.compare_timeout,
  };
}
```

**Caller-side note:** `useReleaseDetail.ts` should wrap this query's `isError` the same way `branchCheckFailed` already wraps `fetchBranch`'s query (`isError: compareCheckFailed`), not try to special-case a specific status code — this matches CR-03's established pattern and sidesteps the undocumented-404-shape uncertainty entirely.

### Pattern 3: Paginated source-branch MR fetch (mirrors `fetchBranchTargetedMRs`)

**What:** `fetchSourceBranchMRs` is the structural inverse of the existing `fetchBranchTargetedMRs` — same pagination loop, same error contract, only the query param and the semantic meaning differ (`source_branch=` instead of `target_branch=`).

**Example:**
```typescript
// Source: modeled directly on fetchBranchTargetedMRs (services/gitlab.ts:1696-1792)
export async function fetchSourceBranchMRs(
  baseUrl: string,
  token: string,
  projectId: number,
  sourceBranch: string,
): Promise<GitLabMR[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  let page = 1;
  const allMRs: GitLabMR[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/merge_requests?source_branch=${encodeURIComponent(sourceBranch)}&state=all&per_page=${perPage}&page=${page}`;
    let response: Response;
    try {
      response = await apiFetch(
        'gitlab',
        url,
        { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
        'Load Tracking MR',
      );
    } catch {
      throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to fetch tracking MR', response.status, 'gitlab');
      }
      throw new Error(`Failed to fetch tracking MR: status ${response.status}`);
    }

    const data = (await response.json()) as GitLabMR[];
    allMRs.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return allMRs;
}
```

**No label-enrichment step needed** (unlike `fetchBranchTargetedMRs`) — the verdict row never renders MR labels, only `iid`/`web_url`/`merged_at`/`state`, so the label-color-fetch block in the target-branch analog should NOT be copied; it would be dead code and an unnecessary extra `/labels` API call.

### Anti-Patterns to Avoid

- **Trusting `GitLabBranch.merged` field:** GitLab issue #36963 — under squash/rebase this field can false-negative. D-03 confirms the team uses merge commits, which makes this specific field more reliable in principle, but D-04 deliberately still avoids commit-based detection entirely (including this field) for robustness against a future merge-method change. Do not read `merged` off any branch object for this phase's verdict — the release branch is usually already deleted anyway (D-01), so `GitLabBranch.merged` is frequently unavailable regardless.
- **Fetch-once page-cap:** the recurring bug class (per MEMORY.md, and DRIFT-03/Channel C's explicit fix in P89) — both new fetchers MUST paginate fully, never take page 1 and filter client-side.
- **Reading `compare_same_ref` as the "no diff" signal:** confirmed via official docs — `compare_same_ref` only means `from` and `to` point at the literal same commit. A tag merged via a merge-commit workflow will have a DIFFERENT SHA on the default branch than the tag's own SHA even when the diff is empty (the default branch's tip commit is the merge commit, not the tag's commit). Use `diffs.length === 0`, not `compare_same_ref`.
- **Treating `merged: false` on the branch endpoint as evidence of anything** — not queried by this phase at all (release branch is typically already deleted per D-01), but worth noting as the anti-pattern D-03/D-04's design already sidesteps.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Diff/commit comparison between two refs | A custom "walk commit history and diff" client-side algorithm | GitLab's `repository/compare` endpoint | Git ref comparison (merge-base detection, diff computation) is exactly what this endpoint exists for; reimplementing it client-side would require cloning the repo, which this app never does |
| Tracking-MR discovery | Scanning `fetchAllProjectMRs`'s already-fetched Channel A data client-side for a matching `source_branch` | A dedicated `source_branch=` server-side filtered query | Channel A's `channelAUpdatedAfter` window (P89) can be as narrow as 12 months and is capped at 24 months — an old release's tracking MR could fall outside that window entirely, silently producing a false `couldn't-verify`. A dedicated, unwindowed, server-filtered query has no such blind spot |
| Verdict-state UI branching | A generic "status badge" component parameterized by color/icon/text | The existing per-`kind` conditional JSX chain already used for `branchState` in `ReleaseDetailSidebar.tsx` | Four fixed, enumerable states with distinct tooltip content per state — matches the existing file's established pattern exactly; a generic abstraction would be premature for a single four-branch row that appears once |

**Key insight:** every "don't hand-roll" item in this phase maps to reusing GitLab's own comparison engine and this codebase's own established two-tier (service function → pure resolver → presentational component) architecture. There is no domain-specific complexity here that isn't already solved by an existing analog.

## Common Pitfalls

### Pitfall 1: Reading `compare_same_ref` as "landed" evidence

**What goes wrong:** A developer familiar with git might assume `compare_same_ref: true` means "no difference" and gate the `merged` verdict on it instead of `diffs.length === 0`.
**Why it happens:** The field name sounds like exactly what's needed, and its GitLab docs description ("indicates identical references") is easy to misread as "identical content" rather than "identical ref pointer".
**How to avoid:** Always gate on `diffs.length === 0` (post D-04). Reserve `compare_same_ref` for logging/diagnostics only, never for the verdict decision.
**Warning signs:** A merged release (via merge-commit workflow, matching D-03's fact) reports `likely-not-merged` because `compare_same_ref` is `false` (correctly — the SHAs differ) even though `diffs` is empty.

### Pitfall 2: The Channel A / tracking-MR window mismatch (see Don't Hand-Roll above)

**What goes wrong:** Reusing `allProjectMRs` (Channel A, P89) instead of a dedicated query silently misses tracking MRs for releases older than `channelAUpdatedAfter`'s window.
**Why it happens:** `allProjectMRs` is already fetched and in scope inside `useReleaseDetail.ts` — reusing it looks like free performance.
**How to avoid:** Always issue the dedicated `fetchSourceBranchMRs(releaseBranchName)` query, unwindowed (per-branch scoped, not date-scoped) — mirrors how `fetchBranchTargetedMRs` (Channel C) is already its own unwindowed per-branch query, not a filter over Channel A.
**Warning signs:** An old, definitely-merged release from >12/24 months ago shows `couldn't-verify` or `likely-not-merged` because its tracking MR fell outside Channel A's window.

### Pitfall 3: Firing the compare query before the tag lookup resolves

**What goes wrong:** `compareRefs` needs `to=<tagName>`, but the tag is discovered by `searchProjectTags` + `findReleaseTag`, which is itself an existing gated query (`needsTagLookup` in `useReleaseDetail.ts:183-197`). D-01 widens that gate. If the compare query's `enabled` doesn't also depend on the tag having resolved (not just the gate being "on"), React Query will either skip it forever (if gated on `tagName !== null` too strictly before the tag query has even run) or fire it with an empty string ref.
**Why it happens:** Query dependency chains across multiple `useQuery` calls in one hook are easy to get subtly wrong — one query's `enabled` must depend on another query's *resolved data*, not just on the same upstream flags.
**How to avoid:** Gate `compareRefs`'s query on `releasedVersion && defaultBranch !== null && tagName !== null` (i.e., depend on the *tag query's own result*, `findReleaseTag(...)`, not merely on `needsTagLookup` being true) — exactly like how the existing `branchState` resolution already depends on `releaseTags` data, not just `needsTagLookup`.
**Warning signs:** The compare query key contains `null` or `''` for `to`, or the query never fires even when a tag genuinely exists.

### Pitfall 4: Widening `needsTagLookup` incorrectly (D-01's gate change)

**What goes wrong:** The existing `needsTagLookup` gate is `releasedVersion && branchResult?.exists === false && !!matchedVersionNumber` (useReleaseDetail.ts:183-184) — i.e., it only looks up the tag once the branch-existence check has confirmed absence. D-01's fallback logic ALSO needs the tag in the "no tracking MR found" case, which can be determined independently of branch existence (a released version's branch might technically still exist in a weird edge case, or the branch check might still be loading while the MR check has already resolved). If the planner narrowly reuses `needsTagLookup` as-is, the tag lookup may not fire in every case D-01 needs it.
**Why it happens:** `needsTagLookup`'s original purpose (P88 D-08) was narrower than this phase's needs — it existed only to decorate the `released` branch-state row, not to feed a full verdict resolver.
**How to avoid:** Widen the tag-lookup `enabled` condition to `releasedVersion && !!matchedVersionNumber` (drop the `branchResult?.exists === false` clause) — the tag is now needed whenever a version is released, independent of branch state, since D-01's fallback triggers whenever no tracking MR is found (which is the common case even before the branch-existence check resolves). Cross-check: does this create redundant tag fetches for released versions whose branch still exists (a rare/edge case per Phase 88's probe finding of "branch-deleted is the normal case")? Even so, the tag query is cheap (single search-scoped call, capped at 20 pages) and already tolerant of failure (`searchProjectTags` returns `[]` on error, never throws) — widening is safe.
**Warning signs:** `useReleaseDetail.test.tsx` or a new merge-back test shows the tag query key never firing for a released version whose tracking-MR query resolved to "no merged MR found" while the branch-existence query is still in flight or errored.

### Pitfall 5: Forgetting the `RowUnavailable`/hidden-row test coverage gap

**What goes wrong:** D-11 requires the "Merged back" row to render nothing (not even a placeholder) for unreleased versions and no-milestone cases. It is easy to test only the four visible-verdict states and skip asserting the row's absence.
**Why it happens:** Absence is harder to remember to test than presence — there's no DOM node to anchor an assertion on, so it's easy to omit.
**How to avoid:** Explicitly assert `screen.queryByText('Merged back')` (or an equivalent row-label query) is `null` for the unreleased and no-milestone cases in `ReleaseDetailSidebar.test.tsx`, mirroring how `branch-status-missing`/`branch-status-blocked` presence/absence pairs are already asserted for the existing row.
**Warning signs:** A code-review or plan-checker pass flags "no test for the hidden case" — this is a common gap category for hidden-by-design rows across this codebase's history (see P89 D-18's degraded-banner precedent, which explicitly required its own hidden-state test).

## Code Examples

Verified patterns from official sources and direct codebase analogs — see the three "Architecture Patterns" code blocks above (`resolveMergeBackVerdict`, `compareRefs`, `fetchSourceBranchMRs`) for the full proposed implementations, each annotated with its source template.

### GitLab compare response — verbatim official example
```json
// Source: https://docs.gitlab.com/api/repositories/
{
  "commit": { "id": "12d65c8dd2b...", "short_id": "12d65c8dd2b", "title": "JS fix", "...": "..." },
  "commits": [{ "id": "12d65c8dd2b...", "...": "..." }],
  "diffs": [{ "old_path": "files/js/application.js", "new_path": "files/js/application.js", "diff": "@@ ...", "collapsed": false, "too_large": false, "new_file": false, "renamed_file": false, "deleted_file": false }],
  "compare_timeout": false,
  "compare_same_ref": false,
  "web_url": "https://gitlab.example.com/janedoe/gitlab-foss/-/compare/ae73cb0...0b4bc9a"
}
```
An empty-diff (fully merged) response has `"diffs": []`, `"commits": []` (per docs: "commits array is always complete, even when compare_timeout is true" — for a fully-landed tag, this means it will also be empty, since there are no commits in the tag not already in the default branch), and `compare_same_ref` will be `false` in the common merge-commit case (different SHAs, zero diff).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — greenfield capability | N/A | — | This phase introduces a wholly new capability; there is no prior "old approach" being replaced within Taskflow. The relevant "old" thing being corrected is the existing `released` branch-row's unverified "was merged and deleted" claim (D-08), which predates any actual verification |

**Deprecated/outdated:** None applicable — the GitLab compare/merge_requests endpoints used here are current, stable REST v4 endpoints with no announced deprecation.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | GitLab returns a 4xx (not necessarily exactly 404) with an error body when `from` or `to` in `repository/compare` does not resolve to a valid ref | Pattern 2 (`compareRefs`) | LOW — the code already treats any non-2xx as `compareCheckFailed`, not a specific-status branch, so this is defensive by construction regardless of the exact status code. Worth a planner checkpoint to manually verify against the live GitLab instance if a PAT becomes available, but does not block correct behavior either way |
| A2 | For a fully-merged tag (merge-commit workflow, D-03), `commits[]` in the compare response is also empty, not just `diffs[]` | Pattern 1 (verdict resolver), Code Examples | LOW — D-04 already mandates gating on `diffs.length === 0` specifically, not `commits.length`, so this assumption does not affect the implementation's correctness; it only affects the accuracy of the `commitsNotInDefault` count shown in the `likely-not-merged` tooltip (D-10: "`v33.7.0 has 12 commits not in develop`" — this count should come from `commits.length`, and per GitLab docs this array IS documented as "always complete" even under timeout, unlike `diffs[]`) |
| A3 | A release branch has at most a small number of tracking MRs sourced from it (so pagination completes in 1 page in the overwhelming majority of cases) | Summary, Pattern 3 | LOW — the fetcher is fully paginated regardless (per the fetch-once page-cap lesson), so this assumption affects only expected latency/UX, not correctness |

**All three assumptions are LOW risk** because the implementation pattern chosen (defensive non-2xx handling, D-04's explicit `diffs`-based gate, full pagination regardless) is already correct under either outcome. No assumption here gates a locked user decision or a compliance/security concern — flagging per protocol, but none require a checkpoint:human-verify beyond the general live-GitLab UAT already planned for this phase (see Validation Architecture).

## Open Questions

1. **What tooltip text does a content-compare-derived `merged` verdict show?**
   - What we know: D-10 specifies the tooltip for a tracking-MR-derived `merged` verdict (`via !4821, merged 21.07.2026`) and for `likely-not-merged`/`couldn't-verify`. It does NOT specify wording for the case where the verdict is `merged` via the tag/content-compare fallback (D-02's "falls through to tag comparison" case, when that comparison finds zero diff).
   - What's unclear: Whether this case even needs distinct tooltip wording, or whether D-10's four-state table implicitly assumes `merged` is always MR-sourced (with content-compare only ever producing `likely-not-merged` or feeding back into `merged` silently).
   - Recommendation: The planner should treat this as a small, low-risk gap to close during planning (not re-litigate D-10) — propose wording like `content matches develop — no diff vs {tagName}` for the content-compare-derived `merged` tooltip, keeping the row's icon/color/main-line text identical to the MR-sourced `merged` state per D-10's locked "Merged into {defaultBranch} · {date}" shape (using the tag's commit date in place of `merged_at` — `GitLabTag.commit.created_at` is already fetched via `searchProjectTags`, so a date is available in this path too).

2. **What is `resolveMergeBackVerdict`'s explicit `loading` handling?**
   - What we know: `resolveBranchState` (the model this phase copies) has an explicit `loading` variant so the UI shows "Loading..." rather than guessing a terminal state early. D-10's four listed states (`merged`/`likely-not-merged`/`couldn't-verify`/hidden) do NOT include a `loading` state.
   - What's unclear: Whether "Loading..." should be a fifth internal state of `MergeBackVerdict` (mirroring `BranchState`'s `loading` kind) that the UI-SPEC's Interaction Contract implicitly expects ("Loading state: ... follow the existing pattern used by `branchState.kind === 'loading'`") — the UI-SPEC explicitly requires a loading treatment, so the resolver almost certainly needs a fifth `loading` kind not enumerated in D-09's "four outcomes" framing (D-09 describes the four *terminal/visible* outcomes, and `hidden` already covers the "check cannot be attempted" case, so `loading` is additive, not conflicting).
   - Recommendation: Add a fifth `{ kind: 'loading' }` variant to `MergeBackVerdict` for the case where `releasedVersion && hasMatchedMilestone` but either query is still in flight (`trackingMRs === undefined` before any merged MR is ruled out, or `compareResult === undefined` while a tag lookup is pending) — this is additive to D-09, not a deviation, and matches the sibling module's own precedent plus the UI-SPEC's explicit loading-state requirement. The pseudocode in Pattern 1 above should be revised by the planner to return `{ kind: 'loading' }` instead of the placeholder `couldnt-verify` fallback shown for the "still loading" case.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Live GitLab PAT / reachable GitLab instance | Manual UAT of the actual merge-back verdict against real released versions | ✗ (per STATE.md: "Phase 90: Probe not run — no live GitLab PAT available") | — | Unit/mocked-fetch tests cover all logic paths; live UAT is deferred/flagged the same way Phases 88-90's un-run probes were (recorded as `not-run`, never fabricated) |
| GitLab REST API v4 (`repository/compare`, `merge_requests`) | Both new `gitlab.ts` functions | ✓ (standard, stable, documented REST v4 surface — no special feature flag or GitLab edition requirement found in official docs) | Current GitLab REST API (docs reviewed 2026-08-11, no version-gated behavior noted for these two endpoints) | — |

**Missing dependencies with no fallback:**
- None — the missing live PAT only affects manual UAT depth, which this codebase has already established a documented, non-blocking pattern for (`*-PROBE-RESULTS.md` recorded as `status: not-run`, per Phase 90 precedent).

**Missing dependencies with fallback:**
- Live GitLab PAT: fallback is comprehensive mocked-fetch service tests (`vi.mock`/MSW-style response fixtures) covering the documented response shape (verbatim example above) plus the `compare_timeout: true` and empty-`diffs` cases, following this codebase's existing `useReleaseDetail.test.tsx`/`releaseBranch.test.ts` test-double conventions.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom environment), `@testing-library/react` for component tests |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `npx vitest run src/routes/dashboard/release-detail/mergeBackVerification.test.ts` |
| Full suite command | `npm run test` (= `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| MERGE-01 | "Merged back" row renders one of four visible states (or is hidden) for a released version | component | `npx vitest run src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` | ❌ Wave 0 — new test cases needed in existing file |
| MERGE-01 | Row is hidden for unreleased version / no matched milestone (D-11) | component | same file, same command | ❌ Wave 0 |
| MERGE-01 | Zero extra GitLab calls fire for an unreleased version (D-05) | hook | `npx vitest run src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` | ❌ Wave 0 — extend existing hook test file with a mock-fetch call-count assertion |
| MERGE-02 | `merged` tracking-MR state takes precedence over content comparison | unit | `npx vitest run src/routes/dashboard/release-detail/mergeBackVerification.test.ts` | ❌ Wave 0 |
| MERGE-02 | Closed-but-not-merged MR falls through to tag comparison, not treated as negative (D-02) | unit | same file | ❌ Wave 0 |
| MERGE-02 | No tracking MR + no tag ⇒ `couldnt-verify` (D-01) | unit | same file | ❌ Wave 0 |
| MERGE-02 | No tracking MR + tag exists + empty diff ⇒ `merged` via content (D-04) | unit | same file | ❌ Wave 0 |
| MERGE-02 | No tracking MR + tag exists + non-empty diff ⇒ `likely-not-merged` (D-04) | unit | same file | ❌ Wave 0 |
| MERGE-02 | `compare_timeout: true` ⇒ `couldnt-verify`, never `likely-not-merged` | unit | same file | ❌ Wave 0 |
| MERGE-02 | `fetchSourceBranchMRs` fully paginates (no page-cap) | service | `npx vitest run src/services/gitlab.test.ts` (or new `gitlab.mergeback.test.ts` if the main service test file is split) | ❌ Wave 0 |
| MERGE-02 | `compareRefs` maps `diffs.length` correctly, handles non-2xx as thrown error | service | same file | ❌ Wave 0 |
| MERGE-02 | `compareRefs` and `fetchSourceBranchMRs` use `apiFetch('gitlab', …)`, never raw `fetch` | service (static/lint-adjacent) | code review / grep check, not a runtime test | N/A |
| D-08 | "Release Branch" row's `released`-state wording no longer contains the word "merged" | component | `npx vitest run src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` | ❌ Wave 0 — existing tests at L108-127 assert current wording and must be updated, not just extended |
| MERGE-03 | N/A — descoped by D-12 | — | — | — (no test; explicitly record as descoped in the phase's VERIFICATION.md, same as DASH-06/DRIFT-09) |

### Sampling Rate

- **Per task commit:** targeted `npx vitest run <changed test file>`
- **Per wave merge:** `npm run test` (full suite) + `npm run check` (biome + typecheck gate)
- **Phase gate:** Full suite green before `/gsd-verify-work`, biome gated on "no NEW files flagged" per the documented ~16-diagnostic/5-file baseline drift (do not hardcode a count)

### Wave 0 Gaps

- [ ] `src/routes/dashboard/release-detail/mergeBackVerification.test.ts` — new pure-module test file, covers all MERGE-02 precedence cases above (does not exist yet; sibling to `releaseBranch.test.ts`)
- [ ] Extend `src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` — new "Merged back" row test cases (four visible states + hidden state) + update the two existing `branch-status-released` assertions (L108-127) to match D-08's softened wording (they currently assert `toHaveTextContent('Released')` with a tag, which likely still holds, but must NOT be extended to assert the word "merged" appears — check the exact replacement copy the planner authors against D-08's "e.g. `{branch} deleted · tagged {tag}`" suggestion)
- [ ] Extend `src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` — assert the two new queries are gated correctly (zero calls for unreleased, both called for released with a matched milestone)
- [ ] Extend the GitLab service test file (locate via `find src/services -iname "gitlab*.test.*"`) with mocked-fetch coverage for `fetchSourceBranchMRs` and `compareRefs`, including the `compare_timeout: true` fixture and a paginated (2-page) fixture for the MR fetcher
- [ ] No new test framework/config install needed — Vitest + Testing Library + jsdom are already fully configured project-wide

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | no | This phase adds no new auth surface — reuses the existing GitLab PAT flow (`readSecret('gitlab-pat')`, already wired into `useReleaseDetail.ts`) |
| V3 Session Management | no | N/A — no session concept beyond the existing token read |
| V4 Access Control | no | No permission/role gating is in scope for this milestone (documented Out of Scope in REQUIREMENTS.md — "whole team holds Developer or above"); a 403 from either new endpoint surfaces as a normal `ApiError`/`couldnt-verify`, not a distinct access-control code path |
| V5 Input Validation | yes | `encodeURIComponent` on both `sourceBranch`/`from`/`to` URL params (mirrors `fetchBranchTargetedMRs`'s existing T-89-01 percent-encoding rule, preventing a branch/tag name containing `/` or special characters from injecting extra query params or path segments) |
| V6 Cryptography | no | No cryptographic operation in this phase — the PAT is read via the existing `stronghold`-backed `readSecret`, unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Query-param injection via an unencoded branch/tag name (e.g. a tag or branch containing `&` or `?`) | Tampering | `encodeURIComponent()` on every interpolated ref name in both new URLs — required, matches the established T-89-01 precedent in `fetchBranchTargetedMRs` |
| PAT leakage in error messages | Information Disclosure | Both new functions must follow the established convention: never interpolate `token` or the `PRIVATE-TOKEN` header value into a thrown `Error`/`ApiError` message — only `flattenGitLabError(body)` output or a fixed literal, matching `updateMergeRequest`'s T-90-02 rule |
| Project-id `?? 0` fallback silently hitting an unintended/unauthorized project | Tampering / unintended access | WR-10 — never `?? 0` a project id into either new URL; the two new queries must be gated on `!!activeGitlabProject` exactly like every other GitLab query in `useReleaseDetail.ts` |

## Sources

### Primary (HIGH confidence)
- https://docs.gitlab.com/api/repositories/ — `repository/compare` endpoint: parameters (`from`, `to`, `from_project_id`, `straight`, `unidiff`), full response shape (`commit`, `commits[]`, `diffs[]`, `compare_timeout`, `compare_same_ref`, `web_url`), verbatim JSON example
- https://docs.gitlab.com/api/merge_requests/ — `GET /projects/:id/merge_requests`: `source_branch`, `target_branch`, `state` (default `all`) parameters; project-scoped listing defaults to all project MRs (unlike the global endpoint)
- Direct codebase reads: `releaseBranch.ts`, `releaseBranch.test.ts`, `useReleaseDetail.ts`, `ReleaseDetailSidebar.tsx`, `ReleaseDetailSidebar.test.tsx`, `services/gitlab.ts` (fetchProject, fetchBranch, searchProjectTags, fetchBranchTargetedMRs, flattenGitLabError, updateMergeRequest, GitLabMR/GitLabBranch/GitLabProject interfaces), `mrChannelKeys.ts`, `MetaRow.tsx`

### Secondary (MEDIUM confidence)
- WebSearch cross-verification of the compare endpoint's `straight` semantics and the merge_requests `source_branch` param — both independently confirmed against the official docs fetch above

### Tertiary (LOW confidence)
- WebSearch results on GitLab's undocumented behavior for an invalid/nonexistent ref passed to `repository/compare` — no official-docs statement found; flagged as Assumption A1, mitigated by defensive non-2xx handling regardless of exact status code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, pure extension of well-established in-repo patterns
- Architecture: HIGH — direct 1:1 analog (`resolveBranchState`/`fetchBranch`/`fetchBranchTargetedMRs`) exists for every new piece
- Pitfalls: HIGH — five pitfalls identified, four grounded in this codebase's own documented history (fetch-once page-cap, CR-02/CR-03 precedent, D-01's gate-widening requirement) and one in official GitLab docs (`compare_same_ref` misuse)

**Research date:** 2026-08-11
**Valid until:** 30 days (stable GitLab REST v4 surface; no fast-moving dependency in this phase)
