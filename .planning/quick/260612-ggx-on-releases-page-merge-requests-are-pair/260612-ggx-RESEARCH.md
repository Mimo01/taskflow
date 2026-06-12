# Quick Task 260612-ggx: Warn when a task's MR is on the wrong milestone — Research

**Researched:** 2026-06-12
**Domain:** GitLab REST MR search + react-query conditional fetch (Tauri/React/TS)
**Confidence:** HIGH (codebase-grounded; GitLab params confirmed against official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Warning location — BOTH places:**
  - Release detail page (`ReleaseDetailPage.tsx`): per-task row indicator in the issues table, alongside/replacing the existing "Missing MR" indicator (~lines 812–859). Primary, must-have surface.
  - Releases list view (`ReleasesTab.tsx`): summary badge on the release row indicating ≥1 task has an MR on the wrong milestone (Badge tone `orange`/`red`). Secondary surface, must not regress list performance.
- **Trigger:** warn when the task's MR is on a **different milestone OR has no milestone at all** — any MR linked to the task (by ticket key) that is not in the release's matched milestone.
- **MR states checked:** **all** (opened, merged, closed).
- **Fetch strategy — per task, only when missing:** only run the broader cross-milestone lookup for a task that has NO MR in the release's matched milestone. Tasks with an in-milestone MR are correct; no extra fetch.
- For each missing-MR task, search the project's MRs by ticket key (project-scoped, all states): `/projects/:id/merge_requests?search=<key>&in=title&state=all`. Prefer this over global `searchGitLabMRs` (open-only, cross-project, capped at 20). Reuse `linkEngine.linkMRToTask` / `extractTicketKeys`.

### Claude's Discretion
- Exact wording/icon/tone of the new indicator (keep consistent with existing `AlertTriangle` + orange "Missing MR" styling and `Badge` tone conventions).
- Tooltip copy (should name the MR's actual milestone, e.g. "MR !123 is on milestone X, not this release").
- Caching/query-key shape for per-task MR lookups (follow existing react-query patterns + the milestone-MR query's staleTime).

### Deferred Ideas (OUT OF SCOPE)
- None recorded.
</user_constraints>

## Summary

The detail page already fetches all MRs in the release's matched milestone (`fetchMilestoneMRs`, all states) and links them to Jira issues by ticket key via `linkMRToTask`, producing `matchedRows` where `row.mr === null` is exactly the "Missing MR" case (`ReleaseDetailPage.tsx:319–350, 851–859`). The new warning slots into that `else` branch: for each `row.mr === null` task, search the project for an MR carrying that ticket key (any milestone, any state); if one is found, it is a wrong-milestone MR rather than a genuinely missing one.

The cleanest implementation adds one new service function `searchProjectMRsByKey(baseUrl, token, projectId, key)` to `gitlab.ts` (project-scoped `search=<key>&in=title&state=all`, paginated, label-enrichment reused), and drives it from a `useQueries` block on the detail page — one query per missing-MR task, each `enabled` only when that task lacks an in-milestone MR. This mirrors the existing `useQueries` pattern already used in `ReleasesTab.tsx:183–190` for per-version counts. Milestone comparison should be by **id** (fall back to title) against `matchedMilestone`, treating `mr.milestone === null` as a warn case.

For the list view, a fully accurate badge would require per-task project searches for every rendered release's missing-MR tasks — an unbounded fan-out the CONTEXT explicitly warns against. **Recommendation: graceful degradation** — the list badge should be a bounded/best-effort signal (see Pattern 3), or deferred to a derived check that doesn't fan out. Detail-page row is the hard requirement; the list badge should never block or slow the list render.

**Primary recommendation:** Add `searchProjectMRsByKey` to `gitlab.ts`; drive per-missing-task lookups with `useQueries` on the detail page; compare `mr.milestone?.id` vs `matchedMilestone?.id` (null milestone = warn); keep the list badge bounded/best-effort.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cross-milestone MR search by ticket key | Service (`gitlab.ts`) | — | All GitLab REST access is centralized in `gitlab.ts`; matches `fetchMilestoneMRs` pattern |
| Conditional per-task fetch orchestration | Component (`ReleaseDetailPage.tsx`) react-query | — | Query enable/keys live with the component that knows which rows are missing |
| Ticket-key → MR linking | Pure logic (`linkEngine.ts`) | — | `linkMRToTask`/`extractTicketKeys` already own this; reuse, do not re-implement |
| Milestone comparison | Component (inline) | — | Compares fetched `mr.milestone` against component-derived `matchedMilestone` |
| List-view summary badge | Component (`ReleasesTab.tsx`) | — | Must stay bounded; secondary surface |

## Standard Stack

No new dependencies. Everything is already present:

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@tanstack/react-query` | installed | Conditional/parallel fetches (`useQuery`, `useQueries`) | `useQueries` already used in `ReleasesTab.tsx:183` |
| `@tauri-apps/plugin-http` (via `apiFetch`) | installed | CORS-free GitLab fetch | All `gitlab.ts` calls go through `apiFetch('gitlab', url, …)` |
| `lucide-react` | installed | `AlertTriangle`, `GitMerge` icons | Already imported on the detail page |
| `Badge` (`@/components/ui/badge`) | local | `tone="orange"`/`"red"` warning badges | `tone` governs color; confirmed `tone` prop exists (`badge.tsx`) |

**No install step required.**

## Package Legitimacy Audit

Not applicable — no external packages are installed by this task.

## Architecture Patterns

### Data flow

```
ReleaseDetailPage
  └─ milestoneMRs (fetchMilestoneMRs, state=all)         ← existing
       └─ linkMRToTask → matchedRows[ {issue, mr|null} ]  ← existing
            └─ for each row where mr === null:            ← NEW
                 useQueries → searchProjectMRsByKey(issue.key)
                   └─ pick MRs whose title/branch carry issue.key (extractTicketKeys)
                        └─ compare mr.milestone?.id vs matchedMilestone?.id
                             ├─ found, different/absent milestone → "Wrong milestone" warn
                             └─ none found                        → existing "Missing MR"
```

### Pattern 1: New service function `searchProjectMRsByKey`

**What:** Project-scoped MR search by ticket key, all states, paginated, with the same label-color enrichment as `fetchMilestoneMRs`.

**Why this endpoint:** GitLab's `GET /projects/:id/merge_requests` supports `search` + `in` + `state` (CITED below). The global `searchGitLabMRs` is unsuitable — it is `state=opened` only, cross-project, capped at 20, and returns `[]` on error (`gitlab.ts:1156–1200`).

Signature (mirror `fetchMilestoneMRs` at `gitlab.ts:1050`):
```typescript
// Source: codebase pattern (gitlab.ts:1050 fetchMilestoneMRs); GitLab docs (CITED below)
export async function searchProjectMRsByKey(
  baseUrl: string,
  token: string,
  projectId: number,
  key: string,
): Promise<GitLabMR[]> {
  // GET /api/v4/projects/:id/merge_requests?search=<key>&in=title&state=all&per_page=100 (paged)
  // ...paginate while page is full (same while-loop as fetchMilestoneMRs)...
  // ...reuse the label-color enrichment block from fetchMilestoneMRs...
}
```

Notes:
- `search=<key>` matches the key in the MR **title** (`in=title`). The existing linker also scans `source_branch` (`linkMRToTask`/`linkEngine.ts:73–80`); GitLab MR search does **not** index branch names, so a key that only appears in the branch will be missed by `search`. This is acceptable for the warning (the in-milestone path already covers the common case, and the missing case is the rare tail), but call it out. If branch coverage matters, a fallback `fetchProjectMRs(state='all')` + client-side `linkMRToTask` would catch branch-only keys — at higher cost. **Recommendation: ship with `search=<key>&in=title` and re-run `linkMRToTask` client-side on the returned set** (cheap, and it confirms the key really matches title-or-branch on the returned MRs).
- URL-encode the key: `encodeURIComponent(key)`.
- Reuse the all-states pagination + label enrichment verbatim from `fetchMilestoneMRs`.

### Pattern 2: Conditional per-task fetch with `useQueries` (detail page)

**What:** One query per missing-MR task, each enabled only when its row lacks an in-milestone MR.

**When:** `matchedRows` is known; derive the missing set after `releaseMrByIssue` is built.

```typescript
// Source: codebase pattern — ReleasesTab.tsx:183-190 (useQueries for per-version counts)
const missingRows = matchedRows.filter((r) => r.mr === null);

const wrongMilestoneQueries = useQueries({
  queries: missingRows.map((r) => ({
    queryKey: ['gitlab-mr-by-key', activeGitlabProject, r.issue.key],
    queryFn: () =>
      searchProjectMRsByKey(gitlabBaseUrl ?? '', gitlabToken ?? '', activeGitlabProject ?? 0, r.issue.key),
    enabled:
      !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken &&
      gitlabMatch.type !== 'none',   // no milestone matched ⇒ nothing to compare against
    staleTime: 5 * 60_000,           // match the milestone-MR query staleTime
  })),
});
```

- **Query key** keyed on `[project, key]` (NOT on milestone title) so results are reused across releases and survive milestone renames. staleTime `5 * 60_000` matches every other query on the page.
- `useQueries` is the right primitive — `matchedRows` length is dynamic and `useQuery` cannot be called in a loop (hooks rule). `ReleasesTab.tsx:183` already establishes this exact pattern in the codebase.
- Build a lookup `Map<issueKey, GitLabMR | 'missing'>` from the settled query results, re-running `linkMRToTask(mr, new Set([key]))` on each returned MR to confirm the match, then taking the first whose milestone differs (see Pattern 4).

### Pattern 3: List-view badge — bounded / graceful degradation (ReleasesTab)

**Current list data (per release):** `ReleasesTab` fetches only fix versions, milestones, and **issue counts** (`versionCountQueries`, `ReleasesTab.tsx:183`). It has **no per-release issue list and no milestone-MR data** — the detail page is the first place those load. So the list cannot today tell whether any task has a wrong-milestone MR without adding, per rendered release: (a) the fix-version issue list, (b) the milestone-MR list, and (c) per-missing-task project searches. That is the unbounded fan-out the CONTEXT warns against.

**Recommendation (bounded):** Do **not** eagerly compute the accurate badge for every release. Options, cheapest first:
1. **Defer/omit when data absent (graceful degradation):** show the badge only for releases whose detail data is already in the react-query cache (e.g. the user has visited that release). Read cached `['gitlab-mr-by-key', …]` / milestone-MR results via `queryClient.getQueryData` and render the badge only when a wrong-milestone MR is already known. No new fan-out; badge appears after a visit. **Lowest risk — recommended.**
2. **On-visible bounded fetch:** only the releases currently rendered (the list already paginates released versions via `releasedVisible`, `ReleasesTab.tsx:110/326`) trigger their detail-style computation lazily. Still costly; only pursue if (1) is judged insufficient.

Detail row is must-have; the list badge is secondary and must not regress list-view performance — option (1) honors both.

### Anti-Patterns to Avoid
- **Do not** reuse `searchGitLabMRs` (open-only, capped 20, cross-project). It will silently miss merged/closed MRs and wrong-project noise.
- **Do not** call `useQuery` in a `.map`/loop — use `useQueries`.
- **Do not** key the per-task query on milestone title — key on `[project, issueKey]` so a milestone rename doesn't strand results and results are shared across releases.
- **Do not** eagerly fan out per-task searches across all list rows.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Extract Jira key from MR title/branch | Custom regex | `extractTicketKeys` / `linkMRToTask` (`linkEngine.ts`) | Handles space-separated keys, dedupe, branch fallback, false-match guards |
| Parallel conditional fetches | Manual Promise.all + state | `useQueries` | Caching, dedupe, `enabled` gating; matches `ReleasesTab.tsx:183` |
| MR label color enrichment | New label fetch | Copy the enrichment block from `fetchMilestoneMRs` | Already solved; labels arrive as strings and need project label colors |
| GitLab fetch w/ auth + timeout + CORS | Raw `fetch` | `apiFetch('gitlab', …)` | PRIVATE-TOKEN, 15s timeout, dev instrumentation, disconnect marking |

## Milestone Comparison Correctness

- `GitLabMR.milestone` shape: `{ id: number; title: string } | null` (`gitlab.ts:255`).
- `matchedMilestone` on the detail page is a full `GitLabMilestone | null` with `.id` and `.title` (`ReleaseDetailPage.tsx:261–304`).
- **Compare by `id`** (stable across renames): warn when
  ```
  matchedMilestone != null && (mr.milestone == null || mr.milestone.id !== matchedMilestone.id)
  ```
  `mr.milestone == null` (no milestone) is a warn case per the locked trigger. Fall back to title comparison only if an id is unexpectedly absent (shouldn't happen — both carry numeric `id`).
- Guard: if `gitlabMatch.type === 'none'` (no milestone matched at all), there is nothing to compare against — keep the existing "—/no milestone matched" rendering and skip the per-task search entirely (the `enabled` gate in Pattern 2 already does this).
- Tooltip can read the offending MR's actual milestone: `mr.milestone?.title ?? 'no milestone'`.

## Common Pitfalls

### Pitfall 1: Fetch-once page-cap (project memory)
**What goes wrong:** Pickers fetch one capped page and filter client-side, dropping matches beyond page 1 (recurring bug: mr-discussions-cap-20, assignee-missing-users).
**How to avoid:** `searchProjectMRsByKey` must paginate (while-loop, stop on a short page) like `fetchMilestoneMRs` — not a single `per_page=20`. In practice a single ticket key matches very few MRs, but page through anyway to stay consistent and correct.

### Pitfall 2: `search` does not cover branch-only keys
**What goes wrong:** GitLab `search=<key>&in=title` matches title (and optionally description), not `source_branch`. A key present only in the branch name won't be returned, so a real (branch-tagged) wrong-milestone MR could be missed.
**How to avoid:** Acceptable for a best-effort warning. If branch coverage is required, fall back to `fetchProjectMRs(projectId, 'all')` + client-side `linkMRToTask` — but that fetches the whole project MR set (costly). Default: title search + re-run `linkMRToTask` on results.

### Pitfall 3: Unbounded list-view fan-out
**What goes wrong:** Computing the accurate list badge for every release multiplies (releases × missing tasks) GitLab calls — rate-limit and latency risk.
**How to avoid:** Use the cache-only/graceful-degradation badge (Pattern 3, option 1). Never eagerly fan out.

### Pitfall 4: Label enrichment double work / rate
**What goes wrong:** Each MR-list fetch separately fetches project labels for color (`fetchMilestoneMRs`/`fetchProjectMRs`). Per-missing-task searches each repeat this.
**How to avoid:** For the warning we only need `mr.milestone` and `mr.iid/web_url/state` — label colors are irrelevant to this feature. Consider skipping label enrichment in `searchProjectMRsByKey` (return raw MRs) to save one labels call per query, or accept the cost since the existing functions already pay it. Recommend **skipping label enrichment** in the new function (the warning never renders MR labels).

## State of the Art

No framework shifts relevant here. `useQueries` (object form) is the current TanStack Query v5 API and is already used in the codebase (`ReleasesTab.tsx:183`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A single ticket key matches few MRs, so pagination rarely exceeds page 1 | Pitfall 1 | Low — pagination loop is correct regardless |
| A2 | Branch-only keys are rare enough to accept title-search miss | Pattern 1 / Pitfall 2 | Medium — a branch-tagged MR on wrong milestone could be silently missed; planner may opt for the `fetchProjectMRs('all')` fallback if accuracy is paramount |
| A3 | List badge graceful-degradation (cache-only) is acceptable per CONTEXT's "must not regress performance" | Pattern 3 | Low — CONTEXT explicitly favors bounded/degrade over fan-out |

## Open Questions

1. **Branch-only key coverage** — accept title-search miss (cheap) or add `fetchProjectMRs('all')` fallback (accurate, costly)? Recommendation: ship title-search; revisit if QA finds missed branch-tagged MRs.
2. **List badge fidelity** — is a cache-only "appears after visiting the release" badge acceptable, or must it be accurate on first render? Recommendation: cache-only; the detail row is the authoritative surface.

## Sources

### Primary (HIGH confidence)
- Codebase: `taskflow/src/services/gitlab.ts` (fetchMilestoneMRs:1050, fetchProjectMRs:954, searchGitLabMRs:1156, GitLabMR shape:243-256), `taskflow/src/services/linkEngine.ts` (linkMRToTask:73, extractTicketKeys:41), `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` (milestone match:261-304, milestone-MR query:319-331, matchedRows/Missing-MR:347-859), `taskflow/src/routes/dashboard/ReleasesTab.tsx` (useQueries per-version:183-190, list data scope, releasedVisible pagination), `taskflow/src/services/releaseLinker.ts`.
- [CITED: docs.gitlab.com/ee/api/merge_requests.html] — `GET /projects/:id/merge_requests` supports `search` ("against their title and description, combine with in"), `in` ("title, description, or comma-joined; default title,description"), `state` ("all/opened/closed/locked/merged, default all"), `milestone` ("None / Any"), and `page`/`per_page` pagination.

### Secondary (MEDIUM confidence)
- Project memory: fetch-once page-cap pitfall (`project_fetch_once_pagecap_pitfall.md`).

## Metadata

**Confidence breakdown:**
- Service/endpoint: HIGH — GitLab params confirmed in official docs; mirrors existing `fetchMilestoneMRs`.
- react-query wiring: HIGH — `useQueries` pattern already in the codebase.
- List badge strategy: MEDIUM — recommendation is sound but the exact fidelity is a planner/UX call.
- Milestone comparison: HIGH — shapes verified in source.

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable codebase + stable GitLab REST API)
