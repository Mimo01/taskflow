---
phase: quick-260612-ggx
verified: 2026-06-12T12:16:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  note: "Initial verification (no prior VERIFICATION.md)"
---

# Quick Task 260612-ggx: Wrong-milestone MR warning — Verification Report

**Task Goal:** On the Releases page, add a warning when a task has a merge request but that MR is not in the release's milestone (a different milestone, or no milestone at all).
**Verified:** 2026-06-12T12:16:00Z
**Status:** passed
**Re-verification:** No — initial verification

> Note: SUMMARY.md cites commits `74d3877f` / `6487399d`, but the merged work landed on main as
> `c64c3387`, `84fd8189`, `e5d541a4` (the third — reactive badge + shared cache key — post-dates the
> SUMMARY). The codebase, not the SUMMARY, was used as the source of truth; all claims verified against
> the actual files.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A task whose only MR is on a different/absent milestone shows a "Wrong milestone" warning instead of "Missing MR" | ✓ VERIFIED | `ReleaseDetailPage.tsx:914-929` — `wrongMilestoneByKey.has(row.issue.key)` branch renders AlertTriangle + orange "Wrong milestone" ahead of the plain Missing-MR `else` branch (930-937) |
| 2 | A task with an in-milestone MR is unchanged (no extra fetch) | ✓ VERIFIED | `missingRows = matchedRows.filter(r => r.mr === null)` (line 360) — useQueries fans out ONLY over rows lacking an in-milestone MR; in-milestone branch (the `row.mr` cell) untouched |
| 3 | A task with no MR anywhere still shows "Missing MR" | ✓ VERIFIED | `ReleaseDetailPage.tsx:930-937` — terminal `else` retains the original AlertTriangle + "Missing MR" indicator when no offending MR found |
| 4 | The wrong-milestone tooltip names the offending MR's actual milestone | ✓ VERIFIED | `:923` — `title={`MR !${offending.iid} is on milestone ${offendingMilestone}, not this release`}`, where `offendingMilestone = offending.milestone?.title ?? 'no milestone'` (:918-919) |
| 5 | The releases list shows a cache-only summary badge without triggering GitLab fan-out on list render | ✓ VERIFIED | `ReleasesTab.tsx:52-74` `WrongMilestoneBadge` uses `useQuery({ ..., enabled: false })` — queryFn never runs; only reads the seeded cache entry reactively. No `searchProjectMRsByKey`/`useQueries` on the list path |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `gitlab.ts` | `searchProjectMRsByKey` (project-scoped, all states, paginated, encoded key) | ✓ VERIFIED | Exported at `:1170`; URL `/projects/:id/merge_requests?search=…&in=title&state=all&per_page=100&page=N`, `encodeURIComponent(key)`, while-loop break-on-short-page, error handling mirrors `fetchMilestoneMRs`, no label enrichment |
| `gitlab.test.ts` | Tests for pagination, state=all, URL params | ✓ VERIFIED | `:291-390` — 6 tests: URL params, special-char encoding, 2-page pagination + stop-on-short, single-page no 2nd request, unreachable throws, 401/403 throws |
| `ReleaseDetailPage.tsx` | Per-missing-task useQueries + wrong-milestone row indicator | ✓ VERIFIED | `:361-375` useQueries, `:381-395` comparison map, `:914-929` indicator, `:401-414` cache seeding |
| `ReleasesTab.tsx` | Cache-only summary badge | ✓ VERIFIED | `:52-74` `WrongMilestoneBadge`, rendered at `:438-442` |
| `query-constants.ts` | Shared `wrongMilestoneMRKey` key | ✓ VERIFIED | `:23-27` exported helper; consumed by both ReleaseDetailPage (seed) and ReleasesTab (read) — no drift |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| ReleaseDetailPage | `searchProjectMRsByKey` | useQueries over missing rows | ✓ WIRED | `:361-375`, imported `:48` |
| ReleaseDetailPage | `matchedMilestone.id` | id comparison, null = warn | ✓ WIRED | `:391` `mr.milestone == null \|\| mr.milestone.id !== matchedMilestone.id` |
| ReleaseDetailPage → ReleasesTab | cache entry | `wrongMilestoneMRKey` (seed/read) | ✓ WIRED | seed `:403-405`, read `:62` — both via shared helper |
| ReleaseDetailPage | `linkMRToTask` | key re-confirmation | ✓ WIRED | `:390` confirms each returned MR truly carries the key before flagging |

### Locked Decisions Coverage

| Decision | Status | Evidence |
|----------|--------|----------|
| Trigger = different-or-absent milestone, compared by id (null = warn) | ✓ | `:391` id comparison incl. `milestone == null` |
| All MR states (`state=all`) | ✓ | `gitlab.ts:1182` URL; test `:324` |
| Per-task lookup ONLY for tasks missing an in-milestone MR | ✓ | `missingRows` filter `:360` |
| New project-scoped search reusing linkMRToTask | ✓ | new `searchProjectMRsByKey` (not global `searchGitLabMRs`); `linkMRToTask` re-run at `:390` |
| Both surfaces present (detail row + list badge) | ✓ | detail `:914-929`, list `:438-442` |
| List badge does NOT trigger GitLab fan-out on list render | ✓ | `enabled: false` useQuery; no search call on list path |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| searchProjectMRsByKey tests | `npx vitest run src/services/gitlab.test.ts` | 71 passed (incl. 6 new) | ✓ PASS |
| Build (biome + tsc) | `npm run check` | 467 files, no fixes/errors | ✓ PASS |

### Anti-Patterns Found

None. No TODO/FIXME/XXX/placeholder markers in the four modified files. No unused imports (`extractTicketKeys` used; biome+tsc green).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GGX-WARN-01 | 260612-ggx-PLAN | Warn when a task's MR is not in the release's matched milestone | ✓ SATISFIED | All 5 truths + 6 locked decisions verified above |

### Human Verification Required

None required for sign-off. The plan's optional UAT (open a release with a wrong-milestone-MR task → see indicator + tooltip) is a nice-to-have visual confirmation but every observable truth is verifiable in code and covered by passing unit tests + a green typecheck.

### Gaps Summary

No gaps. All five must-have truths are implemented, wired, and data-flowing through the shared
`wrongMilestoneMRKey` cache contract. The detail page performs a bounded per-missing-row search
(all states, project-scoped, id-based milestone comparison with null = warn), the list badge is
strictly cache-only (`enabled: false`), tests pass (71), and `npm run check` is green.

---

_Verified: 2026-06-12T12:16:00Z_
_Verifier: Claude (gsd-verifier)_
