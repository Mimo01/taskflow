---
phase: quick-260317-k7o
plan: 01
subsystem: dashboard-comments
tags: [rich-text, comments, wiki-renderer, edit-delete, formatting-toolbar]
dependency_graph:
  requires: [WikiRenderer, IssueDetailContent.relativeTime, jira-service-updateComment-deleteComment, stronghold-readSecret]
  provides: [rich-inline-comments, comment-edit-delete, comment-formatting-toolbar]
  affects: [InlineComment.tsx, TaskRow.tsx]
tech_stack:
  added: []
  patterns: [WikiRenderer-for-rich-text, 3-dot-menu-edit-delete, applyMarkup-formatting-toolbar]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/InlineComment.tsx
    - taskflow/src/routes/dashboard/TaskRow.tsx
decisions:
  - "Reused exact CommentCard design (rounded-lg border bg-card p-3 space-y-2) from IssueDetailPage for visual consistency"
  - "Copied applyMarkup helper from CommentComposer rather than extracting shared module to minimize scope"
  - "Passed empty attachments/users maps to WikiRenderer since inline comments lack attachment context"
metrics:
  duration_minutes: 2
  completed: "2026-03-17T13:42:02Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 260317-k7o: Rich Comments in My Tasks Summary

Rich inline comments with WikiRenderer rendering, edit/delete on own comments via 3-dot menu, and Bold/Italic/Code/List formatting toolbar on the composer.

## What Was Done

### Task 1: Rewrite InlineComment with rich rendering, edit/delete, and formatting toolbar
**Commit:** e916046

Rewrote InlineComment.tsx from a plaintext comment viewer to a full-featured comment list matching IssueDetailPage CommentCard design:
- Comments now render via WikiRenderer (bold, italic, code blocks, lists, headings)
- Own comments show a 3-dot MoreVertical menu with Edit and Delete options
- Edit mode shows a Textarea pre-filled with original body, Save/Cancel buttons
- Delete prompts window.confirm before calling deleteComment API
- Both mutations invalidate ['jira-comments', issueKey] query on success
- Formatting toolbar (Bold/Italic/Code/List) added above composer textarea
- Increased scrollable comment list max-h from 48 to 64 for richer content

### Task 2: Update TaskRow to pass jiraBaseUrl to InlineComment
**Commit:** 13ed287

Added `jiraBaseUrl={jiraBaseUrl}` prop to InlineComment JSX in TaskRow, enabling edit/delete API calls.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compiles cleanly (no errors in modified files)
- Pre-existing test errors in SprintBoardTab.test.tsx and EpicDetailSheet.test.tsx are unrelated

## Self-Check: PASSED
