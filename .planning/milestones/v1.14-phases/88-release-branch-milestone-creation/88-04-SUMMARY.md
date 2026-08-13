---
phase: 88-release-branch-milestone-creation
plan: 04
subsystem: releases-list
tags: [react-query, gitlab, drift-detection, vitest]

# Dependency graph
requires:
  - phase: 88-release-branch-milestone-creation
    plan: 01
    provides: "release-detail/releaseBranch.ts: deriveReleaseBranchName, RELEASE_BRANCH_PREFIX"
  - phase: 88-release-branch-milestone-creation
    plan: 02
    provides: "services/gitlab.ts: fetchProjectBranches (fully-paginated release/ branch discovery)"
provides:
  - "ReleasesTab.tsx: single gitlab-release-branches query + per-row branchMissing/milestoneMissing drift indicators"
affects: [89-mr-drift-discovery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-shot fully-paginated fetch + local Set<string> matching per row, instead of a per-row useQueries batch (D-18) — mirrors the fetch-once page-cap pitfall lesson from mr-discussions-cap-20/assignee-missing-users"
    - "Native title tooltip on a wrapping <span> around a lucide-react icon (LucideProps has no title prop) — same convention as ReleaseDetailSidebar.tsx:118"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.test.tsx

key-decisions:
  - "lucide-react's AlertTriangle component does not accept a `title` prop (LucideProps has no title in this version) — wrapped the icon in a <span title=... data-testid=...> instead of passing title directly to the SVG component, preserving the exact tooltip copy and native-title convention"
  - "milestoneMissing/branchMissing computed inside the existing toMatched closure (not in row JSX) so no extra render-time work happens per D-18's single-fetch performance intent"
  - "D-11 respected literally: a `null` deriveReleaseBranchName result (unparseable milestone title) yields branchMissing: false — no branch indicator is shown for a state the user cannot act on from the list"

requirements-completed: [RELBR-03, RELMS-01]

# Metrics
duration: ~35min
completed: 2026-08-10
---

# Phase 88 Plan 04: Release-list drift indicators (missing branch/milestone) Summary

**One `gitlab-release-branches` useQuery fetching the entire `release/`-prefixed branch set once per project (D-18), matched locally per row via a `Set<string>`, surfaced as orange `size-3` `AlertTriangle` icons with native tooltips for missing-branch/missing-milestone drift (D-17/D-19) on the Releases list.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-10T16:53:00Z (worktree base reset) / task work began ~19:00Z
- **Completed:** 2026-08-10T17:11:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `ReleasesTab.tsx` gained exactly one new `useQuery` (`['gitlab-release-branches', activeGitlabProject]`) calling `fetchProjectBranches` with the `release/` prefix search term — proven called exactly once by a dedicated regression test, never a per-row batch query
- `MatchedVersion` extended with `branchMissing`/`milestoneMissing`, computed once per row inside the existing `toMatched` closure using `deriveReleaseBranchName(bestMatch.candidateName)` against a `Set` of fetched branch names (O(1) lookup)
- Two conditional `AlertTriangle` icons (orange, `size-3`, native `title` tooltip via a wrapping `<span>`) render inside the existing row indicator flex group, positioned before the task-count span so a future Phase 89 aggregate drift count can append without a redesign
- The windowed `gitlab-milestones` query key (D-05) is byte-identical — untouched by this plan
- Full test suite: 2167 passed / 2 skipped, 0 failed; `tsc --noEmit` clean project-wide; `npm run check` (Biome) at the documented 2-error `BacklogPage.tsx`/`BacklogRow.tsx` baseline — no new errors

## Task Commits

Each task was committed atomically:

1. **Task 88-04-T1: One-shot paginated branch-set query in ReleasesTab** - `d6fc1d58` (feat)
2. **Task 88-04-T2: Row indicator icons + ReleasesTab test coverage** - `401b4c3b` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` - Added `gitlab-release-branches` query, `releaseBranchNames` Set, `branchMissing`/`milestoneMissing` on `MatchedVersion`, two `AlertTriangle` drift indicators in the row indicator group
- `taskflow/src/routes/dashboard/ReleasesTab.test.tsx` - Added `fetchProjectBranches` to the `@/services/gitlab` mock factory; added `describe('release-row drift indicators (D-17/D-18/D-19)')` with 3 tests (single-fetch regression guard, missing-branch indicator, branch-present hides indicator)

## Decisions Made
- Wrapped `AlertTriangle` in a `<span title=... data-testid=...>` rather than passing `title` directly to the icon component, since `lucide-react`'s `LucideProps` in this project's installed version does not expose a `title` prop (TS2322 caught this at `tsc --noEmit`) — this preserves the plan's exact tooltip copy, `data-testid` hooks, and the codebase's native-title convention without a library upgrade
- Kept drift-flag computation entirely inside `toMatched` (not in row JSX) so the per-row `Set.has()` lookup happens once per version, matching D-18's stated performance intent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] lucide-react icon does not accept a `title` prop**
- **Found during:** Task 88-04-T2, `tsc --noEmit` verification
- **Issue:** The plan's literal action text passed `title="..."` directly to `<AlertTriangle ... title="..." />`; this version's `LucideProps` type has no `title` member, causing a TS2322 compile error
- **Fix:** Wrapped each `AlertTriangle` in a `<span title="..." data-testid="...">` matching the existing native-title tooltip convention at `ReleaseDetailSidebar.tsx:118`. The rendered DOM, tooltip copy, and `data-testid` targets are unchanged from the plan's intent.
- **Files modified:** `taskflow/src/routes/dashboard/ReleasesTab.tsx`
- **Verification:** `tsc --noEmit` clean; `grep -c 'title="No release branch"'` / `grep -c 'title="No GitLab milestone"'` both return `1` as required by acceptance criteria
- **Committed in:** `401b4c3b`

**2. [Rule 1 - Bug] Cross-test mock-call pollution in the new "fetches exactly once" test**
- **Found during:** Task 88-04-T2, running the full `ReleasesTab.test.tsx` suite (initially failed with `toHaveBeenCalledTimes` expecting 1, got 9)
- **Issue:** Earlier pre-existing tests in the same file also exercise the mocked `@/services/gitlab` module and leave asynchronous query effects in flight when their test body completes without awaiting full settlement; those calls land on the shared module-level `fetchProjectBranches` mock during a later test's `await screen.findByText`, inflating its call count despite `vi.clearAllMocks()` in `beforeEach`
- **Fix:** Added a synchronous `vi.mocked(fetchProjectBranches).mockClear()` immediately before `renderWithQuery` in the affected test, executed before any `await` yields to the microtask queue — this discards any leaked calls from prior tests' still-resolving promises without touching the real call this test's render will make (which only fires after the async `readSecret` token-load effect resolves)
- **Files modified:** `taskflow/src/routes/dashboard/ReleasesTab.test.tsx`
- **Verification:** Full suite passes 17/17 both in isolation and as part of the 2167-test project run
- **Committed in:** `401b4c3b`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — compile-time type mismatch and test-isolation timing, no scope creep, no behavior change to production drift-detection logic)
**Impact on plan:** Cosmetic/mechanical only. All D-17/D-18/D-19 behavior and UI-SPEC copy delivered exactly as specified.

## Issues Encountered
- The worktree had no `node_modules`; symlinked `taskflow/node_modules` to the main checkout's install (same pattern used by Plans 88-01/88-02) to run `vitest`/`tsc`/`biome` without a multi-minute reinstall. `node_modules` is gitignored — no trace left in git status, no commit needed.
- Worktree base had drifted from the expected commit at agent spawn time; the mandatory `worktree_branch_check` step's `git reset --hard` corrected it to `53daa4d7` (clean working tree, no uncommitted work lost).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `ReleasesTab.tsx` now surfaces list-level drift (D-17) as the user explicitly requested during phase discussion, without requiring per-release navigation
- Phase 89 (three-channel MR discovery + drift flagging) can add an aggregate drift count beside these icons in the same `flex items-center gap-3 shrink-0` group without any layout rework — verified as a plan `must_haves.truths` requirement
- No blockers for downstream phases 89-91

---
*Phase: 88-release-branch-milestone-creation*
*Completed: 2026-08-10*
