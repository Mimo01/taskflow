---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
plan: 05
subsystem: release-detail
tags: [releases, detail-header, d-13, d-14, d-15]
requires: [93-01, 93-02, 93-03]
provides:
  - ReleaseDetailHeader (name, shared status pill, date, RM package, wide issue graph, Pin/Edit/Open in Jira)
  - useReleaseDetail headerBreakdown / headerBreakdownLoading / headerBreakdownError / releasePackage / rmEnabled / rmLoading
key-files:
  modified:
    - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.test.tsx
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx
decisions:
  - Header figure derives from the detail's own issues once loaded; list's cached breakdown seeds it before that (fetch-disabled useQuery, reactive)
  - Presence of data (not isLoading) decides what the header shows, so a disabled issues query never renders "No issues"
metrics:
  tasks: 3
  completed: 2026-10-29
---

# Phase 93 Plan 05: Release detail header Summary

Detail header now echoes the list row and is the single owner of the done figure; Pin, Edit and Open in Jira live on its right, and it paints from the list's cached breakdown before the detail's issues load.

## Commits
- 901d33ff: ReleaseDetailHeader component + tests
- bd8b5684: useReleaseDetail header breakdown (seeded, single source), RM package, removed redundant `jira-version-counts` query and `issueCounts` return
- f4248855: page wiring, bottom action row and sidebar Edit removed, `ReleaseTitleHeading` deleted, skeleton restyled to header shape

## Deviations from Plan
- Worktree base was wrong at start (merge-base 89f0de36); reset to the specified base 64293a32 per the startup check.
- Test-only: `LinkContextMenu` needs `useDetectedBrowsers` mocked in the header test; sidebar "no Edit" test uses an `unresolvable` branch state. No production impact.
- No `TooltipProvider` exists in this repo, so header tests render without one.

## Known Stubs
None.

## Self-Check: PASSED
Three commits present; full vitest suite, tsc and biome green on each commit.
