---
phase: 94-release-detail-redesign-nicer-professional-page-with-more-re
plan: 03
subsystem: release-detail
tags: [react, facts, description, tests]
requires: []
provides:
  - ReleaseFacts / releaseFactItems / MetaLine / RowAction (inline Name: value facts)
  - ReleaseDescription (2-line clamp, overflow-only toggle)
affects: [94-06 header, 94-07 sidebar deletion]
tech-stack:
  added: []
  patterns: [CycleHeader Fragment separators, exhaustive BranchState never-guard]
key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/ReleaseFacts.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseFacts.test.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDescription.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDescription.test.tsx
  modified: []
decisions:
  - "Sidebar file and its test left untouched (deleted in plan 07); both suites green"
metrics:
  tasks: 2
  files: 4
  completed: 2026-10-30
---

# Phase 94 Plan 03: ReleaseFacts and ReleaseDescription Summary

Header-ready `Name: value` facts (Milestone, Branch, Merged back, MR labels, Story points) with inline Create/Retry actions and a D-15 MR-labels tooltip, plus a 2-line clamped description with an overflow-only more/less toggle.

## Commits
- f521286f: ReleaseFacts + ported tests (43 cases; all old sidebar testids kept)
- f7e94fa8: ReleaseDescription + tests (7 cases)

## Deviations from Plan
- Worktree base was 89f0de36, not the expected 47641754; reset to the expected base per the startup check.
- The font-medium test asserts on the fact text spans only, because the shared outline Button primitive carries its own `font-medium` (the plan's grep on ReleaseFacts.tsx is 0).
- Branch `missing` and milestone `none` states render an orange `Missing` word before the action (UI-SPEC State Contract: `Branch: Missing` + Create branch).
- Retry action label is `Retry branch check` (copywriting contract) rather than `Retry`.

## Verification
- vitest: ReleaseFacts (43), ReleaseDetailSidebar (34, untouched), ReleaseDescription (7) pass; full pre-commit suite passed.
- tsc clean; biome clean on the four new files.
- Symlinked taskflow/node_modules to the main checkout (not committed).

## Known Stubs
None.

## Self-Check: PASSED
