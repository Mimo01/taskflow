---
phase: quick-261103-nxu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/MergeRequestListPage.tsx
  - taskflow/src/routes/dashboard/SprintBoardHeader.tsx
  - taskflow/src/routes/dashboard/SprintBoardHeader.test.tsx
  - taskflow/src/routes/dashboard/EpicsPage.tsx
  - taskflow/src/routes/worklogs/WorklogsPage.tsx
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
  - taskflow/src/routes/debug-logs/DebugLogs.tsx
  - taskflow/src/routes/dev-tools/DevToolsPage.tsx
  - taskflow/src/routes/settings/Settings.tsx
  - taskflow/src/routes/settings/Settings.test.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.test.tsx
  - taskflow/src/routes/dashboard/aio-cycle/CycleHeader.tsx
  - taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
  - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
autonomous: true
requirements: [QUICK-261103-nxu]

must_haves:
  truths:
    - "Every main page title (Backlog, Merge Requests, Sprint Board, Epics, Worklogs, Test cycles, Debug Logs, Developer Tools, Settings) renders text-3xl font-semibold, matching My Tasks / Standup notes / Releases"
    - "Settings has a standard top-left header bar (shrink-0 px-6 py-4 border-b border-border) with an h1 'Settings'; section h2s stay text-lg"
    - "Subpage titles (Release detail, AIO cycle detail, AIO test run detail, MR detail, full-page issue detail) render text-2xl font-semibold, keeping truncate where present"
    - "The issue peek side sheet title stays text-xl; only /issue/:key gets text-2xl"
    - "Exceptions untouched: dashboard home hero, onboarding WelcomeStep, ErrorPage, ChunkErrorBoundary, HardMinimumOverlay, in-page section headings, KPI numbers"
  artifacts:
    - path: "taskflow/src/routes/settings/Settings.tsx"
      provides: "Settings header bar"
      contains: "text-3xl font-semibold"
    - path: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      provides: "titleClassName prop scoping title size"
      contains: "titleClassName"
  key_links:
    - from: "taskflow/src/routes/dashboard/IssueDetailView.tsx"
      to: "IssueDetailContent titleClassName"
      via: "layout === 'two-column' passes text-2xl"
      pattern: "titleClassName"
---

<objective>
Unify page header title sizes: main pages `text-3xl font-semibold`, subpages `text-2xl font-semibold`, with the listed exceptions untouched. Only the title's size/weight changes (plus the new Settings header bar per CONTEXT); header-bar layout, subtitles and actions stay as they are.

Purpose: consistent page hierarchy across the app (see memory: page header consistency).
Output: edited title classes at each site, Settings header bar, IssueDetailContent title prop, updated tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261103-nxu-unify-page-header-sizes/261103-nxu-CONTEXT.md

Repo root (git, .planning) is /Users/mimo/Documents/Projects/taskflow. The app (src, npm, vitest, biome, tsc) lives in /Users/mimo/Documents/Projects/taskflow/taskflow. All source paths below are relative to taskflow/taskflow/src.

Reference (already correct, do not edit): routes/my-tasks/MyTasksPage.tsx:755, routes/standup-notes/StandupPageHeader.tsx:64, routes/dashboard/releases-list/ReleasesHero.tsx:59 — all `text-3xl font-semibold`.

Rules:
- Edit each site individually with the Edit tool. NO bulk find-replace / sed across files, NO `biome --write` on all of src (memory: scoped edits).
- After each edit, grep the exact line to confirm it changed (memory: verify scripted edits).
- Tests asserting old classes get updated; prod code is never bent to satisfy a test.
- Pre-commit hook runs the full vitest suite and lint; each task must commit green. Commit with `git commit -- <paths>` and check `git log -1 --stat` (memory: staged files after failed hook).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Main page titles to text-3xl font-semibold + Settings header bar</name>
  <files>routes/dashboard/BacklogPage.tsx, routes/dashboard/MergeRequestListPage.tsx, routes/dashboard/SprintBoardHeader.tsx, routes/dashboard/SprintBoardHeader.test.tsx, routes/dashboard/EpicsPage.tsx, routes/worklogs/WorklogsPage.tsx, routes/dashboard/AioProjectOverviewPage.tsx, routes/debug-logs/DebugLogs.tsx, routes/dev-tools/DevToolsPage.tsx, routes/settings/Settings.tsx, routes/settings/Settings.test.tsx</files>
  <action>
