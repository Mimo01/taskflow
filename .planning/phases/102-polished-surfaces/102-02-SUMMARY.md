---
phase: 102-polished-surfaces
plan: 02
subsystem: ui
tags: [comment-editor, action-row, wiki-editor, attachments]
requires: []
provides:
  - CommentActionRow (shared Attach / Cancel / primary row with keycap tooltips)
  - COMMENT_EDITOR_MAX_HEIGHT shared cap
affects: [CommentComposer adoption (other plan), IssueDetailView comment edit]
tech-stack:
  added: []
  patterns: [hidden file input + insertFiles via callback]
key-files:
  created:
    - taskflow/src/routes/dashboard/comment-editor/CommentActionRow.tsx
    - taskflow/src/routes/dashboard/comment-editor/CommentActionRow.test.tsx
    - taskflow/src/routes/dashboard/comment-editor/comment-editor-sizing.ts
  modified:
    - taskflow/src/routes/dashboard/IssueDetailView.tsx
    - taskflow/src/routes/dashboard/IssueDetailView.comment-edit.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx
key-decisions:
  - "Shared height cap max-h-[min(50vh,480px)] for both comment hosts"
  - "editorRef prop typed RefObject (was Ref) so Attach can call insertFiles"
requirements-completed: [UI-03]
duration: long (pre-commit hook retried under heavy machine load)
completed: 2026-11-18
---

# Phase 102 Plan 02: Shared comment action row Summary

One shared CommentActionRow (draft note, paperclip Attach, optional Cancel, primary with keycap tooltips) now drives the comment edit host, which also gets the shared max-height cap.

## Commits
- 7b752a59: CommentActionRow, sizing constant, 8 component tests
- 5babbf57: comment edit adopts the row and cap; Saving… ellipsis; Attach/order tests

## Deviations from Plan

**[Rule 3 - Blocking] editorRef type.** `editorRef` was `React.Ref<WikiEditorHandle>` in IssueDetailView and ActivityTimeline; tsc rejected `.current` use. Changed to `React.RefObject<WikiEditorHandle | null>` in both (the only caller passes a useRef). Added ActivityTimeline.tsx to the touched files.

**Test approach.** The Attach test mocks `@/services/jira/attachments` and asserts `uploadAttachment` receives the file, because the shared stub's lastStubProps belongs to the composer editor, not the edit one.

CommentComposer was not changed (not in this plan's files); it does not yet use the shared row.

## Issues
The pre-commit full vitest suite flaked repeatedly (5s timeouts in EpicDetailSheet, IssueDetailParts, WorklogsPage, FindBar) because other parallel executors pushed load average to ~90. Each passes in isolation; the commit succeeded once load eased. No code changes were made for this.

## Self-Check: PASSED
