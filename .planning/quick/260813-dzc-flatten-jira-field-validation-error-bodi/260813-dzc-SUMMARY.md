---
phase: quick-260813-dzc
plan: 01
subsystem: api
tags: [jira, error-handling, wr-01]

requires:
  - phase: quick-260813-dbf
    provides: flattenGitLabError reference pattern (GitLab-side WR-01 fix)
provides:
  - flattenJiraError helper (taskflow/src/services/jira/errors.ts) — errorMessages preferred, errors object fallback
  - Field-validation error surfacing on fetchFixVersions/updateFixVersion/bulkUpdateIssue/rankIssueApi
affects: [jira-service, release-detail-edit, backlog-rank]

tech-stack:
  added: []
  patterns:
    - "flattenJiraError(body: unknown): string | undefined — Jira sibling of flattenGitLabError, unknown-in/string|undefined-out, empty flattens to undefined never ''"

key-files:
  created:
    - taskflow/src/services/jira/errors.ts
    - taskflow/src/services/jira/errors.test.ts
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira/versions.ts
    - taskflow/src/services/jira/rank-api.ts
    - taskflow/src/services/jira.test.ts
    - taskflow/src/services/jira/versions.test.ts
    - taskflow/src/services/jira/rank-api.test.ts
    - taskflow/src/services/jira/__tests__/rank-api.test.ts

key-decisions:
  - "Joined-string helper (not a structured JiraFieldError) per locked CONTEXT decision — no consumer changes needed, useEditRelease.ts already collapses rejections to Error.message"
  - "Jira separator convention field: detail (colon) kept distinct from GitLab's field detail (no colon) — no shared generic extracted"
  - "rankIssueApi body read guarded with response.json?.() optional chaining so pre-existing test mocks lacking a json() method don't throw synchronously"

patterns-established:
  - "Pattern: Jira/GitLab service error bodies always route through a flatten*Error(body: unknown) helper before hitting a thrown Error/ApiError message — never read errorMessages?.[0] or message?.[0] directly"

requirements-completed: [QUICK-260813-dzc]

duration: 25min
completed: 2026-08-13
---

# Quick Task 260813-dzc: Flatten Jira Field-Validation Error Bodies Summary

**`flattenJiraError` helper (Jira sibling of `flattenGitLabError`) wired into all 5 Jira error paths so field-validation rejections (`errors: {field: detail}`) surface Jira's actual reason instead of a generic fallback.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-13T08:05:00Z (approx, worktree reset)
- **Completed:** 2026-08-13T08:14:29Z
- **Tasks:** 3/3 completed
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments
- New `flattenJiraError(body: unknown): string | undefined` helper with an 11-case shape-coverage test table mirroring `flattenGitLabError`'s
- All 4 pre-existing `errorMessages?.[0]` read sites (`jira.ts` fetchFixVersions/updateFixVersion/bulkUpdateIssue, `jira/versions.ts` fetchFixVersions) now route through the helper, so field-validation rejections (`{errorMessages:[],errors:{fixVersions:"..."}}`) surface the real reason instead of a generic literal
- `rank-api.ts`'s `rankIssueApi` now reads the error body on failure (previously threw a bare `status ${n}` with no body read at all) and flattens it the same way
- Zero remaining `errorMessages?.[0]` reads in non-comment source (verified by grep)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add flattenJiraError helper with shape-coverage tests** - `7d37e55b` (feat)
2. **Task 2: Wire flattenJiraError into the four existing errorMessages sites** - `1e309350` (feat)
3. **Task 3: Read and flatten the rank-api error body** - `1151d46a` (feat)

**Plan metadata:** (this commit, handled by orchestrator)

_Note: each task's RED (test) and GREEN (implementation) changes were combined into a single commit per task, per the pre-commit hook running the full vitest suite (see project note)._

