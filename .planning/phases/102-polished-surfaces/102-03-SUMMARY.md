---
phase: 102-polished-surfaces
plan: 03
subsystem: ui
tags: [comment-composer, expand-on-focus, action-row]
requires: [102-02]
provides:
  - useExpandOnFocus hook (expanded/wantsFocus + relatedTarget-aware blur)
  - Collapsible CommentComposer using shared CommentActionRow
affects: [CommentComposer]
key-files:
  created:
    - taskflow/src/routes/dashboard/comment-editor/useExpandOnFocus.ts
    - taskflow/src/routes/dashboard/comment-editor/useExpandOnFocus.test.tsx
  modified:
    - taskflow/src/routes/dashboard/CommentComposer.tsx
    - taskflow/src/routes/dashboard/CommentComposer.test.tsx
    - taskflow/src/routes/dashboard/CommentComposer.attachments.test.tsx
key-decisions:
  - "Wrapper focus handlers sit on the composer root so moving focus editor -> Attach/Comment never collapses it"
  - "Reply effect only expands; a second effect focuses once the lazily mounted editor handle exists"
requirements-completed: [UI-03]
completed: 2026-11-18
---

# Phase 102 Plan 03: Collapsible comment composer Summary

The composer is a single-line "Add a comment…" field while idle and empty, expands on focus/click/Reply into the compact editor plus the shared CommentActionRow (Attach, Comment, "Posting…"), has no Cancel (Esc blurs and keeps text), and collapses only when empty and focus leaves the composer.

## Commits
- f67b70e7: useExpandOnFocus hook + 8 tests
- Task 2 commit: collapsible composer, updated composer and attachments tests (47 tests across composer + comment-editor pass)

## Deviations from Plan
**[Rule 1] biome-ignore comments removed.** The plan said to keep the noStaticElementInteractions suppression, but with spread `wrapperProps` biome no longer flags the div, so the suppression was reported as unused; removed it (also in the hook test harness).

Test helper: `renderComposer` now focuses the collapsed field by default (opt out with `{ expand: false }`); `lastStubProps` is reset in beforeEach so "editor not mounted" assertions are reliable.

## Known Stubs
None.

## Self-Check: PASSED
