# Quick Task 261112-f4u: Unified attachments tile grid with two-line filename captions - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

<domain>
## Task Boundary

Issue detail → Attachments section (`issue-detail/AttachmentsSection.tsx`). Replace the current split
(80px image squares on top + `AttachmentFileRow` rows below) with ONE grid of same-size tiles for
every attachment. Follow-up to 261112-ey2 (rows made fully clickable); user then chose the tile grid,
option **B** from the mockup https://claude.ai/code/artifact/1c1299f3-6bcb-4d57-bdd4-5f8d95c9aad1 .

</domain>

<decisions>
## Implementation Decisions

### Grid (locked — matches approved mockup option B)
- `display:grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap ~12px row / 10px col`.
- Each tile = thumb box + caption below. Thumb: `aspect-ratio: 4/3`, rounded-md, `border border-border`,
  `bg-muted`, overflow-hidden.
  - Image attachments: the picture, `object-cover` (reuse AuthImage + the MAX_FULL_THUMB_BYTES
    full-content-vs-thumbnail logic from `AttachmentThumbnail.tsx`).
  - Other files: centred file-type icon (existing getFileIcon rule: FileText for text/* and pdf, else File),
    muted, ~26px, with the UPPERCASE extension in small mono muted text near the thumb bottom.
- Caption: filename `text-xs`/12.5px, leading-snug, **clamped to 2 lines** (`line-clamp-2`),
  `overflow-wrap:anywhere` (`break-all`-ish so names without spaces wrap), and it ALWAYS reserves
  two lines of height so captions/tiles align. Below it the size (`formatFileSize`, fallback mimeType)
  in muted 11px tabular-nums. Full filename in `title` tooltip.
- Order: original attachment order from Jira (no images-first sorting).

### Click behaviour
- Previewable tile (resolvePreviewKind !== 'other'): the WHOLE tile opens the preview (index into the
  existing `previewable` list). Hover/focus: muted background on the tile (padding ring around it via
  p-1 -m-1 so the grid edge doesn't shift) + filename underline.
- Non-previewable tile: same as today's rows → no tile click action; only the hover actions.
- Use the overlay-button pattern (see [[project_overlay_button_nested_interactive]] in
  `IssueActivityGroup.tsx` ActivityGroupHeader and the just-shipped `AttachmentFileRow.tsx`):
  container `div.relative group`, sibling `<button class="absolute inset-0">` with aria-label
  `Preview <filename>` + focus-visible ring; content `pointer-events-none`.

### Download / Delete
- Kept as hover/focus-revealed small icon buttons overlaid on the thumb's top-right corner
  (`relative z-10`, small backdrop so they read on photos, e.g. bg-background/80 rounded).
  Hidden state must not take clicks: `opacity-0 pointer-events-none group-hover:… group-focus-within:…`
  (same ACTION_VISIBILITY recipe as AttachmentFileRow). Delete only when `onDelete` provided.
- Download feedback text stays below the grid as now.

### Cleanup
- `AttachmentThumbnail` is still used by `AttachmentPickerModal` — keep it.
- `AttachmentFileRow` component becomes unused by the section. Move `formatFileSize` (imported by
  DescriptionEditor, AttachmentPickerModal, AttachmentPreviewModal) and `getFileIcon` into a small
  shared module (e.g. `issue-detail/attachment-format.ts`), update imports, and delete
  `AttachmentFileRow.tsx` + its test. Update the WikiRenderer.tsx:1486 comment reference.

### Claude's Discretion
- Exact component name/file for the tile (e.g. `AttachmentTile.tsx`), exact icon button sizes, density
  variants (keep gap/padding modest; density changes spacing only).

</decisions>

<specifics>
## Specific Ideas

- Section empty state, drag-drop overlay, upload progress, SectionHeader, preview modal: unchanged.
- Tests: new AttachmentTile test (preview button for previewable / none for 'other'; download & delete
  call handlers without triggering preview; no delete w/o onDelete) + an AttachmentsSection-level
  check that images and files render in one grid in original order, if cheap.
- Placeholder data only in fixtures.

</specifics>
