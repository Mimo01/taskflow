---
phase: 88-release-branch-milestone-creation
plan: 08
subsystem: ui
tags: [typescript, vitest, state-machine, release-branch, gitlab]

# Dependency graph
requires:
  - phase: 87-release-detail-decomposition
    provides: releaseBranch.ts pure module (BranchState, resolveBranchState, isValidGitRefName) extracted from ReleaseDetailPage.tsx
provides:
  - "BranchState 'check-failed' variant distinguishing an errored branch-existence query from an in-flight one"
  - "resolveBranchState optional branchCheckFailed param with precedence: D-10 -> D-11 -> RELBR-05 -> CR-03 (check-failed) -> branchExists tri-state"
  - "Byte-stable control-character tests in releaseBranch.test.ts (WR-07 closed)"
affects: [88-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union precedence order encoded in both a doc comment and an evaluation-order test suite"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/release-detail/releaseBranch.ts
    - taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts

key-decisions:
  - "RED and GREEN landed in a single commit instead of two, because the repo's husky pre-commit hook runs the full vitest suite and blocks any commit containing a failing test — a true RED-only commit is not possible without --no-verify, which is forbidden. RED was still verified interactively (2 of 8 new tests failed against the pre-change signature) before the implementation was written."

patterns-established: []

requirements-completed: [RELBR-02, RELBR-04, RELBR-05]

# Metrics
duration: 25min
completed: 2026-08-10
---

# Phase 88 Plan 08: Branch check-failed state + byte-stable control-char tests Summary

**Added a `check-failed` `BranchState` variant so a real GitLab branch-existence query error (401/403/500/timeout) resolves to a distinct, recoverable UI state instead of pinning the release detail page at "Loading…" forever — plus replaced two literal control bytes (SOH/DEL) in `releaseBranch.test.ts` with unicode escape sequences so no formatter or copy/paste round-trip can silently invert the assertions.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-10T20:55:00Z
- **Completed:** 2026-08-10T21:01:00Z
- **Tasks:** 2 (combined into one commit — see Deviations)
- **Files modified:** 2

## Accomplishments
- `resolveBranchState` now accepts an optional `branchCheckFailed?: boolean` and returns `{ kind: 'check-failed', branchName }` when the branch-existence query errored, evaluated strictly after `invalid-ref` and before the `branchExists === undefined -> loading` fallback — so D-10 (no milestone), D-11 (unresolvable), and RELBR-05 (invalid ref) all still outrank it, and an error signal always wins over a stale `branchExists: true`.
- Eight new unit tests cover the full precedence matrix (check-failed vs. loading vs. D-10 vs. D-11 vs. a stale successful `branchExists`).
- The two control-character tests (`'rejects a name containing an ASCII control character'`, `'rejects a name containing a DEL character'`) no longer contain literal `0x01`/`0x7F` bytes in source — verified via `od -c` byte-scan (0 matches) and confirmed the assertions remain meaningful by temporarily flipping one to `.toBe(true)` and observing the test fail, then reverting.
- Module stays React-free / service-import-free (`grep -cE "from 'react'|@/services"` returns 0).

## Task Commits

Both plan tasks landed in one commit because the repo pre-commit hook runs the full suite and blocks failing-test commits (see Deviations):

1. **Task 1 + Task 2 combined: check-failed BranchState + byte-stable control-char tests** - `4c82bd6b` (feat)

**Plan metadata:** (this SUMMARY commit, following)

## Files Created/Modified
- `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` - Added `check-failed` to the `BranchState` union (before `loading`), added optional `branchCheckFailed` param to `resolveBranchState` with an inline CR-03 comment pinning it above the `undefined -> loading` fallback, updated the precedence doc comment
- `taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts` - 8 new `resolveBranchState` precedence tests; replaced literal SOH (`\x01`) and DEL (`\x7F`) bytes with u0001/u007F escape sequences plus trailing `// SOH control char` / `// DEL` comments

## Decisions Made
- Combined RED and GREEN into a single `feat` commit (see Deviations below) — the plan's TDD instructions assume RED can be committed standalone, but this repo's `.husky/pre-commit` runs `npm run test` (the full 2200+ test suite) unconditionally, so any commit containing even one intentionally-failing test is rejected by the hook. `--no-verify` is prohibited, so RED was verified interactively via `npx vitest run` (confirmed 2/8 new cases failed against the pre-change signature) before writing the implementation, then both were staged and committed together once the suite was green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Process deviation, not a Rule 1-4 category] RED/GREEN commit split not possible in this repo**
- **Found during:** Task 1 (attempting the `test(...)` RED commit per TDD execution flow)
- **Issue:** `git commit` for the RED-only test change was rejected by `.husky/pre-commit`, which runs `npm run test` (full suite, no path scoping) as a blocking step. A RED commit by definition contains failing tests, so the hook always rejects it.
- **Fix:** Verified RED interactively (`npx vitest run` showed 2 of 8 new tests failing against the unmodified `releaseBranch.ts`), then implemented the GREEN change and committed test + implementation together in one `feat` commit once all 41 tests in the file (2191 total) passed.
- **Files modified:** taskflow/src/routes/dashboard/release-detail/releaseBranch.ts, taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts
- **Verification:** `npx vitest run src/routes/dashboard/release-detail/releaseBranch.test.ts` — 41/41 pass; full suite via pre-commit hook — 2191/2191 pass, 2 skipped, 13 todo
- **Committed in:** `4c82bd6b`

---

**Total deviations:** 1 (process-only; no scope, correctness, or security impact)
**Impact on plan:** None on functional outcome — every acceptance criterion in the plan (test counts, line-order assertion, `tsc --noEmit`, React-free grep, byte-scan, flip-to-verify) was independently checked and passed. Only the commit granularity differs from the plan's literal RED-then-GREEN instruction, due to a tooling constraint outside this plan's control.

## Issues Encountered
- No `node_modules` existed in this worktree checkout (fresh git worktree, `node_modules` is gitignored per-checkout). Symlinked `taskflow/node_modules` to the main repo's `taskflow/node_modules` (427MB, avoids a costly `npm install` duplication) to run vitest/tsc/biome. The symlink itself is gitignored and untracked — confirmed via `git status --short --ignored=matching`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 88-09 (the consumer plan) can now rely on `BranchState` having a `'check-failed'` member and `resolveBranchState` accepting `branchCheckFailed` — interface-first ordering delivered as intended.
- Note per plan: until 88-09 wires the hook/sidebar to pass `branchCheckFailed` and render the new state, `ReleaseDetailSidebar.tsx`'s existing ternary chain falls through `check-failed` to its `else` ("No release branch") arm — expected, and exactly what 88-09 closes.
- WR-09 (regex right-boundary on version extraction) and WR-05 (unreachable `invalid-ref` arm) remain deliberately out of scope per the plan's `<out_of_scope>` — still open, flagged here for visibility.

---
*Phase: 88-release-branch-milestone-creation*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/release-detail/releaseBranch.ts
- FOUND: taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts
- FOUND: commit 4c82bd6b (feat(88-08): add check-failed BranchState variant and branchCheckFailed param)
