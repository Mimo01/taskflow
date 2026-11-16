---
phase: 94-release-detail-redesign-nicer-professional-page-with-more-re
plan: 01
subsystem: release-detail data layer
tags: [burnup, buckets, mr-donut, hook]
requires: []
provides:
  - previousVersion / releaseBurnupAxis / deriveReleaseBurnup
  - deriveReleaseAssigneeRows / deriveReleaseTypeRows / mrDonutSlices / statusNameSummary
  - computeMrDonutCounts
  - additive useReleaseDetail fields (previousVersion, burnupAxis, burnupPoints, assigneeRows, typeRows, statusNameSummary, mrDonutCounts, issuesError, issuesUpdatedAt, gitlabConfigured)
affects: [94-02, 94-03, graph components, header done bar]
key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/releaseBurnup.ts
    - taskflow/src/routes/dashboard/release-detail/releaseBurnup.test.ts
    - taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts
    - taskflow/src/routes/dashboard/release-detail/releaseBuckets.test.ts
  modified:
    - taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts
    - taskflow/src/routes/dashboard/release-detail/releaseSummaries.test.ts
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
decisions:
  - Burnup clamps created/resolved days to the axis so the last point always equals the header counts (D-16 invariant), tested for released/future/overdue/undated
metrics:
  tasks: 3
  completed: 2026-10-30
---

# Phase 94 Plan 01: Release graph data layer Summary

Pure, tested derivations for the four release graphs (burnup with D-03 axis and D-16 missing-resolutiondate rule, assignee/type rows, MR donut, status-name summary), exposed additively through `useReleaseDetail`.

## Commits
- d6f70e0d: burnup axis and series (releaseBurnup.ts)
- 6bce5c99: buckets, MR donut counts, status-name summary
- 9e934b78: additive hook fields

## Deviations from Plan
- The worktree base was not the specified commit; reset to 47641754 per the branch check (no work lost).
- Test used `pts[pts.length - 1]` instead of `.at(-1)` (tsconfig lib lacks ES2022 Array.at).
- Hook-test MR fixtures needed `title`/`source_branch`/`description` since the real drift code reads them.
- Pre-commit full-suite runs hit unrelated timeout flakes (EpicDetailSheet, IssueDetailSheet, WorklogsPage) under parallel-agent load; they pass in isolation and the commits succeeded on retry.

## Known Stubs
None.

## Self-Check: PASSED
