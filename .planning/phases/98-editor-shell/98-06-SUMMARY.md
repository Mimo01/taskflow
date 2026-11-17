---
phase: 98-editor-shell
plan: 06
subsystem: wiki-editor
tags: [tiptap, prosemirror-history, source-mode, wiki]
requires: [98-04, 98-05]
provides:
  - editor-session (replaceDoc, resetDoc, richToSource, sourceToRich, initialMode, evaluateSave, canLoadRich, WIKI_TOGGLE_META)
  - SourceView + SourceHandle, applyInsert
  - ModeToggle
affects: [98-11]
tech-stack:
  patterns: [closeHistory around programmatic doc replace, setDocAttribute for eol/tail, span trigger for disabled-button tooltip]
key-files:
  created:
    - taskflow/src/components/wiki-editor/editor-session.ts
    - taskflow/src/components/wiki-editor/editor-session.test.ts
    - taskflow/src/components/wiki-editor/source/source-edits.ts
    - taskflow/src/components/wiki-editor/source/source-edits.test.ts
    - taskflow/src/components/wiki-editor/source/SourceView.tsx
    - taskflow/src/components/wiki-editor/source/SourceView.test.tsx
    - taskflow/src/components/wiki-editor/toolbar/ModeToggle.tsx
    - taskflow/src/components/wiki-editor/toolbar/ModeToggle.test.tsx
decisions:
  - "D-08: after a failed save, source shows the unchecked emitWiki(doc) with the engine reason; if emit throws, last safe text plus the note \"The latest edit couldn't be carried over.\""
requirements-completed: [EDIT-02, EDIT-03, EDIT-08, SAFE-05]
duration: ~25m
completed: 2026-11-17
---

# Phase 98 Plan 06: Session logic, SourceView, ModeToggle Summary

Pure rich/source transition logic (undo-safe replace, forced source, D-08 failed-save text) plus a source textarea with live WikiRenderer preview and the Rich | Source toggle.

## Commits
- f21ad81a: editor-session.ts + tests
- d22d7174: SourceView, source-edits + tests
- 9b1a019c: ModeToggle + tests

## Verification
- EDIT-08 three-step undo sequence (Y, toggle incl. eol/tail restore, X) proven headlessly; unchanged source adds no history; resetDoc adds none either.
- Forced-source, canLoadRich and initialMode proven by mocking loadWiki (no real text fails to load without injected engine deps).
- vitest for the new files, tsc --noEmit and biome check on the new files are clean.

## Deviations from Plan
- Tests for SourceView wrap in MemoryRouter from react-router-dom because WikiRenderer calls useNavigate (test-only).
- ModeToggle drops aria-pressed (invalid on role=radio, biome a11y); aria-checked carries state. Plan allowed either.
- Pre-commit full-suite hook repeatedly failed on unrelated load-sensitive tests (EpicDetailSheet, IssueDetailSheet, WorklogsPage; 5s timeouts) under parallel load; they pass in isolation. Retried, never bypassed.

## Known Stubs
None.

## Self-Check: PASSED
