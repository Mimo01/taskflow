---
phase: 99-mentions-media-smart-input
plan: 13
subsystem: wiki-editor
tags: [source-mode, mentions, emoticons, uploads]
requires: [99-05, 99-06, 99-09, 99-11]
provides:
  - "getTextareaCaretRect (src/lib/textarea-caret.ts)"
  - "uploadIntoSource, recordUploadFailure"
  - "SourceSuggest: @mention and :emoticon popover in the source textarea"
affects: [wiki-editor]
key-files:
  created:
    - taskflow/src/lib/textarea-caret.ts
    - taskflow/src/lib/textarea-caret.test.ts
    - taskflow/src/components/wiki-editor/source/SourceSuggest.tsx
    - taskflow/src/components/wiki-editor/source/source-uploads.ts
    - taskflow/src/components/wiki-editor/source/source-uploads.test.ts
    - taskflow/src/components/wiki-editor/source/source-input.test.tsx
  modified:
    - taskflow/src/components/wiki-editor/media/upload-plugin.ts
    - taskflow/src/components/wiki-editor/source/SourceView.tsx
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
decisions:
  - "Escape dismissal is remembered per trigger start so the following keyup does not reopen the popover"
  - "EditorMessages renders in source mode too, so source upload failures show the shared error line"
metrics:
  completed: 2026-11-17
---

# Phase 99 Plan 13: Source-mode inputs Summary

Source mode now offers the same @ mention and : emoticon popover (portaled to the enclosing dialog or body, anchored at the caret) and file paste/drop upload as rich mode, using the shared data sources and the shared upload-failure line.

## Tasks

1. Caret rect util, uploadIntoSource, recordUploadFailure: commit e25f674c. recordUploadFailure only dispatches the existing fail meta (addToHistory false); the 99-09 clear-at-batch-start semantics are untouched.
2. SourceSuggest, SourceView paste/drop, WikiEditor wiring: commit 377dd126.

## Deviations from Plan

**1. [Rule 2 - Missing functionality] EditorMessages rendered in source mode.** It was rich-only (99-09), so source upload failures would never be visible, contradicting the must-have. It now renders in both modes; the hidden rich doc never changes in source mode so no removal notice appears there.

**2. Emoticon/person row builders duplicated in SourceSuggest** because mention-suggestion.ts keeps toRow private; avoided editing 99-06 files.

## Known Stubs

None.

## Verification

Full vitest suite passed in both pre-commit runs (420 files, 6422 tests); tsc clean; biome shows only 2 pre-existing warnings in unrelated files. CommentComposer untouched.

## Self-Check: PASSED
