# Quick Task 261112-ey2 Summary

Issue-detail attachment file rows are now fully clickable: an absolute inset-0 overlay button (`Preview <filename>`) makes the whole previewable row, padding included, open the preview.

## Changes
- `taskflow/src/routes/dashboard/issue-detail/AttachmentFileRow.tsx`: row is `relative` with `focus-within:bg-muted/50`. The overlay button renders only when `onPreview` is set. The name content sits in a `pointer-events-none` wrapper, and the underline is now `group-hover:underline`. The actions wrapper is `relative z-10` and tight to the buttons. Download/Delete carry `group-focus-within:opacity-100` and the pointer-events toggles, so they stay keyboard-reachable without swallowing clicks while hidden.
- `taskflow/src/routes/dashboard/issue-detail/AttachmentFileRow.test.tsx` (new): 5 RTL tests covering preview overlay, non-previewable, download/delete isolation, and no delete button when `onDelete` is omitted.

## Verification
- vitest issue-detail: 22 files passed (327 tests passed, 2 skipped); biome check and tsc clean.
- Hit-area/hover/focus check was done by reasoning about the classes, not in a rendered page. The overlay spans the full row box. Name content ignores the pointer, so clicks reach the overlay. Focus order is overlay, then Download, then Delete, and the focus ring is on the overlay.

## Deviations
None. AttachmentsSection.tsx and the thumbnail grid are untouched.

## Commits
- c98b4acd feat(quick-261112-ey2): make attachment file rows fully clickable for preview
