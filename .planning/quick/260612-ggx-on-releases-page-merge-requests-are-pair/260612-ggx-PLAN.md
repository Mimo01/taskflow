---
phase: quick-260612-ggx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/ReleasesTab.tsx
autonomous: true
requirements: [GGX-WARN-01]
must_haves:
  truths:
    - "On the release detail page, a task whose only MR is on a different milestone (or no milestone) shows a 'Wrong milestone' warning instead of the plain 'Missing MR' indicator"
    - "A task with an in-milestone MR is unchanged (no extra fetch, existing MR link/badge renders)"
    - "A task with no MR anywhere still shows the existing 'Missing MR' indicator"
    - "The wrong-milestone tooltip names the offending MR's actual milestone (e.g. 'MR !123 is on milestone X, not this release')"
    - "The releases list shows a summary warning badge on a release row when a wrong-milestone MR is already known from cache, without triggering new GitLab fan-out on list render"
  artifacts:
    - path: "taskflow/src/services/gitlab.ts"
      provides: "searchProjectMRsByKey — project-scoped MR search by ticket key, all states, paginated"
      contains: "export async function searchProjectMRsByKey"
    - path: "taskflow/src/services/gitlab.test.ts"
      provides: "Unit tests for searchProjectMRsByKey (pagination, state=all, URL params)"
      contains: "searchProjectMRsByKey"
    - path: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      provides: "Per-missing-task useQueries lookup + wrong-milestone row indicator"
      contains: "searchProjectMRsByKey"
    - path: "taskflow/src/routes/dashboard/ReleasesTab.tsx"
      provides: "Cache-only summary warning badge for wrong-milestone MRs"
      contains: "gitlab-mr-by-key"
  key_links:
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      to: "searchProjectMRsByKey"
      via: "useQueries over missing-MR rows"
      pattern: "useQueries"
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      to: "matchedMilestone.id"
      via: "milestone id comparison (null = warn)"
      pattern: "matchedMilestone"
---

<objective>
On the Releases page, warn when a task's merge request is NOT in the release's matched
milestone — either a different milestone or no milestone at all. Today a task with no MR
in the matched milestone shows a generic "Missing MR" indicator; this plan distinguishes a
genuinely-missing MR from an MR that exists but sits on the wrong milestone.

