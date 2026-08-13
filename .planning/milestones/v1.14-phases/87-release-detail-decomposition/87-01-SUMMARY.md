---
phase: 87-release-detail-decomposition
plan: 01
subsystem: refactor
tags: [react, typescript, jira, gitlab, vitest, decomposition]

requires: []
provides:
  - "releaseSummaries.ts — 11 pure, React-free derived-computation functions + MILESTONE_LEEWAY_DAYS const + LabelCoverage interface"
  - "releaseSummaries.test.ts — Wave 0 unit coverage (13 tests) for the six edge-case groups"
  - "fetchVersionIssueCounts + fetchFixVersionIssues + VersionIssueCounts exported from services/jira.ts, routed through apiFetch"
affects: [87-02, 87-03, 87-04, 87-05, 87-06]

tech-stack:
  added: []
  patterns:
    - "React-free pure computation module co-located with its feature folder (release-detail/), mirroring services/releaseLinker.ts"
    - "Named exports + JSDoc @param/@returns for every exported pure function"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts
    - taskflow/src/routes/dashboard/release-detail/releaseSummaries.test.ts
  modified:
    - taskflow/src/services/jira.ts

key-decisions:
  - "D-12a (user-approved): fetchVersionIssueCounts and fetchFixVersionIssues now go through apiFetch('jira', ...) instead of raw @tauri-apps/plugin-http fetch — gains a 15s AbortController timeout and 401 markDisconnected behavior they did not have before. This is the only intentional behavior delta in Phase 87."
  - "ReleaseDetailPage.tsx deliberately left untouched (D-16) — its inline copies of these computations/fetchers remain the live code path until Plan 02 deletes them; temporary duplication is intended."

requirements-completed: [FOUND-01]

duration: 25min
completed: 2026-08-10
---

# Phase 87 Plan 01: Release Detail — Pure Logic + Service Extraction Summary

**Extracted 11 React-free derived-computation functions plus two Jira fetchers out of the 1518-LOC `ReleaseDetailPage.tsx` monolith, with 13 new unit tests, without touching the page file itself.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-10T12:28:00Z (approx, per STATE.md)
- **Completed:** 2026-08-10T14:34:00Z
- **Tasks:** 3 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `release-detail/releaseSummaries.ts` created with 11 pure computations (`computeMilestoneWindow`, `resolveGitLabMatch`, `matchIssuesToMRs`, `buildWrongMilestoneMap`, `computeLabelSummary`, `computeLabelCoverage`, `computeMrStateCounts`, `computeIssueStatusCounts`, `issueStoryPoints`, `computeStoryPoints`, `computeHasStoryPoints`) plus `MILESTONE_LEEWAY_DAYS` and the `LabelCoverage` interface — zero React/store/react-query imports, zero `useMemo`.
- `release-detail/releaseSummaries.test.ts` covers all six Wave 0 edge-case groups from 87-VALIDATION.md (13 passing tests): label-summary empty/omit-unlabeled/alpha-tiebreak, label-coverage null-on-empty + allLabeled false, MR state `locked`→`closed` bucketing, story-points null/undefined/non-number exclusion + done-only completed sum, `hasStoryPoints` `sp > 0` (not `!== null`), issue-status-counts unknown/missing `statusCategory`→`new`, and `computeMilestoneWindow`'s month-boundary rollback.
- `fetchVersionIssueCounts`, `fetchFixVersionIssues`, and `VersionIssueCounts` added to the legacy `services/jira.ts` (the file all ~60 imports point at), placed after `fetchFixVersions`, routed through `apiFetch('jira', ...)` instead of raw `fetch` from `@tauri-apps/plugin-http`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create release-detail/releaseSummaries.ts as a React-free pure module** - `aa00b7c8` (feat)
2. **Task 2: Write releaseSummaries.test.ts covering the Wave 0 edge cases** - `4d1e1cb7` (test)
3. **Task 3: Move the two Jira fetchers into services/jira.ts using apiFetch** - `6df5e91f` (feat)
4. **Post-task formatting fixup** - `d48a3526` (style) — biome auto-format of Task 2's test file to keep `npm run check` at the 2-error baseline

**Plan metadata:** (this commit, docs: complete plan)

## Exported Symbols Reference (for Plan 02)

`taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts` exports, ready to be imported directly by `ReleaseDetailPage.tsx` / a future `useReleaseDetail.ts`:

- `MILESTONE_LEEWAY_DAYS: number` (= 7)
- `computeMilestoneWindow(releaseDate: string | null | undefined): { from: string; to: string } | null`
- `resolveGitLabMatch(releaseDate, milestones): { gitlabMatch: ReleaseMatch; matchedMilestone: GitLabMilestone | null }`
- `matchIssuesToMRs(releaseIssues, releaseMrs): { matchedRows: Array<{ issue: JiraIssue; mr: GitLabMR | null }>; unmatchedMRs: GitLabMR[] }`
- `buildWrongMilestoneMap(matchedMilestone, recentProjectMRs, missingRows): Map<string, GitLabMR>`
- `computeLabelSummary(releaseMrs): Array<{ label: { name; color; text_color }; count: number }>`
- `LabelCoverage` interface + `computeLabelCoverage(releaseMrs): LabelCoverage | null`
- `computeMrStateCounts(releaseMrs): { merged; opened; closed }`
- `computeIssueStatusCounts(releaseIssues): { new; indeterminate; done }`
- `issueStoryPoints(issue, storyPointsFieldKey): number | null`
- `computeStoryPoints(releaseIssues, storyPointsFieldKey): { total; completed }`
- `computeHasStoryPoints(releaseIssues, storyPointsFieldKey): boolean`

`taskflow/src/services/jira.ts` now also exports:

- `VersionIssueCounts` interface (`{ issuesFixed: number; issuesTotal: number }`)
- `fetchVersionIssueCounts(baseUrl, token, versionId): Promise<VersionIssueCounts>` — never throws on HTTP failure, resolves to `{ issuesFixed: 0, issuesTotal: 0 }`-style fallback per failed sub-request
- `fetchFixVersionIssues(baseUrl, token, versionId, storyPointsFieldKey): Promise<JiraIssue[]>` — throws plain `Error('Failed to fetch issues: status ${status}')` on non-OK

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts` - 11 pure derived-computation functions extracted verbatim from `ReleaseDetailPage.tsx`
- `taskflow/src/routes/dashboard/release-detail/releaseSummaries.test.ts` - 13 unit tests covering Wave 0 edge cases
- `taskflow/src/services/jira.ts` - added `fetchVersionIssueCounts`, `fetchFixVersionIssues`, `VersionIssueCounts`

## Decisions Made

- Followed 87-PATTERNS.md exactly: `releaseLinker.ts` as the structural analog for the pure module, `fetchFixVersions` as the analog for the two moved fetchers.
- D-12a behavior delta implemented exactly as scoped: both fetchers gained `apiFetch`'s 15s timeout + 401 disconnect-marking, with their original fallback/error contracts otherwise preserved verbatim (no `ApiError` conversion, no new throw branches).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/lint] Biome formatting violation in releaseSummaries.test.ts**
- **Found during:** Post-task-2 verification (`npm run check`)
- **Issue:** The `makeIssue` test helper's multi-line object-type parameter was written in a single-line form that biome's formatter reflows to a wrapped multi-line form; this produced a new formatting error beyond the 2-error baseline (`BacklogPage.tsx`/`BacklogRow.tsx`).
- **Fix:** Ran `npx biome format --write` on the file to match project formatting conventions.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/releaseSummaries.test.ts`
- **Verification:** `npm run check` re-run — back to exactly 2 pre-existing baseline errors, 0 new.
- **Committed in:** `d48a3526`

---

**Total deviations:** 1 auto-fixed (Rule 1 — formatting)
**Impact on plan:** Cosmetic only; no scope creep. All acceptance criteria and the plan's overall verification block pass.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02 can now import all 11 `releaseSummaries.ts` functions and the two `services/jira.ts` fetchers directly, and begin extracting `ReleaseDetailPage.tsx`'s sections/sidebar/modal into `release-detail/*.tsx` files and deleting the now-duplicated inline logic. `ReleaseDetailPage.tsx` is byte-unchanged after this plan, confirmed via `git diff --name-only` on every task.

No blockers.

---
*Phase: 87-release-detail-decomposition*
*Completed: 2026-08-10*
