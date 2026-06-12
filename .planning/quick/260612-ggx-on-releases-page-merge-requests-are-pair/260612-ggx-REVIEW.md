---
phase: quick-260612-ggx-wrong-milestone-mr-warning
reviewed: 2026-06-12T10:11:04Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/ReleasesTab.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Quick 260612-ggx: Code Review Report

**Reviewed:** 2026-06-12T10:11:04Z
**Depth:** quick
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the diff for commits `c64c3387` and `84fd8189` against `6e13b93f` — a
feature that warns when a task's MR exists but is on the wrong release milestone.

The implementation is largely sound on the dimensions the prompt flagged:

- **useQueries correctness:** Hooks are placed before any early return (`if
  (!versionId) return null` is at line 641, well after `useQueries` at 360 and the
  `useEffect` at 400) — no conditional-hook violation. The `enabled` gate
  (`!!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && gitlabMatch.type
  !== 'none'`) is correct and prevents fan-out before context is ready.
- **Query keys:** `['gitlab-mr-by-key', project, key]` is keyed on project+key (not
  milestone title), so results survive milestone renames and are shared across
  releases as intended. Good.
- **Milestone id comparison + null handling:** `mr.milestone == null ||
  mr.milestone.id !== matchedMilestone.id` is type-safe (`number` vs `number`) and
  treats a null milestone as a warn case per the locked trigger. Correct.
- **Pagination:** `data.length < perPage` break with `per_page=100` is correct;
  tests cover the full-page/short-page boundary. `state=all` is valid (already used
  by the adjacent `fetchMilestoneMRs` at line 1062).
- **List badge avoids new GitLab calls:** `ReleasesTab.hasWrongMilestoneMR` only
  calls `queryClient.getQueryData(...)` — pure cache read, no fetch, no
  `useQueries`. The fan-out lives only on the detail page. Confirmed.

No blockers found. Two warnings (one reactivity bug surfacing as a stale/missing
badge, one cross-release cache-key collision risk) and three info items below.

## Warnings

### WR-01: List badge reads query cache non-reactively — badge is stale / won't appear until an unrelated re-render

**File:** `taskflow/src/routes/dashboard/ReleasesTab.tsx:240-247`
**Issue:** `hasWrongMilestoneMR` calls `queryClient.getQueryData(...)` directly in the
render body. `getQueryData` is a one-shot imperative read — it does NOT subscribe
the component to that cache entry. When the detail page later seeds
`['gitlab-wrong-milestone', project, versionId]` via `setQueryData`, `ReleasesTab`
is not re-rendered, so the badge does not appear until some *other* state change
forces a re-render of the list. The reverse is also true: if the cached array is
later cleared/updated, the badge won't update reactively. The "cache-only, no
fan-out" goal is met, but the badge's appearance is effectively non-deterministic
from the user's perspective (works only after navigating back-and-forth or
triggering an unrelated refresh).
**Fix:** Subscribe reactively instead of reading imperatively. Either drive the
badge from a `useQuery` with the same key and a no-op/`enabled:false` fetcher so the
row re-renders when the cache entry is seeded:
```ts
const { data: wrongKeys } = useQuery<string[]>({
  queryKey: ['gitlab-wrong-milestone', activeGitlabProject, version.id],
  enabled: false, // never fetch; detail page seeds it via setQueryData
});
const hasWrongMilestoneMR = Array.isArray(wrongKeys) && wrongKeys.length > 0;
```
(extract a small child component per row, or use `useQueries` over the version
list, so each row subscribes to its own key). If non-reactivity is genuinely
acceptable, document it explicitly as a known limitation in the comment so it isn't
later mistaken for a bug.

### WR-02: `gitlab-wrong-milestone` cache key omits `gitlabBaseUrl` — possible cross-instance/cross-account collision and the writer/reader keys must stay in lockstep

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:403` (writer) and `taskflow/src/routes/dashboard/ReleasesTab.tsx:241-245` (reader)
**Issue:** The seeded key is `['gitlab-wrong-milestone', activeGitlabProject,
versionId]`. `activeGitlabProject` is a numeric project id that is only unique within
a single GitLab instance; the sibling queries in this file (e.g.
`gitlab-milestone-mrs`) are also project-scoped, so this is consistent with existing
patterns — but if a user can switch GitLab base URLs/accounts while project ids
collide (id 42 on instance A vs instance B), a stale badge from the other instance
could be read. Lower-likelihood, but worth noting. More importantly, the writer
(detail page) and reader (list) duplicate this key literal across two files; any
future change to one must be mirrored in the other or the badge silently breaks.
**Fix:** Extract the key into a shared helper so writer and reader cannot drift, and
include the instance scope if multi-instance switching is supported:
```ts
// lib/releaseCacheKeys.ts
export const wrongMilestoneKey = (project: number | null, versionId: string) =>
  ['gitlab-wrong-milestone', project, versionId] as const;
```
Use it in both `setQueryData` and `getQueryData`.

## Info

### IN-01: `searchProjectMRsByKey` searches `in=title` only, so branch-only key matches are silently missed

**File:** `taskflow/src/services/gitlab.ts:1182`
**Issue:** The query uses `in=title`, but the downstream `linkMRToTask` matches by
title OR `source_branch`. An MR that carries the key only in its branch name (a
common convention) will never be returned by the search, so its "wrong milestone"
state is undetectable. The docstring (lines 1158-1160) acknowledges this, so it is a
documented limitation rather than a defect — flagging for visibility since it
narrows the feature's coverage.
**Fix:** None required if accepted. If branch coverage matters, add a second search
pass with `in=description` is not sufficient; GitLab MR search cannot query branch
names, so the alternative is fetching `state=all` MRs unfiltered and matching
client-side via `linkMRToTask` (heavier). Keep as-is unless users report misses.

### IN-02: `searchProjectMRsByKey` includes `Content-Type: application/json` on a GET with no body

**File:** `taskflow/src/services/gitlab.ts:1175`
**Issue:** The request is a GET (no body) but sets `'Content-Type':
'application/json'`. Harmless, but unnecessary and inconsistent with intent. This
mirrors other functions in the file, so it is a pre-existing house style rather than
a new defect.
**Fix:** Optionally drop the `Content-Type` header for GET requests. Cosmetic.

### IN-03: First-match selection in `wrongMilestoneByKey` is order-dependent across paginated/multi-state results

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:386-392`
**Issue:** `mrs.find(...)` picks the FIRST returned MR whose milestone differs. Since
the row is in `missingRows` only when no MR matched in the *matched milestone's* MR
set (the `milestoneMRs` query filters by `milestone=<title>`), every MR returned for
that key is by construction on a different/absent milestone — so the predicate is
effectively always true and "first" is fine here. However, if multiple wrong-place
MRs exist (e.g. opened on milestone X and merged on milestone Y), the tooltip
reports whichever GitLab returns first, which is non-deterministic ordering. The
comment claims "pick the FIRST whose milestone differs" as if a same-milestone MR
could be skipped, but that case cannot arise given how `missingRows` is derived — the
comment slightly overstates the logic.
**Fix:** None functionally required. Optionally sort candidates (e.g. prefer
`merged`, then most-recent `updated_at`) for a stable, more meaningful tooltip, and
tighten the comment to match actual behavior.

---

_Reviewed: 2026-06-12T10:11:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
