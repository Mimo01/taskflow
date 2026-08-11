---
phase: 91-post-release-merge-back-verification
plan: 03
subsystem: release-detail
tags: [react-query, react, ui, merge-back, vitest]

# Dependency graph
requires:
  - phase: 91-post-release-merge-back-verification
    plan: "01"
    provides: fetchSourceBranchMRs, compareRefs, GitLabCompareResult
  - phase: 91-post-release-merge-back-verification
    plan: "02"
    provides: MergeBackVerdict, resolveMergeBackVerdict, formatVerdictDate, formatEvidenceDate
provides:
  - "Merged back" MetaRow in ReleaseDetailSidebar.tsx, rendering all five MergeBackVerdict kinds
  - useReleaseDetail.ts's mergeBackVerdict field, wired from two new gated queries
  - D-08 softened Release Branch row wording (no "merged" claim)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second consumer of resolveBranchState-style precedence-union rendering (ternary chain keyed on verdict.kind, matching Release Branch row's existing shape)"
    - "Hoisted single findReleaseTag call feeding two consumers (branchState and mergeBackVerdict) instead of calling it twice"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx

key-decisions:
  - "Combined Task 2 (sidebar + page wiring) and Task 3 (test coverage) into one commit — the project's husky pre-commit hook runs project-wide `tsc --noEmit`, and Task 2 alone breaks ReleaseDetailSidebar.test.tsx's prop-shape typecheck until Task 3 adds the mergeBackVerdict default. Same precedent as 91-02's RED/GREEN combination."
  - "D-12 lock test scopes queryAllByRole('button') to the row's own MetaRow div (via closest('.flex.items-start.gap-2')) rather than the whole screen, since the sidebar's unrelated 'Edit' button would otherwise make a screen-wide assertion always fail"

patterns-established:
  - "Merge-back verdict row is the second UI consumer of a resolveXVerdict discriminated union (after Release Branch's BranchState), confirming the ternary-chain-on-kind convention for future advisory rows"

requirements-completed: [MERGE-01, MERGE-02]

# Metrics
duration: 45min
completed: 2026-08-11
---

# Phase 91 Plan 03: Wire and Render the Merge-Back Verdict Summary

**Wired `fetchSourceBranchMRs`/`compareRefs` into two D-05-gated `useReleaseDetail.ts` queries feeding `resolveMergeBackVerdict`, rendered the resulting five-state "Merged back" `MetaRow` with D-10's locked copy, softened the Release Branch row's unverified "was merged and deleted" claim per D-08, and added full component + hook regression coverage.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-11T20:48:19Z
- **Tasks:** 3 completed (2 commits — Task 2+3 combined per the pre-commit hook constraint)
- **Files modified:** 5

## Accomplishments
- `useReleaseDetail.ts` now fires `fetchSourceBranchMRs` and `compareRefs` as two `useQuery` calls, both gated on `releasedVersion` (D-05: unreleased fires zero extra GitLab calls) and on the tag query's resolved result for the compare query (91-RESEARCH Pitfall 3)
- Widened `needsTagLookup` to `releasedVersion && !!matchedVersionNumber` (D-01/Pitfall 4), dropping the stale `branchResult?.exists === false` clause, and hoisted the `findReleaseTag` call into a single `mergeBackTagName` shared by `branchState` and `mergeBackVerdict`
- `resolveMergeBackVerdict` is called with plain resolved values only (no live query objects) and the hook returns `mergeBackVerdict`
- `ReleaseDetailSidebar.tsx` renders a "Merged back" `MetaRow` between "Release Branch" and "MR Labels", hidden entirely for `kind: 'hidden'` (D-11, no dead `—`), with exact D-10/UI-SPEC copy and tooltips for all five kinds (`loading`, `merged`/`tracking-mr`, `merged`/`content-compare`, `likely-not-merged`, `couldnt-verify`) — pure text + icon + native `title`, zero buttons/links/onClick (D-12/D-13)
- Release Branch row's `released` block wording changed from `"{branch} was merged and deleted; tagged {tag}"` to `"{branch} deleted · tagged {tag}"` (and the no-tag variant similarly), with the `Check` icon replaced by `GitBranch` — the word "merged" no longer appears anywhere in that block
- `ReleaseDetailPage.tsx` threads `mergeBackVerdict` from the hook into the sidebar
- 15 new sidebar tests (2 updated released-state assertions + 8 new merge-back-row tests including the D-12 no-button lock) and 5 new hook tests (D-05 zero-calls, tracking-MR fire, compare-query fire, widened-gate tag lookup, verdict exposure)

## Task Commits

Each task was committed atomically (Task 2 + 3 combined per the deviation below):

1. **Task 1: Two gated queries and the resolver call in useReleaseDetail.ts** - `5e7b08c5` (feat)
2. **Task 2 + Task 3: "Merged back" MetaRow, D-08 wording softening, prop threading, and test coverage** - `fc969d9d` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` - `fetchSourceBranchMRs`/`compareRefs` imports, `mergeBackTagName` hoist, widened `needsTagLookup`, two new gated queries, `resolveMergeBackVerdict` call, `mergeBackVerdict` in the return object
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` - `mergeBackVerdict` prop, new "Merged back" `MetaRow` with all five verdict renderings, D-08 wording/icon change on the Release Branch row's `released` block
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - `mergeBackVerdict` destructured from the hook and passed to `ReleaseDetailSidebar`
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` - `mergeBackVerdict: { kind: 'hidden' }` default, D-08 regression-lock assertions on the released-state tests, new `describe('ReleaseDetailSidebar — Merged back row (MERGE-01)')` block (8 tests)
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` - `fetchSourceBranchMRs`/`compareRefs`/`searchProjectTags` added to the `vi.mock` factory and default resolutions, `released` override added to `setupMocks`, new `describe('useReleaseDetail — merge-back queries (D-05 gating)')` block (5 tests)

## Decisions Made
- Combined Task 2 and Task 3 into a single commit: the project's `.husky/pre-commit` hook runs `tsc --noEmit` against the whole project on every commit, and Task 2's new required `mergeBackVerdict` prop on `ReleaseDetailSidebarProps` breaks `ReleaseDetailSidebar.test.tsx`'s existing `renderSidebar` call until Task 3 adds the default prop — the same constraint 91-02's SUMMARY documented for its RED/GREEN split. `workflow.tdd_mode` is `false` in config, so this is not a TDD-gate violation.
- Scoped the D-12 "no button" lock test to the row's own `MetaRow` div via `.closest('.flex.items-start.gap-2')` rather than a screen-wide `queryAllByRole('button')`, because the sidebar's unrelated "Edit" header button would otherwise make that assertion fail regardless of the row's own content.
- P-02's `content-compare` tooltip (`no diff between {tag} and {defaultBranch}`) and the `couldnt-verify` tooltip's three-way `reason`/`expectedTagName` branching were reproduced exactly as specified in the plan — no deviation from the locked copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Symlinked `taskflow/node_modules` from the main checkout to run tsc/vitest/biome in the worktree**
- **Found during:** Task 1 (initial `npx tsc --noEmit` attempt)
- **Issue:** This worktree's `taskflow/` subdirectory had no `node_modules`.
- **Fix:** `ln -s /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules <worktree>/taskflow/node_modules` after confirming `package-lock.json` was byte-identical to the main checkout — same fix documented in 91-01's and 91-02's SUMMARYs for this worktree.
- **Files modified:** none (symlink only, outside git)
- **Verification:** `npx tsc --noEmit`, `npx vitest run`, and `npx biome check` all resolved correctly afterward
- **Committed in:** N/A (not a tracked change)

**2. [Rule 1 - Bug] Biome auto-formatting on import order and a multi-line assertion**
- **Found during:** Task 1 and Task 3 `npx biome check` runs
- **Issue:** Manually authored import ordering (`useReleaseDetail.ts`) and one multi-line test block (`ReleaseDetailSidebar.test.tsx`) didn't match Biome's `assist/source/organizeImports` and formatting rules.
- **Fix:** Ran `npx biome check --write` on each affected file; no logic changed.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts`, `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx`
- **Verification:** `npx biome check` clean on both files afterward; `npx tsc --noEmit` and targeted `vitest run` still green
- **Committed in:** `5e7b08c5` and `fc969d9d` respectively

---

**Total deviations:** 2 auto-fixed (1 blocking/environment, 1 bug/formatting)
**Impact on plan:** No scope creep — neither affects behavior or acceptance criteria.

## Issues Encountered
- The plan's acceptance criterion `grep -c "findReleaseTag(" ... is 2` does not match the actual file shape: the import line reads `findReleaseTag,` (no trailing paren), so the pattern `findReleaseTag(` only ever matches the one call site — this was true of the file before this plan's changes too (verified against the pre-plan commit). The underlying requirement — "do not call `findReleaseTag` twice" — is met: there is exactly one call site, and its result (`mergeBackTagName`) is now shared by both `resolveBranchState` and `resolveMergeBackVerdict`. Documented here rather than silently treated as passing.
- Pre-existing Biome baseline drift (2 errors / 30 warnings across `BacklogPage.tsx`, `BacklogRow.tsx`, `components/ui/chart.tsx`, `MyTasksPage.tsx`, `MyTasksPage.test.tsx` — logged in Phase 90's `deferred-items.md`, confirmed unchanged in 91-01/91-02) confirmed unchanged again; no new files flagged by this plan.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- MERGE-01 and MERGE-02 are both fully implemented and covered: a released fix version's detail page shows a "Merged back" row naming the fetched default branch, hidden entirely for unreleased/unmatched versions, resolving through the tracking-MR-first / content-compare-fallback precedence chain wired through Plan 01's fetchers and Plan 02's resolver.
- MERGE-03 remains DESCOPED by D-12, as directed by the plan — no override/confirm/dismiss/acknowledge control was added anywhere near the row, and nothing persists. This is an intentional descope (same handling as DASH-06/DRIFT-09), not a gap.
- Full suite green (2420 passed, 2 skipped, 13 todo across 180 files); `tsc --noEmit` clean; Biome flags exactly the pre-existing 5-file baseline, no new files.
- No blockers for phase completion.

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
- FOUND: taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
- FOUND: taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
- FOUND: taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
- FOUND: taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
- FOUND commit: 5e7b08c5
- FOUND commit: fc969d9d

---
*Phase: 91-post-release-merge-back-verification*
*Completed: 2026-08-11*
