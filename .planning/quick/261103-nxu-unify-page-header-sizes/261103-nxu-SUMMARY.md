---
phase: quick-261103-nxu
plan: 01
completed: 2026-11-03
commits: [ff901d68, 1cebf9dc]
---

# Quick 261103-nxu: Unify page header sizes

Main page titles (Backlog, Merge Requests, Sprint Board, Epics, Worklogs, Test cycles, Debug Logs, Developer Tools, Settings) are now `text-3xl font-semibold`. Subpage titles (Release, AIO cycle, AIO test run, MR detail, full-page issue) are `text-2xl font-semibold`.

- Settings gained a standard header bar (`shrink-0 px-6 py-4 border-b border-border`, h1 "Settings"); the nav and content row became a `flex flex-1 min-h-0` child.
- MR list GitMerge icon resized to size-7.
- `IssueDetailContent` has a new optional `titleClassName` prop (default `text-xl`); `IssueDetailView` passes `text-2xl` only for the two-column layout, so the peek sheet is unchanged.
- Tests updated: SprintBoardHeader, ReleaseHeader; added Settings h1 and IssueDetailContent title tests.

## Deviations
None. Full vitest suite, tsc and biome were green on both commits.

## Self-Check: PASSED
