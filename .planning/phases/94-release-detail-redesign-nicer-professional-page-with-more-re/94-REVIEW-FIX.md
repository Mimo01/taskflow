---
phase: 94-release-detail-redesign-nicer-professional-page-with-more-re
fixed_at: 2026-10-30T18:45:00Z
review_path: .planning/phases/94-release-detail-redesign-nicer-professional-page-with-more-re/94-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 94: Code Review Fix Report

**Fixed at:** 2026-10-30
**Source review:** .planning/phases/94-release-detail-redesign-nicer-professional-page-with-more-re/94-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (CR-01..CR-03, WR-01..WR-08; Info findings out of scope)
- Reproduced: 11 of 11. Before each fix, a regression test (a compile check for WR-03) was written and seen to fail on the unchanged code.
- Fixed: 11
- Skipped / not reproduced: 0

These are behaviour fixes only. The approved 94-08 visual design is unchanged. The only visual changes are the ones the findings call for: a loading or "Couldn't check" state where the page used to show a false "Missing", the MR error text, the restructured skeleton, and the merged Done status row.
`services/jira.ts` was not touched (no finding needed it). STATE.md and ROADMAP.md were not touched.

Paths below are relative to `taskflow/src/`.

## Fixed Issues

### CR-01: MR donut shows a loading skeleton forever when the milestone-MR fetch fails

**Verified:** yes. With `milestoneMRs` undefined after a Channel B rejection, the page rendered `release-graph-mrs-skeleton` and had no error state.
**Tests:** `ReleaseDetailPage.test.tsx`: "a failed milestone-MR fetch shows the MR slot error…" and "…still in flight shows the MR slot skeleton". `useReleaseDetail.test.tsx`: Test 2b and 2c (`milestoneMrsFailed`).
**Fix:** `useReleaseDetail` returns `milestoneMrsFailed` (`channelBFailed && !milestoneMRs`). `donutState` gains an `'error'` arm. `ReleaseMrDonut.state` is widened to `GraphSlotState`, with the error label "Couldn't load merge requests. Refresh to try again."
**Files:** `routes/dashboard/release-detail/useReleaseDetail.ts`, `routes/dashboard/ReleaseDetailPage.tsx`, `routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx` (+ tests)
**Commit:** 0ff0171c

### CR-02: Milestone fact says "Missing" when the lookup failed, is still loading, or never ran

**Verified:** yes. All three cases reproduced: pending list, failed fetch, and unreadable token. Each one rendered "Missing" (the pending and token cases also showed Create milestone), and the branch fact said "Create the milestone first".
**Tests:** `ReleaseFacts.test.tsx`: pending → Loading; failed and unavailable → Couldn't check, with no Missing and no Create, and the branch fact not saying "Create the milestone first". `useReleaseDetail.test.tsx`: a `milestoneLookup (94 CR-02)` block that checks pending (list in flight), pending (token not read yet), failed, unavailable (token rejected) and resolved. `ReleaseDetailPage.test.tsx`: lookup pending → no Missing and no Create; lookup resolved → Missing + Create.
**Fix:** `useReleaseDetail` returns `milestoneLookup: 'pending' | 'failed' | 'unavailable' | 'resolved'`. A new `gitlabTokenRead` flag means a token that has not been read yet shows as pending, not unavailable, so there is no "Couldn't check" flash on mount. `milestoneValue` shows Loading... while pending and an orange "Couldn't check" when the lookup failed or is unavailable. Missing and Create only appear once the lookup has resolved. `canCreateMilestone` also requires a resolved lookup. The branch fact reads Loading... or Couldn't check instead of "Create the milestone first" while the lookup is unresolved.
**Files:** `routes/dashboard/release-detail/useReleaseDetail.ts`, `routes/dashboard/release-detail/ReleaseFacts.tsx`, `routes/dashboard/ReleaseDetailPage.tsx` (+ tests)
**Commit:** 02c4ca21

### CR-03: An empty fix version hides the package-orphan fix list and the unmatched-MR table

