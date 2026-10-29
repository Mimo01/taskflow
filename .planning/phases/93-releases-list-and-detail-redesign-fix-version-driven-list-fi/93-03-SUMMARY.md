---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
plan: 03
subsystem: release-detail
tags: [ui, release-detail, d-14, d-15]
requires: []
provides:
  - UnifiedTaskTable without issueCounts prop, done badge or progress bar
  - ReleaseDetailSidebar without Status/Date rows
  - Unified text-base font-semibold headings for Labels, Deployment package, Issues
affects: [93-05]
key-files:
  modified:
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
    - taskflow/src/routes/dashboard/release-detail/LabelSummarySection.tsx
    - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
decisions:
  - Edit button and onStartEditing left in sidebar (Plan 05 relocates)
metrics:
  tasks: 2
  completed: 2026-10-29
---

# Phase 93 Plan 03: Release detail trims and heading polish Summary

Removed the duplicated done figure (badge + progress bar) from the unified task table header and the Status/Date rows from the sidebar, and unified body section headings to `text-base font-semibold`; flagged-MR badges and table anatomy are untouched.

## Commits
- 0f960f63: remove done badge and progress bar from unified task table (test rewritten: asserts no done badge, no progressbar, flagged badges intact; 105 `it(` blocks preserved)
- da5c7afb: drop sidebar Status/Date rows, unify headings; added a sidebar test for absent Status/Date

## Deviations from Plan
- Worktree base was corrected via `git reset --hard` to the expected base at startup (clean tree).
- First commit attempts failed on the pre-commit full suite with timeouts in unrelated tests (EpicDetailSheet etc.) caused by CPU load from parallel executors; they pass in isolation and on retry. No code change.

## Known Stubs
None.

## Self-Check: PASSED
