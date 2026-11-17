---
phase: 100-host-adoption-editing-workflow
plan: 09
subsystem: ui
tags: [wiki-editor, cleanup, guard-test, HOST-05]
requires: [100-04, 100-05, 100-06, 100-07, 100-08]
provides:
  - Old textarea editor and dead sheet components deleted
  - editor-removal.guard.test.ts proving success criterion 5
key-files:
  created:
    - taskflow/src/routes/dashboard/editor-removal.guard.test.ts
    - taskflow/src/routes/dashboard/IssueDetailParts.test.tsx
  modified:
    - .planning/phases/100-host-adoption-editing-workflow/100-VALIDATION.md
    - taskflow/src/components/wiki-editor/source/source-edits.ts
    - taskflow/src/routes/dashboard/SubtasksPanel.tsx
    - taskflow/src/routes/dashboard/EpicDetailSheet.test.tsx
    - taskflow/src/routes/dashboard/CommentComposer.test.tsx
  deleted:
    - DescriptionEditor.tsx, DescriptionEditor.attachments.test.tsx, MentionPopover.tsx, InlineComment.tsx, IssueDetailSheet.tsx, IssueDetailSheet.test.tsx, issue-detail/DescriptionSection.tsx (all under taskflow/src/routes/dashboard)
requirements-completed: [HOST-05]
metrics:
  tasks: 2
  completed: 2026-11-17
---

# Phase 100 Plan 09: Old editor removal and guard Summary

The old textarea editing code (DescriptionEditor, MentionPopover, InlineComment, IssueDetailSheet, DescriptionSection) and their tests are deleted. A guard test fails if any of them, insertAtCursor, applyMarkup, a Preview tab trigger, or a textarea in the four hosts comes back.

## Tasks

Both tasks were committed together because the pre-commit hook runs the full suite and the guard needs the deletions to pass.

1. Deletions: grep confirmed only comments and tests of deleted modules remained. Stale comments fixed in SubtasksPanel, EpicDetailSheet.test, source-edits.ts.
2. Guard test (13 cases, probe-verified: a temporary `insertAtCursor` in src/lib made it fail, then removed) and VALIDATION.md sign-off (nyquist_compliant and wave_0_complete true, rows green, checklist ticked).

## Deviations from Plan

**1. [Pitfall 10] IssueDetailSheet.test.tsx held live coverage.** Its ISSUE-04 (IssueDetailSidebar optimistic updates), ISSUE-05/06 (IssueDetailContent subtasks, linked issues) and ISSUE-SP (FieldsSection story points) cases test live code. They were moved to `IssueDetailParts.test.tsx`; only the IssueDetailSheet open/close cases and the InlineComment comment-thread cases were dropped with their modules.

**2. Comment cleanup in CommentComposer.test.tsx.** A describe title mentioned "IssueDetailSheet" and would fail the plan's zero-match grep; reworded.

**3. Worktree base reset** to 125df67b at startup per the branch check.

## Merge note

This branch deletes files, so the worktree cleanup step may refuse it (branch_contains_deletions). Verify and merge manually with `git merge --ff-only`.

## Known Stubs

None.

## Self-Check: PASSED
