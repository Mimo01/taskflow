---
phase: quick-261112-fqd
plan: 01
subsystem: issue-detail
tags: [ui, buttons, styling]
key-files:
  modified:
    - taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx
    - taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentUpload.tsx
    - taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.test.tsx
  created:
    - taskflow/src/routes/dashboard/issue-detail/AttachmentUpload.test.tsx
decisions:
  - Shared SECTION_ACTION_BUTTON_CLASS / SECTION_ACTION_ICON_CLASS exported from SectionHeader.tsx (biome had no complaint)
metrics:
  completed: 2026-11-12
---

# Phase quick-261112-fqd Plan 01: Issue detail section header buttons Summary

Attach file, Bulk create and Add subtask now render as ghost xs (h-6, borderless) buttons with muted text turning foreground on hover and size-3 icons, all sourced from one shared class constant in SectionHeader.tsx.

## Commits
- 9cf677f5: feat(quick-261112-fqd): ghost xs section header action buttons

## Deviations from Plan
None. Plan executed as written. (Worktree base was reset to 5ec293f9 per the branch check.)

## Verification
Full pre-commit suite passed (biome, tsc, 313 test files / 4940 tests). New tests assert h-6, muted/hover classes, no border-border, size-3 icons for all three buttons. No `variant="outline"` remains in the two consumers.

## Self-Check: PASSED
