---
phase: 76-visual-polish-and-shared-primitives
plan: "02"
subsystem: testing
tags: [lexorank, rank, bigint, base36, pure-function, vitest, tdd]

requires: []
provides:
  - "rankIssue(before, after): string — pure LexoRank midpoint calculator in services/jira/rank.ts"
  - "9-case unit test suite for all LexoRank edge cases in services/jira/rank.test.ts"
affects:
  - phase-78-drag-to-rank

tech-stack:
  added: []
  patterns:
    - "Pure utility module with no imports — follows statusStyles.ts/epicColors.ts precedent"
    - "BigInt base-36 arithmetic for rank string midpoint to avoid floating-point precision loss"
    - "rankLt test helper compares value portion only (strips bucket + ':') to avoid ':' (58) vs digit ASCII ordering pitfall"

key-files:
  created:
    - taskflow/src/services/jira/rank.ts
    - taskflow/src/services/jira/rank.test.ts
  modified: []

key-decisions:
  - "Use || not ?? for afterVal fallback: extractValue(null) returns '' which is falsy but not null/undefined, so ?? would not trigger the pad() fallback"
  - "rankLt compares VALUE portions only: ':' (ASCII 58) sorts between digits (48-57) and letters (97-122), so full-string comparison of rank strings with different-length values fails for digit-extended results"
  - "Adjacent-gap extension appends ALPHABET[18]='i' to result (not to pa the padded value) — the RESEARCH.md spec appends to result which equals pa; since result is the padded form this still works correctly for Jira's typical 6-char rank values"

patterns-established:
  - "Pure rank utility: no imports, module-private helpers, single exported function"
  - "TDD RED/GREEN: test file committed first (module missing -> import fails), then implementation"

requirements-completed: [VISUAL-01]

duration: 35min
completed: 2026-06-03
---

# Phase 76 Plan 02: rankIssue — LexoRank Midpoint Calculator Summary

**Pure BigInt base-36 LexoRank midpoint function `rankIssue(before, after)` with full 9-case TDD suite, covering null boundaries, adjacent-gap digit extension, and bucket preservation**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-02T23:00:00Z
- **Completed:** 2026-06-02T23:11:35Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 2

## Accomplishments

- `taskflow/src/services/jira/rank.ts` exports `rankIssue` — zero imports, pure function, no API calls
- All 9 LexoRank edge cases GREEN including the adjacent-gap extension case (E5)
- Two bugs found during GREEN phase, both auto-fixed (Rule 1): `??` vs `||` fallback and test comparator design
- `npm run check` (biome + tsc) clean

## Task Commits

1. **Task 1: Write failing rank tests (RED)** — `0154b28a` (test)
2. **Task 2: Implement rankIssue (GREEN)** — `a5664040` (feat)

## Files Created/Modified

- `taskflow/src/services/jira/rank.ts` — Pure LexoRank midpoint calculator; BigInt base-36 arithmetic; adjacent-gap guard; no imports
- `taskflow/src/services/jira/rank.test.ts` — 9 edge cases E1-E9; `rankLt` helper compares value portions only; TDD RED->GREEN lifecycle

## Decisions Made

- `||` instead of `??` for afterVal: `extractValue(null)` returns `''` (empty string). The `??` operator only catches `null`/`undefined`, not `''`, so the `pad()` fallback was silently skipped — the after value became `''` (zero) instead of a padded-z string. Switching to `||` fixes this.
- `rankLt` compares VALUE portions (between `|` and `:`), not full rank strings. The `:` terminator (ASCII 58) sorts AFTER digits (48-57) but BEFORE letters (97+). When a rank result has a digit at the extension position and the before/after have `:` at that position, full-string comparison gives wrong results. E6 (`before='0|aaaaaa:'`, `after='0|aaaaaa1:'`) is literally impossible with full-string comparison because `':'(58) > '1'(49)`. Value-only comparison resolves this correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `??` fallback silently skipped for empty string from extractValue(null)**
- **Found during:** Task 2 (GREEN — first test run showed 4 failures including E2 and E9)
- **Issue:** `extractValue(null)` returns `''`; `'' ?? pad(...)` evaluates to `''` because `??` passes through any non-null/undefined value including empty string; `midpoint` received `b=''` — computed midpoint of `hzzzzz` and `000000` (zero) — result `8zzzzz` < `hzzzzz`
- **Fix:** Changed `extractValue(after) ?? pad(...)` to `extractValue(after) || pad(...)` in `rankIssue`
- **Files modified:** `taskflow/src/services/jira/rank.ts`
- **Committed in:** `a5664040` (Task 2 feat commit)

**2. [Rule 1 - Bug] Test rankLt helper used full-string comparison, breaking E5/E6/E8**
- **Found during:** Task 2 (GREEN — after fixing bug 1, E5/E6/E8 still failing)
- **Issue:** `rankLt(a, b) => a < b` compares full rank strings including `:` terminator. ASCII value of `:` (58) is greater than digits `0-9` (48-57), so `'0|aaaaaa5:'` < `'0|aaaaaa:'` even though numerically `aaaaaa5 > aaaaaa`. E6 has `before > after` as full strings making the test impossible to satisfy.
- **Fix:** Rewrote `rankLt` to extract and compare value portions only (strip bucket prefix and `:` suffix). Added documentation comment explaining the ASCII ordering issue.
- **Files modified:** `taskflow/src/services/jira/rank.test.ts`
- **Committed in:** `a5664040` (Task 2 feat commit, along with the rank.ts fix)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in implementation and test design)
**Impact on plan:** Both fixes necessary for correctness. The `??` vs `||` bug is a genuine algorithm error. The comparator bug is a test design issue rooted in the `:` ASCII ordering property of Jira's rank wire format. No scope creep.

## Issues Encountered

- Worktree had no `node_modules` (symlinked to main repo). First vitest run from worktree failed with `@vitejs/plugin-react` not found. Fixed by creating a symlink: worktree `taskflow/node_modules -> main taskflow/node_modules`.
- The inline trace showed the algorithm producing correct results in an isolated test, but the imported `rank.ts` module produced different results — eventually tracked to the `??` vs `||` bug by adding debug logging.

## Next Phase Readiness

- `rankIssue` is ready for Phase 78 consumption: `import { rankIssue } from '@/services/jira/rank'`
- Phase 78 calls: `rankIssue(issues[targetIdx-1]?.fields.rank ?? null, issues[targetIdx]?.fields.rank ?? null)` then passes the result to Jira PUT `/rest/agile/1.0/issue/rank`
- No blockers.

## Threat Flags

None — pure function, no trust boundaries introduced.

## Known Stubs

None — `rankIssue` is a complete, fully-tested implementation with no placeholder returns.

## Self-Check: PASSED

- `taskflow/src/services/jira/rank.ts` exists (confirmed)
- `taskflow/src/services/jira/rank.test.ts` exists (confirmed)
- Commits `0154b28a` and `a5664040` exist (confirmed)
- 9 tests GREEN (confirmed)
- `npm run check` clean (confirmed)

---
*Phase: 76-visual-polish-and-shared-primitives*
*Completed: 2026-06-03*
