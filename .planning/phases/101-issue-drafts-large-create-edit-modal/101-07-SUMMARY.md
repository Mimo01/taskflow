---
phase: 101-issue-drafts-large-create-edit-modal
plan: 07
subsystem: drafts
tags: [topbar, popover, zustand, undo]
requires: [101-02, 101-03]
provides:
  - DraftsChip (header pill, popover list, resume, discard with 5s undo)
affects: [TopBar]
key-files:
  created:
    - taskflow/src/components/app/DraftsChip.tsx
    - taskflow/src/components/app/DraftsChip.test.tsx
  modified:
    - taskflow/src/components/app/TopBar.tsx
    - taskflow/src/components/app/TopBar.test.tsx
decisions:
  - Pending discards live in local state plus a ref; staged files are deleted (removeDraftFiles) only on commit via expiry, popover close or unmount
  - The chip stays mounted while an undo is pending so the last discarded draft can still be restored
metrics:
  completed: 2026-11-18
---

# Phase 101 Plan 07: Drafts chip Summary

"Drafts N" pill in the TopBar, left of Search, shown only when hydrated and at least one draft exists. Its popover lists drafts newest first (type icon, summary or italic Untitled, parent/epic key, "edited 5m ago"), resumes a draft through `useCreateModalStore.resumeDraft`, and discards with an inline "Draft discarded · Undo" for 5 seconds.

## Tasks

1. DraftsChip component and 10 tests (hydration gate, ordering, resume, undo, 5s commit, close/unmount commit, keyboard).
2. Mounted `<DraftsChip />` before the Search button in TopBar; added a DOM-order test; header comment updated. TopBar still has no useQuery.

## Deviations from Plan

None to behavior. Discard rows are sibling buttons (resume and X), per the nested-interactive guidance. Pre-commit full-suite runs timed out on unrelated tests (EpicDetailSheet, IssueDetailParts, WorklogsPage) under load of 100+; commits went through the orchestrator's serial-commit script.

## Known Stubs

None.

## Self-Check: PASSED
