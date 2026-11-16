---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
plan: 07
subsystem: releases-list
tags: [releases, agenda, jira, react-query]
requires: []
provides:
  - release-agenda.ts (buildAgenda, releaseCountdown, dateStamp, releaseSummary, isStarted)
  - fetchVersionsStatusBreakdown returning assignees per version
  - useReleaseBreakdowns teams map and releasedFirstPage option
affects: [93-08, 93-09, 93-10]
key-files:
  created:
    - taskflow/src/lib/release-agenda.ts
    - taskflow/src/lib/release-agenda.test.ts
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira.versionsBreakdown.test.ts
    - taskflow/src/hooks/useReleaseBreakdowns.ts
    - taskflow/src/hooks/useReleaseBreakdowns.test.tsx
decisions:
  - "Quiet/full row weight uses version data only (planned beyond next+1 is quiet), never breakdowns (D-09)"
metrics:
  completed: 2026-10-29
  tasks: 3
---

# Phase 93 Plan 07: F5 agenda model and team data Summary

Pure F5 agenda model (overdue, TODAY, month dividers, No date section, countdown wording) plus assignees from the single batched status search, exposed through the breakdown hook with a configurable released first page.

## Commits
- a7e3b84b: F5 release agenda model (16 tests)
- 23ae65ee: batch release search returns assignees (fields=status,fixVersions,assignee, pagination unchanged, id validation kept)
- 8a3c9314: hook exposes `teams` and `releasedFirstPage`; seeds and `breakdowns` stay counts-only

## Deviations from Plan
None. Setup note: the worktree base was reset to d82d46d5 as instructed, and node_modules was symlinked.

The Edit-style rewrite of `useReleaseBreakdowns.test.tsx` mocks was needed because the fetcher return type gained `assignees`.

## Known Stubs
None.

## Self-Check: PASSED
Full vitest suite, tsc and biome pass on touched files; all three commits exist.
