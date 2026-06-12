---
phase: quick-260612-ggx
plan: 01
subsystem: releases
tags: [gitlab, releases, merge-requests, react-query]
requires:
  - GitLabMR.milestone shape
  - linkMRToTask / extractTicketKeys (linkEngine)
  - matchedMilestone derivation (ReleaseDetailPage)
provides:
  - searchProjectMRsByKey (project-scoped, all-states, paginated MR search by ticket key)
  - Wrong-milestone detail-row indicator
  - Cache-only wrong-milestone list badge
affects:
  - ReleaseDetailPage MR cell
  - ReleasesTab release rows
tech-stack:
  added: []
  patterns: [useQueries per-missing-row, cache-only badge via queryClient.setQueryData/getQueryData]
key-files:
  created: []
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/gitlab.test.ts
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/lib/query-constants.ts
decisions:
  - "List badge attribution via a detail-page-seeded cache entry (['gitlab-wrong-milestone', project, versionId]) — keeps the list path read-only with no GitLab fan-out while giving accurate per-release attribution"
  - "searchProjectMRsByKey skips label-color enrichment (warning never renders MR labels)"
metrics:
  duration: ~15m
  completed: 2026-06-12
---

# Phase quick-260612-ggx Plan 01: Wrong-milestone MR warning Summary

Distinguishes a genuinely-missing MR from an MR that exists but sits on the wrong
GitLab milestone, on both the release detail page (primary, per-task) and the releases
list (secondary, cache-only badge).

## What Changed

> **Commit note:** the executor ran in an isolated worktree branched (per a known
> EnterWorktree base-drift) from before the pre-dispatch plan commit, so its original
> hashes (`74d3877f`, `6487399d`) were cherry-picked onto `main` as `c64c3387` and
> `84fd8189`. A follow-up code-review fix landed as `e5d541a4` (see below).

### Task 1 — `searchProjectMRsByKey` service (commit `c64c3387`, orig `74d3877f`)
- Added `searchProjectMRsByKey(baseUrl, token, projectId, key): Promise<GitLabMR[]>` to
  `gitlab.ts`, modeled on `fetchMilestoneMRs`:
  - Hits `GET /api/v4/projects/:id/merge_requests?search=<key>&in=title&state=all&per_page=100&page=N`
    with the key URL-encoded via `encodeURIComponent`.
  - Paginates with the same while-loop (stops on a short page).
  - Error handling matches `fetchMilestoneMRs`: unreachable host → `Cannot reach …`,
    401/403 → `ApiError`, other non-ok → status error.
  - Intentionally skips the label-color enrichment block (warning never renders labels).
- Added 6 unit tests (`gitlab.test.ts`): URL params (`search`/`in=title`/`state=all`),
  special-char encoding, two-page pagination concatenation + stop-on-short-page,
  single-short-page no second request, unreachable → throws, 401/403 → throws.

### Task 2 — Wire warning into detail row + list badge (commit `84fd8189`, orig `6487399d`)
- **ReleaseDetailPage.tsx**:
  - Imports `useQueries` and `searchProjectMRsByKey`.
  - Derives `missingRows = matchedRows.filter(r => r.mr === null)` and runs a `useQueries`
    block — one query per missing row, keyed `['gitlab-mr-by-key', project, issueKey]`,
    `enabled` only when GitLab creds exist and a milestone matched, `staleTime` 5 min.
  - Builds `wrongMilestoneByKey`: for each missing row, re-runs `linkMRToTask` to confirm
    the key matches, then picks the first MR whose milestone differs from (or is absent vs.)
    the matched milestone (compare by `id`; null milestone = warn).
  - MR cell now renders a distinct "Wrong milestone" indicator (AlertTriangle + orange)
    with a tooltip naming the offending MR's milestone
    (`MR !<iid> is on milestone <title|no milestone>, not this release`); the in-milestone
    and plain Missing-MR branches are unchanged.
  - Seeds `['gitlab-wrong-milestone', project, versionId]` → `string[]` of wrong-milestone
    issue keys via `queryClient.setQueryData` for the list to read.
- **ReleasesTab.tsx**:
  - Renders a `<WrongMilestoneBadge>` per release row that **reactively** subscribes to the
    seeded cache entry (see code-review fix below). Orange `⚠ MR milestone` `Badge` (with
    `title` tooltip) appears once that release's detail view has been visited and found ≥1
    wrong-milestone MR. Absent cache → no badge (graceful degradation).

### Code-review follow-up (commit `e5d541a4`)
Two findings from the `--full` code review were fixed before completion:
- **WR-01 (reactivity):** the list badge originally read the cache imperatively in render
  (`queryClient.getQueryData`), so it never re-rendered when the detail page seeded the
  entry. Replaced with a fetch-disabled `useQuery` subscription in a new
  `WrongMilestoneBadge` component (`enabled: false` → no GitLab fetch, but re-renders on
  `setQueryData`).
- **WR-02 (key drift / collision):** extracted a shared `wrongMilestoneMRKey()` helper in
  `lib/query-constants.ts`, used by both the detail-page writer and the list reader, and
  included the GitLab base URL in the key to avoid cross-instance project-id collisions.

## Verification

- `npx vitest run src/services/gitlab.test.ts` — **71 passed** (6 new `searchProjectMRsByKey` tests).
- `npm run check` (biome + tsc) — **GREEN** (467 files, no warnings/errors).

## Deviations from Plan

### Rule 3 — Blocking issue (environment)
- **Found during:** Task 1 (running vitest).
- **Issue:** The worktree's `taskflow/node_modules` was absent, so vitest failed to load
  its config (`Cannot find package '@vitejs/plugin-react'`).
- **Fix:** Symlinked `taskflow/node_modules` → the main repo's
  `…/taskflow/taskflow/node_modules`. This is a gitignored environment artifact (verified
  via `git check-ignore`) — not committed and not a package install.
- **Files modified:** none committed.

### Implementation choice — list badge attribution
The plan left the exact cache-only attribution to Claude's discretion ("simplest safe
signal… bounded, cache-only, no fetch"). Rather than trying to reverse-derive
release→issue mapping from raw `['gitlab-mr-by-key', …]` cache entries on the list path
(ambiguous across releases), the detail page seeds a release-attributed entry
`['gitlab-wrong-milestone', project, versionId]`. The list reads it directly — accurate
per-release attribution with zero list-render fetch/fan-out. No other deviations.

## Self-Check: PASSED
- Commits on main: `c64c3387`, `84fd8189`, `e5d541a4`.
- Files present: `gitlab.ts`, `gitlab.test.ts`, `ReleaseDetailPage.tsx`, `ReleasesTab.tsx`, `lib/query-constants.ts`.