Per CONTEXT "Main pages" decisions, change each title's size/weight to `text-3xl font-semibold`, leaving every other class on the element intact:
- BacklogPage.tsx:1320 h1 "Backlog": text-lg → text-3xl.
- MergeRequestListPage.tsx:123 h1 "Merge Requests": text-lg → text-3xl; the sibling GitMerge icon at line 122 (currently size-5) gets resized to match the larger title (size-7); its parent row is already `flex items-center gap-2`, keep that.
- SprintBoardHeader.tsx:35 h1: text-lg → text-3xl; keep `min-w-0 max-w-[60%] truncate text-foreground`. Confirm the parent row aligns with items-center; if the row uses items-baseline or similar, leave alignment as is unless the bumped title visibly misaligns adjacent controls.
- EpicsPage.tsx:255, WorklogsPage.tsx:701, AioProjectOverviewPage.tsx:352: text-xl → text-3xl.
- DebugLogs.tsx:131: `text-2xl font-bold` → `text-3xl font-semibold`. DevToolsPage.tsx:30: text-2xl → text-3xl. Do not restructure these pages' containers (subtitles/actions stay).
- Settings.tsx: the root is currently `<div className="flex h-full min-h-0">` containing nav + content. Wrap it so the root becomes a `flex flex-col h-full min-h-0` column whose first child is a header bar `<div className="shrink-0 px-6 py-4 border-b border-border">` containing `<h1 className="text-3xl font-semibold">Settings</h1>`, and whose second child is the existing nav+content row with `flex flex-1 min-h-0` (so nav and content still scroll independently). Section h2s (text-lg) are unchanged.

Tests: update SprintBoardHeader.test.tsx:63 (`toContain('text-lg')`) to assert `text-3xl`. Run a grep for other tests that assert old classes on these headings (`grep -rn -E "text-(lg|xl|2xl)" --include='*.test.tsx'` within the touched route dirs) and update any that target these titles. In Settings.test.tsx, check for queries like getByText('Settings') / getAllByRole('heading') that the new h1 could make ambiguous and adjust; add one assertion that a heading named "Settings" (level 1) renders with class text-3xl.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/SprintBoardHeader.test.tsx src/routes/settings src/routes/dashboard/BacklogPage src/routes/dashboard/EpicsPage src/routes/dashboard/MergeRequestListPage src/routes/worklogs src/routes/dashboard/AioProjectOverviewPage src/routes/debug-logs src/routes/dev-tools && npx tsc --noEmit && npx biome check src/routes/dashboard/BacklogPage.tsx src/routes/dashboard/MergeRequestListPage.tsx src/routes/dashboard/SprintBoardHeader.tsx src/routes/dashboard/SprintBoardHeader.test.tsx src/routes/dashboard/EpicsPage.tsx src/routes/worklogs/WorklogsPage.tsx src/routes/dashboard/AioProjectOverviewPage.tsx src/routes/debug-logs/DebugLogs.tsx src/routes/dev-tools/DevToolsPage.tsx src/routes/settings/Settings.tsx src/routes/settings/Settings.test.tsx</automated>
  </verify>
  <done>All nine main-page titles carry text-3xl font-semibold (grep each line); Settings shows a top-left header bar; tests, tsc and biome on changed files pass; committed as fix/feat(261103-nxu) with green pre-commit.</done>
</task>

