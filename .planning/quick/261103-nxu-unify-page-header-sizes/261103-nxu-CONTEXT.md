# Quick Task 261103-nxu: Unify page header sizes - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning

<domain>
## Task Boundary

Unify header sizes across the app. Main page headers match My Tasks / Standup notes
(`text-3xl font-semibold`, top-left in the standard `px-6 py-4 border-b` header bar).
Subpages (detail pages) get a smaller but still larger size: `text-2xl font-semibold`.
Only the title's size/weight changes; header-bar layout, subtitles and actions stay as they are.

</domain>

<decisions>
## Implementation Decisions

### Main pages → `text-3xl font-semibold`
- Already correct: My Tasks (routes/my-tasks/MyTasksPage.tsx:755), Standup notes (routes/standup-notes/StandupPageHeader.tsx:64), Releases (routes/dashboard/releases-list/ReleasesHero.tsx:59)
- Change: Backlog (BacklogPage.tsx:1320, text-lg), Merge Requests (MergeRequestListPage.tsx:123, text-lg; size the GitMerge icon to match), Sprint Board (SprintBoardHeader.tsx:35, text-lg; keep truncate/max-w), Epics (EpicsPage.tsx:255, text-xl), Worklogs (WorklogsPage.tsx:701, text-xl), Test cycles (AioProjectOverviewPage.tsx:352, text-xl)
- Debug Logs (routes/debug-logs/DebugLogs.tsx:131, text-2xl font-bold) and Developer Tools (routes/dev-tools/DevToolsPage.tsx:30, text-2xl) → text-3xl font-semibold
- Settings (routes/settings/Settings.tsx): ADD a standard header bar `<h1 className="text-3xl font-semibold">Settings</h1>` in the shared header pattern (shrink-0 px-6 py-4 border-b border-border). Section h2s stay at text-lg.

### Subpages → `text-2xl font-semibold`
- Release detail (release-detail/ReleaseHeader.tsx:168), AIO cycle detail (aio-cycle/CycleHeader.tsx:129), AIO test run detail (AioTestRunDetailPage.tsx:229) — text-lg → text-2xl, keep truncate
- MR detail (MergeRequestDetailPage.tsx:218, h2 text-xl) → text-2xl
- Issue detail: full page /issue/:key ONLY gets text-2xl. IssueDetailContent.tsx:271 (h2 text-xl) is shared with the peek side sheet, which must stay text-xl — scope with a prop (e.g. titleClassName / variant) passed from IssueDetailPage.

### Exceptions (unchanged)
- Dashboard home hero (dashboard/index.tsx:198, text-6xl centered — home-only by design)
- Onboarding WelcomeStep, ErrorPage, ChunkErrorBoundary, HardMinimumOverlay (full-screen states, not page headers)
- Settings section h2s, in-page section headings, KPI numbers (EpicProgressSummary)

</decisions>

<specifics>
## Specific Ideas
- Tests asserting header classes (e.g. text-lg/text-xl on these h1s) must be updated, not prod code bent.
- Check that icons/actions beside bumped titles still vertically align (items-center).
- Don't bulk find-replace classes — edit each site (see memory: scoped edits).
</specifics>

<canonical_refs>
No external specs — requirements fully captured in decisions above
</canonical_refs>
