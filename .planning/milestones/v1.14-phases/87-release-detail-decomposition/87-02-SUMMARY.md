---
phase: 87-release-detail-decomposition
plan: 02
subsystem: refactor
tags: [react, typescript, jira, gitlab, react-query, decomposition]

requires: ["87-01"]
provides:
  - "release-detail/useReleaseDetail.ts — single data-layer hook: 6 useQuery calls + gitlab-token useEffect + all derived values (D-07)"
  - "ReleaseDetailPage.tsx fetches nothing itself; sources all release data from useReleaseDetail(versionId)"
affects: [87-03, 87-04, 87-05, 87-06]

tech-stack:
  added: []
  patterns:
    - "Co-located feature hook (release-detail/useReleaseDetail.ts, not src/hooks/) mirroring issue-detail/useLinkedMRs.ts"
    - "Hook composes releaseSummaries.ts pure functions on query results, returns one flat object"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
  modified:
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx

key-decisions:
  - "Hook return object destructured explicitly in the page shell (26 named fields) rather than passed as a single object prop — preserves byte-identical variable names in JSX per plan constraint, at the cost of ~17 extra lines vs. the plan's <1150 LOC estimate (1167 actual)."
  - "useReleaseDetail imported via relative path (./release-detail/useReleaseDetail) from the page shell, matching the 87-PATTERNS.md page-shell-to-section import convention."

requirements-completed: [FOUND-01]

duration: 20min
completed: 2026-08-10
---

# Phase 87 Plan 02: Release Detail — Data Layer Extraction Summary

**Moved all 6 `useQuery` calls, the GitLab-token effect, and every derived-value computation out of `ReleaseDetailPage.tsx` into a new co-located `useReleaseDetail.ts` hook — page now fetches nothing itself, JSX output byte-unchanged.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)
- **Net LOC:** `ReleaseDetailPage.tsx` 1518 → 1167 lines (-351); `useReleaseDetail.ts` +197 lines

## Accomplishments

- `release-detail/useReleaseDetail.ts` created: named export `useReleaseDetail(versionId)`, runs all 6 `useQuery` calls with byte-identical `queryKey`/`staleTime`/`enabled` guards to the pre-refactor form (verified via grep gates: each of the 6 query-key literals appears exactly once, `5 * 60_000` appears 6 times, `readSecret('jira-pat')` appears 3 times — one per Jira query, not consolidated). Owns the `gitlabToken` `useState` + `useEffect` on `[gitlabBaseUrl]`. Calls into `releaseSummaries.ts` (Plan 01) for every derived value — zero `useMemo`, zero reimplemented logic.
- `ReleaseDetailPage.tsx` rewired: deleted the two local Jira fetchers (`fetchVersionIssueCounts`, `fetchFixVersionIssues`) + `VersionIssueCounts` interface, the `@tauri-apps/plugin-http` import, all 6 `useQuery` calls, the GitLab-token effect, and every inline derived `const`/IIFE (label summary/coverage, MR-state counts, issue-status counts, story points, GitLab match resolution, MR/issue matching, wrong-milestone map). Replaced with a single `useReleaseDetail(versionId)` call destructured into 22 named fields the JSX and `handleSave`/`startEditing` read directly.
- `useResizable`/`containerRef` (hazard 7 — ref spans both columns) and all edit-modal state/handlers (`editing`, six `edit*` states, `buildJiraDiff`/`buildGitlabDiff`/`handleSave`) stayed in the page shell exactly as scoped — they move in Plan 05, not this plan.
- Hook called unconditionally near the top of the component, above every other hook and above the `if (!versionId) return null` guard (hazard 9 — hook-order safety).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create release-detail/useReleaseDetail.ts with all 6 queries carried over verbatim** - `e1788f01` (feat)
2. **Task 2: Rewire ReleaseDetailPage.tsx onto useReleaseDetail and delete the inline data layer** - `4d5c7a02` (refactor)

