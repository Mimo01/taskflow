---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
plan: 01
subsystem: releases-ui
tags: [releases, pill, issue-graph, rm-package]
requires: []
provides:
  - lib/release-list (releasePill, groupReleases, daysBetweenKeys, releaseTooltipRows, derivePackage, breakdownTotal, RELEASE_SEGMENT_CLASS)
  - ReleaseStatusPill, ReleaseIssueGraph, ReleasePackageCell components
  - useReleasePackages hook
affects: [93-04, 93-05]
tech-stack:
  added: []
  patterns: [pure model + presentational components, skeleton of identical outer size]
key-files:
  created:
    - taskflow/src/lib/release-list.ts
    - taskflow/src/lib/release-list.test.ts
    - taskflow/src/components/release/ReleaseStatusPill.tsx
    - taskflow/src/components/release/ReleaseIssueGraph.tsx
    - taskflow/src/components/release/ReleaseIssueGraph.test.tsx
    - taskflow/src/components/release/ReleasePackageCell.tsx
    - taskflow/src/components/release/ReleasePackageCell.test.tsx
    - taskflow/src/hooks/useReleasePackages.ts
  modified: []
decisions:
  - "Pill 'today' is passed in by callers as a local date key; the model never reads the clock"
  - "daysBetweenKeys uses Date.UTC calendar arithmetic (DST-free)"
metrics:
  tasks: 3
  completed: 2026-10-29
---

# Phase 93 Plan 01: Shared release building blocks Summary

Pure release model (single pill per version, Upcoming/Released grouping, segmented-bar tooltip model, RM package derivation) plus ReleaseStatusPill, ReleaseIssueGraph, ReleasePackageCell and the lazy useReleasePackages hook, ready for the list (Plan 04) and detail header (Plan 05).

## Commits
- 4da1591a: release-list model + tests
- 74205b4c: ReleaseStatusPill + ReleaseIssueGraph + tests
- 156a4e1a: useReleasePackages + ReleasePackageCell + tests

## Deviations from Plan
- `formatWeekLabel` takes the week summary string (not the week object), so the cell calls `formatWeekLabel(week.summary)`; matches existing ReleasesTab usage.
- ReleaseIssueGraph accepts the `error` prop per the contract but renders error and idle identically (muted dash), so it is not destructured.
- Worktree base was corrected with `git reset --hard` to the expected base at startup (as the branch check prescribes).

## Known Stubs
None.

## Self-Check: PASSED
All 8 files exist, 3 commits present, full vitest suite, tsc and biome green on each commit.