<task type="auto">
  <name>Task 2: Subpage titles to text-2xl font-semibold, issue page scoped via prop</name>
  <files>routes/dashboard/release-detail/ReleaseHeader.tsx, routes/dashboard/release-detail/ReleaseHeader.test.tsx, routes/dashboard/aio-cycle/CycleHeader.tsx, routes/dashboard/AioTestRunDetailPage.tsx, routes/dashboard/MergeRequestDetailPage.tsx, routes/dashboard/IssueDetailContent.tsx, routes/dashboard/IssueDetailView.tsx</files>
  <action>
Per CONTEXT "Subpages" decisions:
- ReleaseHeader.tsx:168, CycleHeader.tsx:129, AioTestRunDetailPage.tsx:229 h1s: text-lg → text-2xl, keep `min-w-0 truncate`, title attr and data-testid.
- MergeRequestDetailPage.tsx:218 h2: text-xl → text-2xl (keep leading-snug flex-1). Check icons/badges in the same row still align (items-center or items-start as currently); do not change layout.
- Issue detail: IssueDetailContent.tsx:271 h2 is shared with the peek sheet (IssueDetailSheet.tsx:125 renders IssueDetailContent directly) which must stay text-xl. Add an optional prop `titleClassName?: string` to IssueDetailContentProps (line 48) with JSDoc noting it sizes the summary title; default to 'text-xl'. Render the h2 with `cn(titleClassName ?? 'text-xl', 'font-semibold leading-snug')` (cn from '@/lib/utils', already used in the codebase). In IssueDetailView.tsx (~line 503) pass `titleClassName={layout === 'two-column' ? 'text-2xl' : undefined}` — two-column is the full-page /issue/:key layout (IssueDetailPage.tsx:84). Do not touch IssueDetailSheet.

Tests: update ReleaseHeader.test.tsx:82 (`toHaveClass('text-lg', 'font-semibold')`) to text-2xl. Grep tests under routes/dashboard (aio-cycle, AioTestRunDetail, MergeRequestDetail, IssueDetail*) for old title-class assertions and update. Add a test (in an existing IssueDetailContent test file if one exists, otherwise skip adding a new file) asserting the title defaults to text-xl and uses text-2xl when titleClassName="text-2xl".
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail src/routes/dashboard/aio-cycle src/routes/dashboard/AioTestRunDetailPage src/routes/dashboard/MergeRequestDetailPage src/routes/dashboard/IssueDetail && npx tsc --noEmit && npx biome check src/routes/dashboard/release-detail/ReleaseHeader.tsx src/routes/dashboard/release-detail/ReleaseHeader.test.tsx src/routes/dashboard/aio-cycle/CycleHeader.tsx src/routes/dashboard/AioTestRunDetailPage.tsx src/routes/dashboard/MergeRequestDetailPage.tsx src/routes/dashboard/IssueDetailContent.tsx src/routes/dashboard/IssueDetailView.tsx</automated>
  </verify>
  <done>Five subpage titles are text-2xl font-semibold; peek sheet title remains text-xl (IssueDetailSheet untouched); exceptions untouched (git diff shows no change to dashboard/index.tsx, WelcomeStep, ErrorPage, ChunkErrorBoundary, HardMinimumOverlay); tests/tsc/biome pass; committed with green pre-commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | Styling-only change; no new input, data flow, or dependency |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nxu-01 | Tampering | page header classNames | accept | Static class strings only; no user data reaches className |
</threat_model>

<verification>
- `grep -rn --include='*.tsx' -E '<h[12][^>]*text-(lg|xl)' src/routes` in taskflow/taskflow shows none of the listed main/sub page titles (only section headings, the peek default, and exceptions).
- Full vitest suite passes via the pre-commit hook on each commit.
</verification>

<success_criteria>
Main pages at text-3xl font-semibold, subpages at text-2xl font-semibold, Settings has the standard header bar, peek sheet unchanged, exceptions unchanged, all checks green.
</success_criteria>

<output>
Create `.planning/quick/261103-nxu-unify-page-header-sizes/261103-nxu-SUMMARY.md` when done
</output>