**Verified:** yes. With `releaseIssues = []`, neither `DeploymentPackageSection` nor the uncovered-MR secondary table rendered, even when they had content.
**Tests:** `ReleaseDetailPage.test.tsx`: "no issues but uncovered MRs: the task table still renders…" and "no issues but package mismatches: the package section renders…". The existing "no issues: one friendly empty state" test, where everything is empty, still passes. A controllable stand-in for `DeploymentPackageSection` is mocked in the page test.
**Fix:** `noIssues` now gates only the graphs and the done bar. `DeploymentPackageSection` always renders and reports whether it has rows through a new optional `onHasRowsChange`, which fires from a layout effect so the notice and the section swap in the same frame. The task table renders when there are issues or uncovered MRs. The friendly notice shows only when there are no issues, no uncovered MRs and no package rows. DeploymentPackageSection's pre-existing compiler bailout is unchanged (`_c(11)` plus the same 2 CompileErrors before and after).
**Files:** `routes/dashboard/ReleaseDetailPage.tsx`, `routes/dashboard/release-detail/DeploymentPackageSection.tsx` (+ test)
**Commit:** 3fb0c276

### WR-01: Burnup keeps the 640px fallback width when it mounts before the issues load

**Verified:** yes. New test `ReleaseBurnup.width.test.tsx` (no `useElementWidth` mock): render in the loading state, then rerender ready with a 300px ResizeObserver. `timeTicks` still received 640.
**Fix:** Replaced `useElementWidth(useRef)` with the callback-ref + ResizeObserver pattern from `ReleaseTypeWaffle` (`useState` element plus a measured width, falling back to 640). Removed the now-inert `useElementWidth` mock from `ReleaseBurnup.test.tsx`.
**Files:** `routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx`, `ReleaseBurnup.test.tsx`, `ReleaseBurnup.width.test.tsx` (new)
**Commit:** c9fd41b9

### WR-02: Wide windows first paint the 2x2 layout, then switch to the band

**Verified:** yes. New page test renders with `createRoot` outside `act()` at a container width of 1300px. A MutationObserver (a microtask, which runs before the next task could paint) records the first DOM state of the graph grid. On the old code that first state was the 2x2 grid.
**Fix:** This was the least invasive option: the page-width measurement moved from `useEffect` to `useLayoutEffect`. The width update now flushes synchronously inside the commit, so the band is the first layout that paints. The brief 2x2 tree is thrown away before paint. Remounting the graphs on a real resize across 1180px is unchanged. Remounts no longer reset the burnup width, because WR-01 fixed that.
**Files:** `routes/dashboard/ReleaseDetailPage.tsx` (+ test)
**Commit:** 48a6b1af

### WR-03: ReleaseDetailPage no longer compiles under React Compiler

**Verified:** yes. Compiling with babel-plugin-react-compiler reported `CompileError: (BuildHIR::lowerStatement) Handle TryStatement without a catch clause` and emitted no memo cache. A try/catch/finally would still bail ("TryStatement with a finalizer").
**Test:** new `ReleaseDetailPage.compile.test.ts`. It compiles the page with `@babel/core` (via createRequire) and `babel-plugin-react-compiler`, then asserts that no CompileError occurred and a `_c(n)` cache exists. It failed before the fix.
**Fix:** `handleRefresh` now calls `.finally(() => setRefreshing(false))` on the refresh promise, and the page compiles again (`_c(182)`). Follow-on: once compiled, the page's own `toLocalDateString(new Date())` would have been cached for the life of the mount, so `today` now comes from `useReleaseDetail`, which recomputes it on every render (an additive return field). DeploymentPackageSection was not made worse (unchanged `_c(11)` and 2 pre-existing errors).
**Files:** `routes/dashboard/ReleaseDetailPage.tsx`, `routes/dashboard/release-detail/useReleaseDetail.ts`, `ReleaseDetailPage.compile.test.ts` (new), `ReleaseDetailPage.test.tsx`
**Commit:** 6f076097

### WR-04: The Refresh button does not refresh the deployment-package data

**Verified:** yes. A new real-QueryClient test seeds `jira-projects-rm`, `rm-week-list`, `rm-week-children`, `rm-package`, `jira-package-no-fixversion` and a cross-project `jira-fix-versions` entry. Before the fix, none of the RM/package entries and not the other project's versions were invalidated.
**Fix:** Stage 1 now invalidates `['jira-fix-versions']` (without the project segment, so cross-project lists are included), `['jira-projects-rm']` and `['rm-week-list']`. Stage 2 adds `['rm-week-children']`, `['rm-package']` and `['jira-package-no-fixversion', activeJiraProject]`. The existing staging test was updated to the new call order and counts.
**Files:** `lib/release-refresh.ts`, `lib/release-refresh.test.ts`
**Commit:** 7675982b

