---
phase: quick
plan: 260401-bcs
subsystem: ui-components
tags: [avatar, visual-polish, consistency]
dependency_graph:
  requires: []
  provides: [unassigned-avatar-icon]
  affects: [BacklogRow, FieldsSection, MergeRequestDetailPage, ReleaseDetailPage]
tech_stack:
  added: []
  patterns: [lucide-react icon in avatar fallback, isUnassigned detection helper]
key_files:
  created: []
  modified:
    - taskflow/src/components/ui/cached-avatar.tsx
    - taskflow/src/components/ui/cached-avatar.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
decisions:
  - Used lucide-react User icon for unassigned avatar — matches Jira's person silhouette style
  - isUnassigned() uses case-insensitive trim check on name only when url is null/undefined
  - ICON_SIZE_MAP provides proportional icon sizing: 12/14/18/22px for 20/24/32/40 avatar sizes
  - showUnassigned flag computed outside JSX for clarity
metrics:
  duration: 10m
  completed: "2026-04-01"
  tasks_completed: 2
  files_changed: 5
---

# Phase quick Plan 260401-bcs: Unassigned Avatar Icon Summary

**One-liner:** Replaced "U" initials for unassigned avatars with a lucide-react User silhouette icon in a muted circle, matching Jira's unassigned style, applied consistently across all four views.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update CachedAvatar to show person icon for unassigned | f610200 | cached-avatar.tsx, cached-avatar.test.tsx |
| 2 | Ensure consistent unassigned avatar usage across all views | d98e0a9 | FieldsSection.tsx, MergeRequestDetailPage.tsx, ReleaseDetailPage.tsx |

## What Was Built

**Task 1 — CachedAvatar unassigned icon:**

Added three pieces to `cached-avatar.tsx`:
- `ICON_SIZE_MAP`: maps avatar pixel sizes (20/24/32/40) to proportional icon sizes (12/14/18/22px)
- `isUnassigned(name)`: returns true when name is "unassigned" (case-insensitive, trimmed)
- `showUnassigned` flag: `!url && isUnassigned(name)` — triggers icon rendering

When `showUnassigned` is true, the fallback div renders `<User>` from lucide-react in `text-muted-foreground` instead of initials text. The `text-[10px] font-medium text-foreground` class is omitted for unassigned (not needed for icon). All other behavior (image loading, error fallback, size classes) is unchanged.

Added tests 7 and 8 to verify unassigned renders svg (not "U"), and real names without URLs still render initials.

**Task 2 — Consistent unassigned usage:**

- `FieldsSection.tsx`: The unassigned branch in the assignee PopoverTrigger now renders `<CachedAvatar url={null} name="Unassigned" size={20} />` + "Unassigned" text in a fragment (the trigger already has `inline-flex items-center gap-1.5`)
- `MergeRequestDetailPage.tsx`: Replaced `<span className="text-muted-foreground">Unassigned</span>` with an `inline-flex items-center gap-1.5 text-muted-foreground` span containing the avatar + text
- `ReleaseDetailPage.tsx`: Same pattern with `text-xs` preserved
- `BacklogRow.tsx`: No change needed — already passes `name="Unassigned"` to CachedAvatar, automatically picks up the new icon

## Verification

- All 8 CachedAvatar tests pass (6 existing + 2 new)
- Full test suite: 85 test files passed, 5 skipped (840 tests passed, 39 todo)
- TypeScript: `tsc --noEmit` exits with no errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- f610200 exists: confirmed
- d98e0a9 exists: confirmed
- taskflow/src/components/ui/cached-avatar.tsx: modified with User icon logic
- taskflow/src/components/ui/cached-avatar.test.tsx: 8 tests including new unassigned tests
- taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx: unassigned branch updated
- taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx: inline-flex unassigned span
- taskflow/src/routes/dashboard/ReleaseDetailPage.tsx: inline-flex unassigned span
