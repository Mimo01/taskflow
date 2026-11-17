---
phase: 99-mentions-media-smart-input
plan: 05
subsystem: wiki-editor
tags: [tiptap, upload, prosemirror-decorations, attachments]
requires: ["99-01"]
provides:
  - "upload-state.ts: clipboardImageName, classifyFile, stagedFileName, renameFile"
  - "embed.ts: embedContentFor, insertEmbed (mirrors attachmentRef)"
  - "upload-plugin.ts: WikiUpload, startUploads, withUploads, getUploadFailures, getSessionUploads, clearUploadFailures, uploadPluginKey"
affects: [99-09, 99-10, 99-12]
key-files:
  created:
    - taskflow/src/components/wiki-editor/media/upload-state.ts
    - taskflow/src/components/wiki-editor/media/upload-state.test.ts
    - taskflow/src/components/wiki-editor/media/embed.ts
    - taskflow/src/components/wiki-editor/media/embed.test.ts
    - taskflow/src/components/wiki-editor/media/upload-plugin.ts
    - taskflow/src/components/wiki-editor/media/upload-plugin.test.ts
key-decisions:
  - "Placeholders carry a global seq; a resolving placeholder leaves earlier-seq placeholders at the same position in front of the inserted node, so batch order survives out-of-order completion"
  - "Success clears the failure list (per plan); a failure and a success in the same batch therefore end with an empty list if the success resolves last"
requirements-completed: [INPUT-02, INPUT-03]
duration: ~30min
completed: 2026-11-17
---

# Phase 99 Plan 05: Upload and embed engine Summary

Pure naming/classification helpers, a picker embed command, and the `WikiUpload` ProseMirror plugin: pasted/dropped files become ordered widget-decoration placeholders (never document nodes) that resolve into `image`/`attachment` nodes via `host.uploadFile`, or embed at once through `host.stageFile` in create mode.

## Tasks

1. Helpers and `embedContentFor`/`insertEmbed`: commit 4b91cacb.
2. `WikiUpload` plugin, placeholders, ordered resolution, staged mode, paste/drop handlers: committed with this summary.

## Verification

`npx vitest run src/components/wiki-editor src/lib/wiki` green (914 tests), `tsc --noEmit` clean, biome clean on the media dir, no `innerHTML`, no placeholder node type.

## Deviations from Plan

None in behavior. Notes:
- The `IMAGE_EXTENSIONS` list is duplicated locally (resolvePreviewKind does not export it), with a parity comment, as the plan specified.
- The full pre-commit vitest run was flaky under parallel-worktree load (unrelated suites timing out); the first commit succeeded on retry.
- `withUploads` takes positions in the document after the passed transaction's steps; callers adding steps must do so before calling it.

## Known Stubs
None. Registration in the live editor (plan 12), the error line (plan 09) and HTML-image paste (plan 10) are deliberately left to those plans.

## Threat Flags
None. Placeholder DOM uses createElement/textContent only (T-99-17); embeds mirror attachmentRef hazard rules (T-99-16); placeholders never reach saved text (T-99-20).

## Self-Check: PASSED
