---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
plan: 02
subsystem: releases-data-layer
tags: [jira, react-query, releases, caching]
requires: []
provides:
  - fetchVersionsStatusBreakdown (services/jira.ts)
  - useReleaseBreakdowns, planBreakdownChunks, releaseBreakdownChunkKey, releaseBreakdownSeedKey
  - refreshReleaseList (lib/release-refresh.ts)
affects: [93-04, 93-05]
key-files:
  created:
    - taskflow/src/services/jira.versionsBreakdown.test.ts
    - taskflow/src/hooks/useReleaseBreakdowns.ts
    - taskflow/src/hooks/useReleaseBreakdowns.test.tsx
    - taskflow/src/lib/release-refresh.ts
    - taskflow/src/lib/release-refresh.test.ts
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/release-detail/useEditRelease.ts
decisions:
  - Chunk boundaries depend on position only so earlier query keys never change on reveal
  - Loading is derived from isFetching && no data (never isPending)
metrics:
  tasks: 3
  completed: 2026-10-29
---

# Phase 93 Plan 02: Releases list data layer Summary

Batched, fully paginated Jira status breakdown (one `fixVersion in (...)` search per chunk), a chunk-per-reveal query hook with stable keys and per-version cache seeding, and an upstream-first list refresh helper.

## Tasks

1. `fetchVersionsStatusBreakdown` in legacy jira.ts, with 9 tests covering pagination, id validation, multi-version counting and parity with `fetchVersionIssueCounts` - 70208e63
2. `useReleaseBreakdowns` hook and key helpers, with tests for exactly-one-new-query per reveal, loading/error per id and seeding - 7ada22d2
3. `refreshReleaseList` (two-stage, awaited) and `['jira-version-counts','batch']` invalidation in `useEditRelease` - a741e9db

## Deviations from Plan

- Worktree base was wrong at start (merge-base 89f0de36); reset to the specified base ffffb793 per the startup check.
- Tasks 2 and 3 were committed separately (plan allowed one commit per task); the first Task 3 commit attempt hit unrelated 5s test timeouts (EpicDetailSheet / IssueDetailSheet) under parallel load and passed on retry.
- The hook uses `useQueries` `combine` to derive breakdowns/loading/error sets.

## Known Stubs

None.

## Self-Check: PASSED

All listed files exist and commits 70208e63, 7ada22d2, a741e9db are present; full vitest suite and tsc pass.