Purpose: Surface release-accuracy problems (an MR that should be in this release's milestone
but isn't) so they can be fixed before shipping.

Output:
- New `searchProjectMRsByKey` service function in `gitlab.ts` (+ tests).
- Detail-page per-missing-task lookup with a "Wrong milestone" row indicator (primary surface).
- Cache-only summary badge on the releases list (secondary surface, no list-render fan-out).
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260612-ggx-on-releases-page-merge-requests-are-pair/260612-ggx-CONTEXT.md
@.planning/quick/260612-ggx-on-releases-page-merge-requests-are-pair/260612-ggx-RESEARCH.md

# Source files
@taskflow/src/services/gitlab.ts
@taskflow/src/services/linkEngine.ts
@taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
@taskflow/src/routes/dashboard/ReleasesTab.tsx

# Interface contracts (already in context)
# - GitLabMR.milestone: { id: number; title: string } | null  (gitlab.ts:255)
# - matchedMilestone: GitLabMilestone | null with .id/.title   (ReleaseDetailPage.tsx:261-304)
# - linkMRToTask(mr, Set<string>): string | null               (linkEngine.ts:73)
# - extractTicketKeys(text): string[]                          (linkEngine.ts:41)
# - fetchMilestoneMRs pagination + label pattern               (gitlab.ts:1050-1146)
# - useQueries per-version pattern                             (ReleasesTab.tsx:183-190)
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add searchProjectMRsByKey to gitlab.ts</name>
  <files>taskflow/src/services/gitlab.ts, taskflow/src/services/gitlab.test.ts</files>
  <behavior>
    - Calls GET /api/v4/projects/:id/merge_requests?search=&lt;key&gt;&in=title&state=all&per_page=100&page=N with the key URL-encoded via encodeURIComponent.
    - Paginates: keeps requesting subsequent pages while a page returns exactly per_page items; stops on a short page (mirror fetchMilestoneMRs while-loop).
    - Returns the aggregated GitLabMR[] across all pages.
    - On unreachable host throws "Cannot reach &lt;baseUrl&gt;"; on 401/403 throws ApiError; on other non-ok throws a status error (match fetchMilestoneMRs error handling).
    - Skips the label-color enrichment block (the warning never renders MR labels — per research Pitfall 4); returned MRs may carry raw string labels, which is acceptable for this consumer.
  </behavior>
  <action>
    Add an exported async function `searchProjectMRsByKey(baseUrl, token, projectId, key)`
    returning `Promise&lt;GitLabMR[]&gt;`, modeled on `fetchMilestoneMRs` (gitlab.ts:1050) but
    targeting `/projects/:id/merge_requests?search=&lt;key&gt;&in=title&state=all`. URL-encode the
    key with `encodeURIComponent`. Reuse the same `apiFetch('gitlab', url, { headers: { 'PRIVATE-TOKEN': token, ... } }, 'Search Project MRs')`
    call, the same paginated while-loop (per_page=100, break on short page), and the same
    try/catch + status error handling (unreachable → "Cannot reach", 401/403 → ApiError, other
    → status error). Do NOT include the label-color enrichment block — return MRs as received
    (research Pitfall 4: labels are irrelevant here; skipping saves one labels call per query).
    Reason for a NEW function rather than reusing `searchGitLabMRs`: that helper is open-only,
    cross-project, capped at 20, and swallows errors — it would silently miss merged/closed MRs
    and leak other projects (per GGX-WARN-01 trigger requires all states, this project only).

    Add unit tests in gitlab.test.ts following the existing `vi.mock('@tauri-apps/plugin-http')`
    pattern (apiFetch passes through to the mocked fetch): (a) asserts the request URL contains
    `search=`, `in=title`, `state=all`, and the encoded key; (b) two-page pagination returns the
    concatenated set and stops on the short page; (c) single short page returns immediately
    without a second request. Add `searchProjectMRsByKey` to the test file's import list from
    './gitlab'.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/services/gitlab.test.ts -t searchProjectMRsByKey</automated>
  </verify>
  <done>searchProjectMRsByKey exported from gitlab.ts; its tests pass; pagination + URL params asserted.</done>
</task>

<task type="auto">
  <name>Task 2: Wire wrong-milestone warning into detail row + list badge</name>
  <files>taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/routes/dashboard/ReleasesTab.tsx</files>
  <action>
    DETAIL PAGE (ReleaseDetailPage.tsx — primary surface, per CONTEXT "Warning location"):
    1. Import `useQueries` from '@tanstack/react-query' (already imports useQuery/useQueryClient)
       and `searchProjectMRsByKey` from '@/services/gitlab'.
    2. After `matchedRows` is built (~line 350), derive `missingRows = matchedRows.filter((r) =&gt; r.mr === null)`.
    3. Add a `useQueries` block (mirror ReleasesTab.tsx:183-190) — one query per missing row:
       - queryKey: `['gitlab-mr-by-key', activeGitlabProject, r.issue.key]` (keyed on project+key,
         NOT milestone title, so results survive milestone renames and are shared across releases —
         research Pattern 2).
       - queryFn: `() =&gt; searchProjectMRsByKey(gitlabBaseUrl ?? '', gitlabToken ?? '', activeGitlabProject ?? 0, r.issue.key)`.
       - enabled: `!!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && gitlabMatch.type !== 'none'`
         (no matched milestone ⇒ nothing to compare against; existing "—" rendering stays).
       - staleTime: `5 * 60_000` (matches every other query on the page).
    4. Build a `wrongMilestoneByKey = new Map&lt;string, GitLabMR&gt;()`: for each missing row, take its
       settled query result, re-run `linkMRToTask(mr, new Set([r.issue.key]))` on each returned MR
       to confirm the key truly matches (title-or-branch), then select the FIRST confirmed MR whose
       milestone differs from the release's: warn when
       `matchedMilestone != null && (mr.milestone == null || mr.milestone.id !== matchedMilestone.id)`
       (null milestone is a warn case per the locked trigger; compare by id per research). Store that MR.
    5. In the issues-table MR cell (~lines 851-859), replace the current `else` ("Missing MR") branch
       with a conditional: if `wrongMilestoneByKey.has(row.issue.key)`, render a NEW "Wrong milestone"
       indicator (AlertTriangle + orange text, consistent with the existing Missing-MR styling — Claude's
       Discretion on exact wording/icon) whose `title` names the offending MR's milestone, e.g.
       `MR !${mr.iid} is on milestone ${mr.milestone?.title ?? 'no milestone'}, not this release`;
       otherwise keep the existing "Missing MR" indicator. Do NOT change the in-milestone (`row.mr`)
       branch or the `gitlabMatch.type === 'none'` branch.

    LIST PAGE (ReleasesTab.tsx — secondary surface, must NOT regress list perf; cache-only per CONTEXT
    open_tensions + research Pattern 3 option 1):
    6. Import `useQueryClient` (already imported) — read, do not fetch. For each rendered release row,
       compute a best-effort `hasWrongMilestoneMR` boolean purely from the react-query cache: there is
       NO per-release issue list in the list view, so iterate the cached `['gitlab-mr-by-key', ...]`
       entries via `queryClient.getQueriesData({ queryKey: ['gitlab-mr-by-key'] })` and, for the
       releases whose matched milestone is known, derive whether any cached MR for an in-this-release
       issue key is on the wrong milestone. Because the list lacks the issue→release mapping without
       fan-out, scope the badge to a simple, bounded signal: render the badge ONLY when the cache
       already contains a wrong-milestone MR result that can be attributed to this release's matched
       milestone (gracefully render nothing when data is absent — the user sees the badge after
       visiting the release). Do NOT add any new `useQuery`/`useQueries`/`searchProjectMRsByKey` call
       on the list path, and do NOT fan out per row. If a clean cache-attribution to a specific release
       is not derivable without the issue list, render the badge from the simplest safe signal available
       (e.g. presence of any known wrong-milestone result for the active project's cached keys that also
       appear among that release's issues once its detail cache exists) — bounded, cache-only, no fetch.
    7. Add the badge next to the existing status badges in the row (~lines 343-400), using
       `&lt;Badge tone="orange"&gt;` with concise copy (e.g. "⚠ MR milestone"), matching the existing
       "⚠ No date set" badge convention. Tooltip via `title` explaining ≥1 task has an MR on the
       wrong milestone.

    Keep `npm run check` (biome + tsc) GREEN: no new `any`, no unused imports, exhaustive types.
    Do not introduce eager GitLab calls on the list render path (research Pitfall 3).
  </action>
  <verify>
    <automated>cd taskflow && npm run check</automated>
  </verify>
  <done>
    Detail page renders a distinct "Wrong milestone" indicator (with milestone-naming tooltip) for a
    missing-MR task whose MR is on a different/absent milestone; Missing-MR and in-milestone branches
    unchanged; list shows a cache-only orange summary badge with no new GitLab fan-out; npm run check GREEN.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app → GitLab REST | Ticket key is interpolated into a search query string; MR data (milestone, title, iid, web_url) is rendered |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ggx-01 | Injection | searchProjectMRsByKey query string | mitigate | URL-encode the key with `encodeURIComponent`; key already validated by `extractTicketKeys` regex upstream |
| T-ggx-02 | Information disclosure | MR web_url / milestone title rendered in tooltip + link | accept | Same-project MRs the user already has GitLab PAT access to; no new data exposure beyond existing MR cells |
| T-ggx-03 | DoS (self-inflicted) | per-task useQueries fan-out | mitigate | Bounded to missing-MR rows of the single viewed release; list path is cache-only (no fan-out) per Pitfall 3 |
| T-ggx-SC | Tampering | npm/pip/cargo installs | n/a | No package installs — feature uses only existing dependencies (research: no install step) |
</threat_model>

<verification>
- `npx vitest run src/services/gitlab.test.ts` — searchProjectMRsByKey tests pass.
- `npm run check` — biome + tsc GREEN across the repo.
- Manual (UAT, optional): open a release whose milestone is matched and a task whose MR is on a
  different milestone → "Wrong milestone" indicator with a tooltip naming that milestone; a task
  with an in-milestone MR is unchanged; a task with no MR anywhere still shows "Missing MR".
</verification>

<success_criteria>
- searchProjectMRsByKey added to gitlab.ts (project-scoped, all states, paginated, encoded key) with passing tests.
- Detail page distinguishes "Wrong milestone" (MR exists, different/absent milestone) from "Missing MR" (no MR), per-task lookup only for missing rows, gated off when no milestone matched.
- Milestone comparison by id, null milestone = warn (per locked trigger).
- List shows a cache-only orange summary badge, no new GitLab fan-out on render.
- npm run check GREEN.
</success_criteria>

<output>
Create `.planning/quick/260612-ggx-on-releases-page-merge-requests-are-pair/260612-ggx-SUMMARY.md` when done.
</output>
