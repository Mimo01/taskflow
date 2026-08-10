---
phase: 88-release-branch-milestone-creation
plan: 09
subsystem: ui
tags: [typescript, vitest, react-query, cache-invalidation, gitlab, release-branch]

# Dependency graph
requires:
  - phase: 88-release-branch-milestone-creation
    plan: 08
    provides: "BranchState 'check-failed' variant and resolveBranchState's optional branchCheckFailed param"
provides:
  - "Project-granular milestone-cache invalidation reachable by ReleasesTab's list-shaped window key (CR-02)"
  - "check-failed branch state wired end-to-end: hook -> resolveBranchState -> sidebar -> retry (CR-03)"
  - "Guarded create-branch/create-milestone mutations rejecting when GitLab project/baseUrl/token unset (WR-10)"
affects: [88-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack Query invalidation at project granularity (2-element key) instead of a window-scoped key, to reach every cached window variant by prefix match"
    - "useQuery isError threaded into a pure state-resolution function as an explicit named param, distinct from the undefined-means-loading convention"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
  modified:
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx

key-decisions:
  - "RED and GREEN landed in two separate commits (Task 1, Task 2), each combining RED+GREEN internally because the repo's husky pre-commit hook runs the full vitest suite and rejects any commit containing a failing test — a true RED-only commit is impossible without --no-verify, which is forbidden. RED was verified interactively via npx vitest run before implementing each task's GREEN (5/5 hook tests failed pre-change; 2/9 sidebar tests failed pre-change, Test H already passed by design)."

patterns-established: []

requirements-completed: [RELBR-02, RELBR-04, RELMS-02, RELMS-04]

# Metrics
duration: 35min
completed: 2026-08-10
---

# Phase 88 Plan 09: Milestone-invalidation granularity + branch-check-failed wiring Summary

**Closed CR-02 (milestone create now invalidates `['gitlab-milestones', activeGitlabProject]` so the Releases list's differently-windowed cache entry is reliably reached), the wiring half of CR-03 (a failed branch-existence check now resolves to an explicit `check-failed` sidebar row with a working Retry instead of dead-ending at "Loading…"), and WR-10 (both create mutations now throw `GitLab project not configured` instead of silently POSTing to project id 0 when the project/base URL/token is unset).**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-10T21:09:00Z
- **Completed:** 2026-08-10T21:14:40Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- **CR-02 (milestone-invalidation granularity):** `createMilestoneMutation.onSuccess` now invalidates the two-element project-granular key `['gitlab-milestones', activeGitlabProject]` instead of the four-element windowed key that only matched *this* page's window. `ReleasesTab` caches the same `'gitlab-milestones'` prefix under a different window (min..max of all fix version dates ±7d), so the old key could never reach the list's cache entry — the list kept showing "No GitLab link" for up to 5 minutes after a successful create. The windowed READ query key (lines 86-92) is untouched, preserving D-05's cache-sharing contract.
- **CR-03 (branch-check-failed wiring):** the `gitlab-branch` query now destructures `isError` as `branchCheckFailed` and threads it into `resolveBranchState` (which already knew how to rank it, from Plan 88-08). A `refetchBranchCheck` wrapper (no-arg `refetch`) is exposed from the hook and returned to the page. `ReleaseDetailSidebar` gained a `check-failed` arm — positioned before `loading` to mirror `resolveBranchState`'s precedence — rendering a fixed-literal error span (`Couldn't check the release branch`, `title` naming only the branch, never the error/status/URL, per T-88-09-02) plus a `Retry` button wired to the new `onRetryBranchCheck` prop. No `Create branch` affordance is offered in this state (a failed check must not imply "missing").
- **WR-10 (mutation guards):** both `createBranchMutation` and `createMilestoneMutation` now throw `GitLab project not configured` up front when `activeGitlabProject`, `gitlabBaseUrl`, or `gitlabToken` is falsy — removing the `?? 0` / `?? ''` fallback path that would otherwise POST to `/api/v4/projects/0/...`. After the guard, TypeScript narrows all three to non-null so the service calls no longer need fallback operators.
- 5 new `useReleaseDetail.test.tsx` hook tests (Tests A-E, the phase's first test file for this hook) + 3 new `ReleaseDetailSidebar.test.tsx` tests (F/G/H) — all verified RED against the unmodified source before implementing GREEN.

## Task Commits

1. **Task 1: milestone-invalidation granularity, branch-check error threading, mutation guards (CR-02, CR-03 hook half, WR-10)** - `579db8b1` (feat)
2. **Task 2: check-failed sidebar rendering + retry + page wiring (CR-03 UI half)** - `932c525d` (feat)

**Plan metadata:** (this SUMMARY commit, following)

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` — project-granular milestone invalidation; `isError: branchCheckFailed` threaded into `resolveBranchState`; `refetchBranchCheck` defined and returned; both mutations guarded against unset project/baseUrl/token
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` — new file, 5 tests (A: invalidation key shape, B: cross-window reach, C: error threading, D: retry exposure, E: mutation guards)
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` — `onRetryBranchCheck` prop added; `check-failed` arm + Retry button added to the Release Branch `MetaRow` ternary
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` — `onRetryBranchCheck={() => {}}` added to the `renderSidebar` default prop set; 3 new tests (F/G/H)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — destructures `refetchBranchCheck`, passes it as `onRetryBranchCheck` to `<ReleaseDetailSidebar />`

## Decisions Made

- Combined RED and GREEN into one commit per task (see Deviations) — same tooling constraint documented in Plan 88-08's SUMMARY: the repo's `.husky/pre-commit` hook runs the full 2200+ test suite unconditionally and rejects any commit containing a failing test, so a true RED-only commit is impossible without `--no-verify` (prohibited). RED was verified interactively via `npx vitest run` before each task's GREEN was written: Task 1 confirmed 5/5 new hook tests failed against the unmodified hook; Task 2 confirmed 2/3 new sidebar tests failed (Test F, G) — Test H already passed against the unmodified component because the `check-failed` kind doesn't match any of the three existing `BranchCreateButton` conditionals (all keyed on `missing`/`blocked-no-milestone`/`unresolvable`/`invalid-ref`), so no create button was ever rendered for it even before the fix. This matches the plan's own caveat ("confirm the actual current output while writing the test").
- Left `ownWindowMilestones` (`activeGitlabProject ?? 0`) untouched per the plan's explicit hand-off note — it's a read-side derivation to be handled together with the create-milestone dialog prop in Plan 88-10.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `as any` casts flagged by plan-level `npx biome check` replaced with precise return-type casts**
- **Found during:** Task 2, running the plan's overall verification step (`npx biome check ...` across all 5 files)
- **Issue:** Three `// biome-ignore lint/suspicious/noExplicitAny` comments in `useReleaseDetail.test.tsx` (written during Task 1) were flagged as "Suppression comment has no effect" — Biome's `noExplicitAny` rule doesn't fire on `as any` type-assertion expressions the way the ignore comment assumed, so the suppressions were dead weight and `biome check` failed with 1 error + 3 warnings. Also flagged: one formatting violation (an unformatted ternary).
- **Fix:** Replaced the two `as any` mock-return casts with precise `ReturnType<typeof useAuthStore>` / `Awaited<ReturnType<typeof fetchProject>>` casts (no `any`), and replaced the third (`fetchVersionIssueCounts` mock) with a fully-typed literal matching the real `VersionIssueCounts` interface (`{ issuesFixed, issuesTotal }` — the mock had used a wrong, invented shape). Ran `npx biome format --write` to fix the ternary formatting.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx`
- **Verification:** `npx biome check` on all 5 plan files — zero errors, zero warnings. `npx tsc --noEmit` — clean. Full hook test file re-run — 5/5 still pass.
- **Committed in:** `932c525d` (bundled into Task 2's commit since it was caught during that task's verification pass, not Task 1's)

---

**Total deviations:** 1 (lint/type hygiene only; no scope, correctness, or security impact — the fix also caught a genuinely wrong mock shape for `VersionIssueCounts` that happened to not matter for the test's assertions)

## Issues Encountered

- No `node_modules` existed in this worktree checkout (fresh git worktree, `node_modules` is gitignored per-checkout, same as Plan 88-08). Symlinked `taskflow/node_modules` to the main repo's `taskflow/node_modules` to run vitest/tsc/biome. The symlink is gitignored and untracked.
- Worktree base commit had drifted ahead of the expected `964e9af5` at agent start (merge-base check showed the expected base as a *descendant* of HEAD, not an ancestor) — corrected via the mandated `git reset --hard 964e9af541431a18234e8898d6c4ce48410ed21b` per the branch-check protocol before any work began. Working tree was clean at that point, so no work was lost.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 88-10 can now build on `refetchBranchCheck` and the guarded mutations. Per this plan's action step 4, `ownWindowMilestones`'s `activeGitlabProject ?? 0` derivation is explicitly left for 88-10 to handle together with the create-milestone dialog prop.
- `useReleaseDetail.ts` now has its first dedicated test file (`useReleaseDetail.test.tsx`, 5 tests) — future hook changes in this file have a regression baseline to extend rather than starting from zero.
- WR-02, WR-08, WR-05 remain out of scope per this plan's `<out_of_scope>` — unchanged, still open, flagged for visibility.

---
*Phase: 88-release-branch-milestone-creation*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
- FOUND: taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
- FOUND: taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
- FOUND: taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
- FOUND: taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
- FOUND: commit 579db8b1 (feat(88-09): fix milestone-invalidation granularity, thread branch-check error, guard mutations)
- FOUND: commit 932c525d (feat(88-09): render check-failed branch state with retry, wire from page (CR-03 UI half))
