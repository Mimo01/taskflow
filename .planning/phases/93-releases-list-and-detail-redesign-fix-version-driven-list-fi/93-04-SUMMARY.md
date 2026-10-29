---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
plan: 04
subsystem: releases-list
tags: [releases, list, react-query, d-01-d-12]
requires: [93-01, 93-02]
provides:
  - RELEASE_COL / CELL_PADDING (releases-list/columns.ts)
  - ReleaseListRow, ReleaseListHeader, ReleaseGroupLabel
  - fix-version-driven, GitLab-free ReleasesTab
affects: [93-06]
key-files:
  created:
    - taskflow/src/routes/dashboard/releases-list/columns.ts
    - taskflow/src/routes/dashboard/releases-list/ReleaseListRow.tsx
    - taskflow/src/routes/dashboard/releases-list/ReleaseListRow.test.tsx
  modified:
    - taskflow/src/routes/dashboard/ReleasesSkeleton.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.test.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.deploymentPackage.test.tsx
  deleted:
    - taskflow/src/routes/dashboard/ReleasesTab.versionCountsParity.test.tsx
decisions:
  - Package and issues cells do not use pointer-events-none/relative (copied from AioCycleList ProgressCell), so their z-10 tooltip triggers sit above the overlay button while the rest of the row stays clickable
  - Skeleton only when the fix-versions query has no data (useDelayedLoading && !fixVersions), so revisits and refreshes never blank the list
metrics:
  tasks: 2
  completed: 2026-10-29
---

# Phase 93 Plan 04: Releases list rebuild Summary

Releases list is now fix-version-driven with no GitLab: Upcoming / Released groups on a shared div+flex column grid, one status pill per row, RM package and a batched issue graph streaming into fixed slots, released paging (5, then 10 more per click) that fetches only revealed ids, instant cached revisits and a non-blanking Refresh via `refreshReleaseList`.

## Commits
- 48ad53f6: columns, ReleaseListRow/Header/GroupLabel, grid skeleton + tests
- 5adc01b8: ReleasesTab rewrite, list tests rewritten, versionCountsParity test deleted (its contract is covered by the parity case in `jira.versionsBreakdown.test.ts`, Plan 02)

## Deviations from Plan
- Worktree base was wrong at start (merge-base 89f0de36); reset to the specified base 64293a32 per the startup check.
- Empty-state/cache-revisit tests: v5 `isLoading` gating relied on as planned; no production deviation.
- Package text assertion in deploymentPackage test has no space between week label and child key (cell uses flex gap, not a text space).

## Known Stubs
None.

## Self-Check: PASSED
All files exist, commits 48ad53f6 and 5adc01b8 present; full vitest suite, tsc and biome green on each commit; `grep -ci gitlab ReleasesTab.tsx` is 0, no dangerouslySetInnerHTML.
