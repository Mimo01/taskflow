---
phase: 100-host-adoption-editing-workflow
plan: 08
subsystem: issue-detail
tags: [wiki-editor, drafts, comment-composer, HOST-03, FLOW-01, FLOW-03]
requires: [100-01, 100-02, 100-03, 100-06]
provides:
  - Comment composer on WikiEditorLazy (compact preset) with per-issue draft, Cmd+Enter send, Esc blur, Reply focus via editor handle
affects: [100-09]
key-files:
  modified:
    - taskflow/src/routes/dashboard/CommentComposer.tsx
    - taskflow/src/routes/dashboard/CommentComposer.test.tsx
    - taskflow/src/routes/dashboard/CommentComposer.attachments.test.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx
    - taskflow/src/routes/dashboard/IssueDetailView.tsx
key-decisions:
  - "Clearing the composer to empty discards the draft instead of storing an empty one"
  - "DraftNote shown only while the composer has non-blank text"
  - "Posted body is text.trim() (same as before the rewrite)"
requirements-completed: [HOST-03, FLOW-01, FLOW-03]
metrics:
  tasks: 2
  completed: 2026-11-17
---

# Phase 100 Plan 08: Comment composer host Summary

The comment composer now runs on the compact WikiEditor with a per-issue `comment:new:<key>` draft, Cmd+Enter send, Esc blur and Reply focus that waits for the lazy editor handle. The textarea, applyMarkup, mirror-div caret, MentionPopover, attachment picker and Edit/Preview tabs are gone; uploads, mentions and the picker come from `useIssueEditorHost`.

## Tasks

1. Composer rewrite plus tests (bbbae337): button stays "Comment" with a "Comment ⌘↵" tooltip. Send is guarded against empty text and pending posts. On success the text, draft are cleared, both query keys are invalidated and the editor refocuses; on failure text and draft stay. Draft seeding handles both pre- and post-hydration mounts and never overwrites text the user already typed. IssueDetailView passes `userMap`, `referenceTexts` and `onOpenIssue`.
2. Attachment host-contract tests and moving the two ISSUE-08 composer cases out of `IssueDetailSheet.test.tsx` (same commit, see deviations).

## Deviations from Plan

**1. Tasks committed as one commit.** The old attachments test and the two IssueDetailSheet composer cases drive the composer through the real textarea, so they fail as soon as the rewrite lands and the pre-commit hook runs the full suite. Both tasks therefore landed in bbbae337.

No production-code deviations.

## Known Limitation

The same issue open in a peek and on the full page mounts two composers sharing one `comment:new:<key>` draft; last writer wins. Writes skip when text equals the stored draft, which avoids ping-pong (research Pitfall 6, T-100-28 accepted).

## Known Stubs

None.

## Self-Check: PASSED

Targeted tests (63) and the full pre-commit suite (6563 tests) pass; biome and tsc ran in the hook.
