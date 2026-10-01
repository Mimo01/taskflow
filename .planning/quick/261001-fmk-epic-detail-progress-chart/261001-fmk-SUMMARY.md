# Quick 261001-fmk: Epic detail progress section - Summary

Epic detail (Sheet and View) now shows an "Epic progress" region above the Stories list: burnup, status bar + legend, per-assignee bars, 4 stat tiles, Count/SP toggle (default Count).

## Commits
- f7f792be feat: pure `epic-progress` lib (burnup, status/assignee buckets, forecast) + `fetchEpicStories` now also requests created, resolutiondate, updated, statuscategorychangedate (JQL/ORDER BY untouched; optional typed fields on JiraIssue).
- dd5006bd feat: `EpicProgressSection.tsx` (+ test) wired into `IssueDetailContent` isEpic branch above Stories `<section>`.

## Files
- taskflow/src/lib/epic-progress.ts, epic-progress.test.ts (new)
- taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, .test.tsx (new)
- taskflow/src/services/jira.ts, jira.test.ts; taskflow/src/routes/dashboard/IssueDetailContent.tsx (modified)
- EpicProgressCells.tsx untouched.

## Deviations
- Added `formatDateKey` export to the lib (locale-independent "MMM d" for the forecast tile); not in plan's export list.
- Used `<section aria-label>` (implicit region role) instead of explicit `role="region"` because biome flags the redundant role; toggle group has a biome-ignore for useSemanticElements (same precedent as TimelineFilterChips).
- Worklogs flaky test (WorklogsPage "Custom range does not fetch...") timed out under full-suite load on 3 pre-commit attempts of commit 2; passes in isolation and the 4th attempt passed. No `--no-verify`.
- Worktree needed a node_modules symlink (not committed).
- EpicDetailSheet.test.tsx passes unchanged (no scoping needed).

## Verification
tsc clean; biome clean on touched files; full vitest 2873 passed (pre-commit).

## Pending
Task 3 (visual UAT checkpoint) - to be run by orchestrator with the user. Note A2: done-line may step late when resolutiondate is null (falls back to statuscategorychangedate/updated).

## Known Stubs
None.
