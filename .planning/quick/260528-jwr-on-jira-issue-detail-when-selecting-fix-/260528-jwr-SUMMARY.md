---
phase: quick-260528-jwr
plan: "01"
subsystem: issue-detail
tags: [fix-versions, sorting, jira, popover]
dependency_graph:
  requires: []
  provides: [fix-version-popover-chronological-sort]
  affects: [FieldsSection.tsx]
tech_stack:
  added: []
  patterns: [IIFE sorter, releaseDate ascending sort with undefined-last tie-break]
key_files:
  modified:
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
decisions:
  - "Sort unreleased fix versions by releaseDate ascending (YYYY-MM-DD lexical = chronological); versions without a releaseDate sink to the bottom of the unreleased group with name as tiebreaker"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  files_modified: 1
---

# Quick Task 260528-jwr: Fix Version Popover Sort Summary

**One-liner:** Replaced alphabetical sort with releaseDate-ascending sort for unreleased fix versions in the Jira issue detail Fix Version popover, with undated versions sinking to the end of the unreleased group.

## What Was Done

**Task 1: Sort unreleased fix versions by releaseDate ascending** — `97f183e2`
**Task 2: Human-verify checkpoint** — APPROVED by user (2026-05-28)


In `FieldsSection.tsx` lines 210-216, replaced the single-line `a.name.localeCompare(b.name)` sort for unreleased versions with a 4-line sort that:
1. When both versions have `releaseDate`: sorts ascending by lexical string compare (YYYY-MM-DD makes this chronological — soonest first)
2. When only one has `releaseDate`: the dated version comes first (`return -1` for `a.releaseDate` present)
3. When neither has `releaseDate`: falls back to `a.name.localeCompare(b.name)` for deterministic ordering

Released versions sort unchanged (releaseDate descending, most recent first). The recent-10 cap, selectedOlder carve-out, and grouping order (unreleased above released) are untouched.

## Verification

- TypeScript: no new errors introduced (pre-existing errors are from missing node_modules in worktree, unrelated to this change)
- Biome: `Checked 1 file in 35ms. No fixes applied.`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` modified — FOUND
- [x] Commit `97f183e2` — FOUND

## Self-Check: PASSED
