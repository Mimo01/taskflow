---
phase: 99-mentions-media-smart-input
plan: 09
subsystem: wiki-editor
tags: [tiptap, uploads, attachments, inline-notice]
requires: [99-01, 99-03, 99-04, 99-05]
provides:
  - "WikiEmbedRemoval plugin (D-10 detection), getRemovalNotice, dismissRemovalNotice"
  - "EditorMessages inline area: upload error lines + removal notice row"
  - "WikiUpload and WikiEmbedRemoval live in richExtensions"
affects: [wiki-editor]
key-files:
  created:
    - taskflow/src/components/wiki-editor/media/embed-removal.ts
    - taskflow/src/components/wiki-editor/media/embed-removal.test.ts
    - taskflow/src/components/wiki-editor/media/EditorMessages.tsx
    - taskflow/src/components/wiki-editor/media/editor-messages.test.tsx
  modified:
    - taskflow/src/components/wiki-editor/rich-extensions.ts
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
    - taskflow/src/components/wiki-editor/media/upload-plugin.ts
decisions:
  - "Upload failures are cleared at the start of the next batch (withUploads) or on Dismiss, not on a successful upload"
  - "EditorMessages renders in rich mode only, after EditorContent/SourceView and before TableToolbar"
metrics:
  completed: 2026-11-17
---

# Phase 99 Plan 09: Embed removal notice and inline messages Summary

Inline "Also delete attachment?" notice (session uploads only, guarded against other references, toggle/reset/undo) plus inline upload-failure lines, with upload and removal plugins now live in the rich editor.

## Tasks

1. WikiEmbedRemoval plugin: commit a9957ec8. Per-instance plugin state; skips transactions with WIKI_TOGGLE_META, addToHistory false, or the `history$` meta; undo that restores the embed clears the notice; last qualifying removal wins.
2. EditorMessages, WikiEditor slot, rich-extensions registration, upload-plugin fix: committed with this SUMMARY.

## Orchestrator note decision (upload failure clearing)

UI-SPEC says failures auto-clear "on the next successful paste/drop", i.e. they must stay visible until dismissed or the next batch. Plan 05 cleared the list on every successful upload, so a failure and a success in the same batch could leave nothing visible. Fixed in upload-plugin.ts: success no longer clears; `withUploads` sets `clearFailures` when a new batch starts. Covered by the test "keeps a failure visible when a success lands in the same batch". The existing plan-05 test (later batch clears) still passes.

## Deviations from Plan

**1. [Rule 1 - Bug] Failure list wiped by same-batch success** (see above). File: upload-plugin.ts.

**2. [Rule 3 - Blocking] React Compiler rejected try/catch with setState in the delete handler** (compiler-compat test). Rewrote as `Promise.resolve(...).catch(...)`.

**3.** EditorMessages is rendered only when mode is 'rich' (the editor state is not the source of truth in source mode).

## Known Stubs

None.

## Verification

`npx vitest run src/components/wiki-editor` 43 files / 490 tests pass; `npx tsc --noEmit` clean; no sonner/toast usage.

## Self-Check: PASSED