**Plan metadata:** (this commit, docs: complete plan)

## Hook Return-Object Field List (for Plans 03-06)

`useReleaseDetail(versionId: string | undefined)` returns (all fields, in order):

```
version, isLoading, issueCounts, milestones, milestoneWindow, gitlabMatch,
matchedMilestone, fixVersionIssues, isLoadingIssues, milestoneMRs, releaseIssues,
releaseMrs, matchedRows, unmatchedMRs, missingRows, wrongMilestoneByKey,
labelSummary, labelCoverage, mrStateCounts, issueStatusCounts, storyPoints,
hasStoryPoints, gitlabToken, jiraBaseUrl, activeJiraProject, gitlabBaseUrl,
activeGitlabProject, storyPointsFieldKey
```

`ReleaseDetailPage.tsx` currently destructures 22 of these 28 fields (omits `milestones`, `milestoneWindow`, `fixVersionIssues`, `missingRows`, `storyPointsFieldKey` — not read by the JSX or edit-handler logic that remains in the shell). Plans 03-06 wiring section props can destructure directly from this same hook call rather than re-reading `useReleaseDetail.ts`.

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` - new co-located data-layer hook (197 lines)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - data layer deleted, rewired onto the hook (1518 → 1167 lines)

## Decisions Made

- Followed `issue-detail/useLinkedMRs.ts` as the structural analog per 87-PATTERNS.md: named export, store destructure at top, `useQuery` calls, flat returned object.
- Preserved D-11 (query-key cache-sharing contract with `ReleasesTab`/`UpcomingReleasesTimeline`) via exact verbatim copy of every `queryKey`, `staleTime`, and `enabled` expression — confirmed by the plan's grep-based acceptance criteria, all of which passed.
- Kept each Jira query's own duplicated `readSecret('jira-pat')` preamble rather than hoisting into a shared helper, per hazard 10 / D-16 in the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lint] Biome formatting on useReleaseDetail.ts**
- **Found during:** Task 1 verification
- **Issue:** `buildWrongMilestoneMap(matchedMilestone, recentProjectMRs, missingRows)` call exceeded the line-length limit as written on one line.
- **Fix:** Ran `npx biome format --write` to reflow to the project's multi-line call convention.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts`
- **Verification:** `npx biome check` clean; `npm run check` still at the 2-error `BacklogPage.tsx`/`BacklogRow.tsx` baseline (0 new).
- **Committed in:** `e1788f01`

### Noted, Not Auto-fixed

**1. `ReleaseDetailPage.tsx` line count (1167) exceeds the plan's `<1150` acceptance-criteria estimate by 17 lines**
- **Cause:** The plan's `wc -l` target was an estimate; the 26-line explicit hook-return destructure block (required to keep every JSX-read variable name byte-identical, per the plan's own "do not rename any variable the JSX reads" constraint) accounts for the delta. All other acceptance criteria (zero `useQuery`, zero inline fetchers, zero `@tauri-apps/plugin-http` import, `useResizable` retained, JSX diff shows no tag additions/deletions, `tsc`/test suites green) passed exactly as specified.
- **Impact:** Cosmetic only — no behavior, no scope creep, no unresolved acceptance criterion beyond this one soft numeric estimate.

---

**Total deviations:** 1 auto-fixed (Rule 1 — formatting), 1 noted soft-estimate miss (non-blocking)
**Impact on plan:** None on scope or behavior; all functional acceptance criteria pass.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03 (and 04-06) can now extract `ReleaseDetailPage.tsx`'s JSX sections into `release-detail/*.tsx` component files, wiring each from the same `useReleaseDetail(versionId)` call already established in the page shell. `ReleaseDetailPage.tsx` fetches nothing itself; the hook's full return-object field list (above) is ready for prop-passing without re-reading `useReleaseDetail.ts`.

No blockers.

---
*Phase: 87-release-detail-decomposition*
*Completed: 2026-08-10*
