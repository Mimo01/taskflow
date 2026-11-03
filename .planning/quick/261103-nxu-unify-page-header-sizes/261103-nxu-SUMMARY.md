---
phase: quick-261103-nxu
plan: 01
status: complete
completed: 2026-11-03
commits: [ff901d68, 1cebf9dc, 9c020a5a]
---

# Quick 261103-nxu: Unify page header sizes

Final rule (UAT approved 2026-11-03): page title size depends on whether a text line sits under it.

- **Main pages with a subtitle line**: `text-3xl font-semibold`. These are My Tasks, Standup notes, Releases, Debug Logs and Developer Tools.
- **Main pages without one**: `text-2xl font-semibold`. These are Backlog, Epics, Worklogs, Sprint Board, Merge Requests and Test cycles. Filter tabs and an inline project key don't count as a subtitle. Sprint Board is in this group because the user named it, even though it sometimes shows a goal line.
- **Subpages**: `text-2xl font-semibold`. These are Release detail, AIO cycle, AIO test run, MR detail and the full-page issue.
- **Issue peek sheet**: stays `text-xl`. `IssueDetailContent` has an optional `titleClassName` prop (default `text-xl`), and `IssueDetailView` passes `text-2xl` only for the two-column layout.
- **Exceptions, left unchanged**: the home dashboard hero (`text-6xl`), onboarding Welcome, ErrorPage, ChunkErrorBoundary, HardMinimumOverlay, and in-page section headings.

## UAT round 1 changes (9c020a5a)
- Removed the Settings header bar that the first pass added. Settings has no page title again.
- Removed the GitMerge icon from the Merge Requests title.
- Titles without a subtitle went from text-3xl to text-2xl.

## Deviations
None. The full vitest suite, tsc and biome were green on every commit.

## Self-Check: PASSED
