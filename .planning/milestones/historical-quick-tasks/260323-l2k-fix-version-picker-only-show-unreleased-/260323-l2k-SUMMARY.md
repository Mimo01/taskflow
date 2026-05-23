---
phase: quick
plan: 260323-l2k
subsystem: issue-detail
tags: [fix-versions, ux, filtering]
dependency-graph:
  requires: [quick-260323-kw8]
  provides: [filtered-fix-version-picker]
  affects: [issue-detail]
tech-stack:
  added: []
  patterns: [useMemo-for-derived-lists]
key-files:
  modified:
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
decisions:
  - Filter to unreleased + last 10 released (by releaseDate descending)
  - Always include currently-selected versions even if outside the 10-release window
metrics:
  duration: 2min
  completed: "2026-03-23T14:14:31Z"
---

# Quick Task 260323-l2k: Fix Version Picker -- Only Show Unreleased Summary

Filter fix version picker to show unreleased versions plus 10 most recent released, with selected versions always visible.

## What Was Done

### Task 1: Filter fix version list to unreleased + last 10 released
**Commit:** `c0bcc3a`

Added a `useMemo`-based `filteredVersions` computation in FieldsSection.tsx that:
- Separates versions into unreleased and released groups
- Sorts released versions by `releaseDate` descending (most recent first)
- Takes only the 10 most recent released versions
- Preserves any currently-selected fix versions that fall outside the top 10
- Displays unreleased versions first (sorted by name), then released (sorted by date)

Replaced the previous inline `.sort().map()` chain with the pre-computed `filteredVersions.map()`.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compiles without errors (only 2 pre-existing unrelated errors remain)
- Fix version popover now renders the filtered list instead of all project versions

## Known Stubs

None.

## Self-Check: PASSED