### WR-05: Skeleton container queries never match, and the skeleton describes a layout that no longer exists

**Verified:** yes. The skeleton renders in place of the `@container/page` scroll wrapper (`ReleaseDetailPage.tsx`, skeleton branch), so it had no page container, and it still drew a side column. New test: the root is `@container/page`, there is no side column, the graph block carries the 2x2 and `@min-[1180px]/page:` band columns, and there is a property-strip line.
**Fix:** The skeleton root is now `@container/page`. The quad and side column are replaced by one `skeleton-graphs` grid that mirrors the page: 2x2 by default, the 640/440px breakpoints, and the 4-column band at 1180px or wider (assignee placeholder moved last in band order). The header has a property-strip line and the page's pb-3, and the table spacing matches pt-6.
**Files:** `routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx`, `ReleaseDetailSkeleton.test.tsx`
**Commit:** 801bd094

### WR-06: A paused (offline) issues query renders as a settled "No issues in this fix version yet"

**Verified:** yes. The premise was confirmed in `useReleaseDetail.test.tsx` with `onlineManager.setOnline(false)`: `fetchStatus` is `'paused'`, there is no data, and `isLoadingIssues` and `issuesError` are both false. In that state the page rendered the empty notice.
**Tests:** `ReleaseDetailPage.test.tsx`: "paused issues query…: loading graphs, no empty notice" (also checks the table shows "Loading issues..." and not "No issues in this fix version") and "issues query failed with no data: graphs show the error state".
**Fix:** `issueGraphState` is now `!fixVersionIssues ? (issuesError ? 'error' : 'loading') : length === 0 ? 'empty' : 'ready'`. The task table's `isLoadingIssues` follows the same rule (`issueGraphState === 'loading'`).
**Files:** `routes/dashboard/ReleaseDetailPage.tsx` (+ tests)
**Commit:** 0d18e8b8

### WR-07: Links in the milestone description navigate the Tauri webview away from the app

**Verified:** yes. Clicking a rendered markdown link did not prevent the default action, and `openExternal` was not called.
**Test:** `ReleaseDescription.test.tsx`: "opens milestone-description links externally and keeps the webview in place".
**Fix:** A module-level ReactMarkdown `components.a` override prevents the default action and calls `openExternal(href)`, the app's external-URL boundary that WikiRenderer also uses. In-document (`#`) and href-less anchors stay plain. No class or style was added.
**Files:** `routes/dashboard/release-detail/ReleaseDescription.tsx` (+ test)
**Commit:** 389d317a

### WR-08: In band mode, "By status" drops the in-progress and to-do statuses first

**Verified:** yes. In compact mode with 5 done statuses plus In Progress and To Do, neither actionable row rendered, and the "+N more statuses" line had no tooltip.
**Tests:** `ReleaseStatusRows.test.tsx`: done-heavy rows collapse into one Done row (count 15) with In Progress and To Do visible; the overflow line (`status-more`) shows the hidden statuses on hover.
**Fix:** New pure `fitStatusRows(rows, max)` in `releaseBuckets.ts`. On overflow it merges all done statuses into one "Done" row (the tooltip shows a "Done statuses" count), then returns whatever still doesn't fit as `hidden`. The overflow line is now a tooltip trigger listing up to 3 hidden statuses plus "+N more", matching ReleaseAssigneeRows. It keeps the same classes and text. The behaviour without overflow is unchanged.
**Files:** `routes/dashboard/release-detail/releaseBuckets.ts`, `routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx` (+ test)
**Commit:** 79bf8c06

## Final verification

- Full suite (`npm run test`): 269 files passed, 1 skipped; 4138 tests passed, 2 skipped, 7 todo.
- `tsc --noEmit`: clean.
- `biome check ./src`: no diagnostics in any file this fix touched. The remaining diagnostics are the existing baseline in 5 unrelated files (chart.tsx, internalLinks.test.ts, BacklogRow.tsx, MyTaskRow.tsx, MyTasksPage.test.tsx).
- React Compiler: ReleaseDetailPage `_c(182)` with no bailout. DeploymentPackageSection is unchanged from before this fix (`_c(11)` plus the 2 known CompileErrors).

---

_Fixed: 2026-10-30_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
