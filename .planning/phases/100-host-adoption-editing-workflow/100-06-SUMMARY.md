---
phase: 100-host-adoption-editing-workflow
plan: 06
subsystem: issue-detail
tags: [wiki-editor, drafts, comment-edit, HOST-03, FLOW-01, FLOW-02, FLOW-03]
requires: [100-01, 100-02, 100-03]
provides:
  - Comment edit on WikiEditorLazy (compact preset) in page and peek
  - Per-comment-id edit drafts with restore, stale base, switch flush and cleanup
affects: [100-08]
key-files:
  modified:
    - taskflow/src/routes/dashboard/IssueDetailView.tsx
    - taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx
    - taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx
  created:
    - taskflow/src/routes/dashboard/IssueDetailView.comment-edit.test.tsx
key-decisions:
  - "dirty = editText !== editBase; editBase is the draft base when a draft was restored, so a restored draft counts as dirty"
  - "Comment pruning is safe: fetchComments reads /comment with no paging params and returns the whole list, so no partial-list guard was needed"
  - "Draft blur flush is a focusout handler on the editor wrapper div, passed to the editing card as onEditBlur"
requirements-completed: [HOST-03, FLOW-01, FLOW-02, FLOW-03]
metrics:
  tasks: 2
  completed: 2026-11-17
---

# Phase 100 Plan 06: Comment edit host Summary

Comment edit now runs on the compact WikiEditor with Cmd+Enter / Esc keys, a discard guard and persisted per-comment drafts.

## Tasks

1. Editor swap, keys, discard guard (4631f721): Textarea replaced by `WikiEditorLazy` (compact, aria-label "Edit comment", host from `useIssueEditorHost` with description + all comment bodies as reference texts). `onSubmit` saves trimmed text, `onCancel` and the Cancel button go through `requestCancelEdit` (silent when clean, `DiscardChangesDialog` when dirty; Keep editing refocuses the editor). Save and Cancel tooltips show keycaps. Save failure shows the fixed UI-SPEC copy, never the server message. Props threaded through `ActivityTimeline` to the editing card only.
2. Drafts (30ae69ac): `useEditorDraft` keyed `draftKey.commentEdit(id)`; `DraftNote` with Discard / Use Jira version; auto-reopen of the latest draft once per issue with scrollIntoView (`data-comment-id` on the card); `handleEdit` flushes the comment being left (D-07); draft cleared on save success, note Discard, dialog Discard, `pruneCommentEdits` on a successful comments query, `clearIssue` on issue 404 (401/403 and comment-query errors clear nothing).

## Deviations from Plan

None in scope. Notes:
- The full-suite pre-commit hook failed intermittently on unrelated timing-sensitive tests (EpicDetailSheet, IssueDetailSheet, WorklogsPage, FindBar; 5 s timeouts) because load average was about 49 from parallel agents. They pass in isolation; the commits succeeded on retry without `--no-verify`.
- Worktree base was reset to eee9f018 per the branch check (it started at an older commit).

## Known Stubs

None.

## Threat Flags

None. T-100-18 (draft only enters as editor `value`), T-100-20 (404 clear, prune) and T-100-21 (fixed error copy) are implemented.

## Open item

Esc inside the peek with the editor focused (assumption A2, react-hotkeys-hook ignores contenteditable) still needs UAT confirmation in the real app.

## Self-Check: PASSED