## Files Created/Modified
- `taskflow/src/services/jira/errors.ts` - New `flattenJiraError` helper + private `flattenErrorMessages`/`flattenErrorsObject` candidates
- `taskflow/src/services/jira/errors.test.ts` - 11-case shape-coverage test table
- `taskflow/src/services/jira.ts` - `fetchFixVersions`, `updateFixVersion`, `bulkUpdateIssue` now call `flattenJiraError`; `bulkUpdateIssue` TSDoc widened
- `taskflow/src/services/jira/versions.ts` - `fetchFixVersions` (duplicate legacy path) now calls `flattenJiraError`
- `taskflow/src/services/jira/rank-api.ts` - `rankIssueApi`'s final `!response.ok` branch now reads and flattens the body
- `taskflow/src/services/jira.test.ts` - Added field-validation + fallback-literal + token-leak tests for `fetchFixVersions`, new `updateFixVersion` describe block, additional `bulkUpdateIssue` tests
- `taskflow/src/services/jira/versions.test.ts` - Added field-validation test for `fetchFixVersions`
- `taskflow/src/services/jira/rank-api.test.ts` - Added field-validation, populated-errorMessages, non-JSON-500-fallback, and token-leak tests
- `taskflow/src/services/jira/__tests__/rank-api.test.ts` - Updated pre-existing 500 assertion (see Deviations)

## Decisions Made
- Joined-string helper (locked by CONTEXT) — no structured per-field error class, no consumer changes
- `errorMessages` joined with `'; '`; `errors` object rendered `field: detail` joined with `'; '`; array details joined with `', '`; non-string/non-array details via `JSON.stringify` (never `String()`, avoiding `[object Object]`)
- Empty flatten (`[]`, `{}`, `''`) normalises to `undefined`, never `''`, so every caller's `?? 'literal'` fallback still fires (carries the GitLab WR-01 empty-string-vs-nullish lesson forward)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated a pre-existing test's exact-match assertion that collided with the new fallback message format**
- **Found during:** Task 3 (rank-api error body flattening), pre-commit full-suite run
- **Issue:** `src/services/jira/__tests__/rank-api.test.ts` (a file not listed in the plan's `files_modified`) asserted the 500-fallback message matched `/Failed to rank issue: 500/`. The new implementation composes the fallback as `` `status ${response.status}` `` per the plan's own behavior spec ("message still contains 'status 500'"), producing `"Failed to rank issue: status 500"` — the old regex no longer matched.
- **Fix:** Updated the regex to `/Failed to rank issue: status 500/` with a comment noting the new fallback literal.
- **Files modified:** `taskflow/src/services/jira/__tests__/rank-api.test.ts`
- **Verification:** `npx vitest run src/services/jira/__tests__/rank-api.test.ts src/services/jira/rank-api.test.ts` — 16/16 pass
- **Committed in:** `1151d46a` (Task 3 commit)

**2. [Rule 3 - Blocking] Guarded `response.json?.()` with optional chaining in `rank-api.ts`**
- **Found during:** Task 3, verifying pre-existing 500-status test mocks
- **Issue:** Several pre-existing test mocks (`{ ok: false, status: 500 } as Response`) omit a `json` method entirely. A direct `response.json()` call would throw synchronously before `.catch()` could attach, breaking those mocks.
- **Fix:** Used `await Promise.resolve(response.json?.()).catch(() => null)` so a missing `json` method resolves to `undefined`/`null` gracefully instead of throwing.
- **Files modified:** `taskflow/src/services/jira/rank-api.ts`
- **Verification:** All rank-api tests (old and new) pass
- **Committed in:** `1151d46a` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary to keep the pre-existing test suite green while implementing the plan's own locked behavior contract. No scope creep — no files touched beyond the Jira error-flattening surface.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `flattenJiraError` is available at `taskflow/src/services/jira/errors.ts` for any future Jira error-body read site
- Sole downstream consumer (`useEditRelease.ts`) required no change — the joined string drops straight into the existing `jiraError` string slot
- Full vitest suite: 184 files passed / 2 skipped, 2660 tests passed / 2 skipped / 13 todo (baseline was 2636 passed / 183 files) — net gain from new tests, no regressions
- `tsc --noEmit` clean; `biome check` clean on touched paths (two pre-existing format-only issues in newly-written test/impl files were auto-fixed with `biome check --write`, no new diagnostics introduced elsewhere)

---
*Phase: quick-260813-dzc*
*Completed: 2026-08-13*

## Self-Check: PASSED

All 9 created/modified files verified present on disk; all 3 task commits (7d37e55b, 1e309350, 1151d46a) verified present in `git log`.
