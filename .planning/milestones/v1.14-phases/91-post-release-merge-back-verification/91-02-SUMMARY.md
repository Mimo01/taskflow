---
phase: 91-post-release-merge-back-verification
plan: 02
subsystem: release-detail
tags: [typescript, discriminated-union, pure-function, vitest, tdd]

requires:
  - phase: 88-release-branch-milestone-creation
    provides: releaseBranch.ts's BranchState/resolveBranchState discriminated-union + strict-precedence pattern this module mirrors
provides:
  - MergeBackVerdict discriminated union (hidden/loading/couldnt-verify/merged-via-tracking-mr/merged-via-content-compare/likely-not-merged)
  - resolveMergeBackVerdict: eleven-step precedence resolver implementing D-01/D-02/D-04/D-09/D-10/D-11
  - formatVerdictDate ('21 Jul') and formatEvidenceDate ('21.07.2026') locale-independent date formatters
  - 23 unit tests (17 covering every precedence branch, 6 covering the two formatters)
affects: [91-03-render-merge-back-row]

tech-stack:
  added: []
  patterns:
    - "React-free pure resolver module mirroring releaseBranch.ts's resolveBranchState (structural TrackingMR/MergeBackCompareInput types decoupled from live service types)"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts
    - taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts
  modified: []

key-decisions:
  - "RED and GREEN commits combined into a single feat commit: the project's husky pre-commit hook runs the full `npm run test` suite on every commit, which blocks committing a failing-test-only RED state; workflow.tdd_mode is false in config.json so strict gate enforcement is not mandated project-wide"

patterns-established:
  - "Verdict-resolution pure modules follow releaseBranch.ts's template: discriminated union + strict-precedence function with a decision-id comment above every branch"

requirements-completed: [MERGE-02]

duration: 25min
completed: 2026-08-11
---

# Phase 91 Plan 02: Merge-Back Verdict Pure Module Summary

**Eleven-step `resolveMergeBackVerdict` precedence resolver plus two locale-independent date formatters, modeled 1:1 on `releaseBranch.ts`'s `resolveBranchState`, with 23 mock-free unit tests covering every branch.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-11T17:20:00Z (approx)
- **Completed:** 2026-08-11T17:52:06Z
- **Tasks:** 2 (combined into one commit per TDD-gate deviation below)
- **Files modified:** 2 (both created)

## Accomplishments
- `MergeBackVerdict` five-kind discriminated union (six literal shapes counting the two `merged` variants) with `via: 'tracking-mr' | 'content-compare'` discriminant
- `resolveMergeBackVerdict` implementing the exact eleven-step precedence order from the plan, each step commented with its decision id (D-01, D-02, D-04, D-09, D-10, D-11, P-01, P-02, P-04, P-05)
- `formatVerdictDate` / `formatEvidenceDate` built from `getUTCDate`/`getUTCMonth`/`getUTCFullYear` — zero `toLocaleDateString`, per the project-wide rule in `src/lib/standup-date.ts`
- 23 unit tests: 17 precedence-branch cases inside `describe('resolveMergeBackVerdict')`, 6 formatter cases

## Task Commits

Both plan tasks landed in one commit (see Deviations below for why):

1. **Task 1 + Task 2: mergeBackVerification.ts + mergeBackVerification.test.ts** - `1bc22a06` (feat)

**Plan metadata:** (this SUMMARY's own commit, to follow)

## Files Created/Modified
- `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts` - `MergeBackVerdict` union, `resolveMergeBackVerdict`, `TrackingMR`/`MergeBackCompareInput` structural types, `formatVerdictDate`/`formatEvidenceDate`
- `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts` - 23 Vitest cases, no mocks, no rendering, one `describe` per exported function

## Decisions Made
- Combined the TDD RED and GREEN commits into a single `feat(91-02)` commit. The plan specifies `tdd="true"` for Task 1, and workflow best practice calls for a separate `test(...)` commit that fails before a `feat(...)` commit that passes. The project's `.husky/pre-commit` hook runs `biome check --staged && tsc --noEmit && npm run test` on every commit — the third step runs the **full** suite (not just staged files), so a commit containing only a failing new test file cannot pass the hook without either weakening the hook (out of scope) or using `--no-verify` (forbidden). Since `.planning/config.json`'s `workflow.tdd_mode` is `false`, strict RED/GREEN gate enforcement is not mandated at the project level, so the deviation is safe: the test file was written first, run standalone with `npx vitest run <file>` to confirm the RED failure (`Failed to resolve import "./mergeBackVerification"`), then the implementation was added and both files committed together once the full suite (2396 tests) and `npm run check` were green.
- `commitsNotInDefault` on the `likely-not-merged` branch defensively falls back to `0` if `compareResult` were ever `undefined` at that point (defensive-only; every precedence branch above guarantees `compareResult` is defined and non-timed-out by the time step 11 is reached — TypeScript's control-flow narrowing doesn't survive the earlier `compareResult?.diffCount === 0` optional-chained check, so the `?? ` fallback satisfies `strict` mode without weakening the logic).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Symlinked `taskflow/node_modules` from the main checkout to run tests in the worktree**
- **Found during:** Task 1 (initial `npx vitest run` attempt)
- **Issue:** This worktree's `taskflow/` subdirectory had no `node_modules` (only the top-level SDK `node_modules` existed), so `npx vitest` and `npx tsc` failed with `ERR_MODULE_NOT_FOUND` / unresolved imports.
- **Fix:** `ln -s /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules <worktree>/taskflow/node_modules` — a local, gitignored symlink to the main repo's already-installed dependencies. Not committed (git status confirms `node_modules` stays untracked/ignored).
- **Files modified:** none (symlink only, outside git)
- **Verification:** `npx vitest run` and `npx tsc --noEmit` both resolved correctly afterward
- **Committed in:** N/A (not a tracked change)

**2. [Rule 1 - Bug] Reformatted the test file with `biome check --write` before commit**
- **Found during:** pre-commit hook / `npm run check` dry run
- **Issue:** Manually authored test file had a few multi-line call-argument formattings that didn't match Biome's configured line width/wrap rules, which `npm run check` flags as format errors (blocking commit).
- **Fix:** Ran `npx biome check --write` on both new files; only the test file needed reformatting (wrapped several `makeParams({...})` calls and object literals onto Biome's preferred layout). No logic changed.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts`
- **Verification:** `npm run check` clean for both new files; full suite still green (2396 passed)
- **Committed in:** `1bc22a06` (part of the combined commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/environment, 1 bug/formatting)
**Impact on plan:** Neither affects the module's behavior or the plan's acceptance criteria. No scope creep.

## Issues Encountered
- Pre-existing Biome baseline drift (documented in Phase 90's `deferred-items.md`: `chart.tsx`, `BacklogRow.tsx`, `MyTasksPage.tsx`/`.test.tsx`, `BacklogPage.tsx` — 2 errors / 30 warnings) is unchanged by this plan; confirmed via `npx biome check ./src --max-diagnostics=100` that no new files are flagged beyond that known baseline.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `mergeBackVerification.ts` exports everything Plan 03 needs to wire the two new `useReleaseDetail.ts` queries and render the "Merged back" `MetaRow`: `MergeBackVerdict`, `TrackingMR`, `MergeBackCompareInput`, `resolveMergeBackVerdict`, `formatVerdictDate`, `formatEvidenceDate`.
- All acceptance criteria from the plan verified directly: type-only import (`import type { GitLabMR }`), zero React/hooks, 5-kind union present with both `via` literals, 11-step precedence with decision-id comments, zero `toLocaleDateString`/`compare_same_ref`/`commitCount === 0` in executable code, `npx tsc --noEmit` exits 0, `npx vitest run` exits 0 with 23/23 passing.
- No blockers for Plan 03.

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts
- FOUND: taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts
- FOUND commit: 1bc22a06

---
*Phase: 91-post-release-merge-back-verification*
*Completed: 2026-08-11*
