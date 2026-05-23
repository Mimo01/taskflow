---
status: resolved
trigger: "On jira task detail there are two attachment grids (normal and aio). Both have really spaced elements. It has fixed grid element count and on different screens it doesnt look always good"
created: 2026-05-14T00:00:00Z
updated: 2026-05-14T00:00:00Z
---

## Current Focus

hypothesis: Both attachment grids use `grid grid-cols-4 gap-2` (fixed 4 equal columns, each `1fr`) while the thumbnail children are fixed 80×80px (`w-20 h-20`). On wide viewports the grid cells stretch far wider than the thumbnail, leaving large empty space around each 80px image and giving the "really spaced" appearance.
test: Confirmed by direct source inspection of both grid declarations and the thumbnail components inside them.
expecting: Switching to `flex flex-wrap gap-2` keeps 80px thumbnails packed compactly regardless of viewport width and wraps naturally on narrower screens.
next_action: (done)

## Symptoms

expected: Attachment thumbnails on Jira task detail are spaced compactly and consistently across screen sizes. The grid adapts so cell width stays in a reasonable range regardless of viewport width.
actual: Both grids (the normal Jira attachments grid and the AIO attachments grid) display with "really spaced" elements — the gap between cells looks too large, especially on wider screens. The grid has a fixed column count that does not adapt well across viewport widths.
errors: None — visual/layout regression only.
reproduction: Open any Jira task detail view that has attachments. Resize the browser window to compare narrow/medium/wide viewports — the spacing problem is most apparent on wide viewports.
started: Reported 2026-05-14.

## Eliminated

(none — direct root cause confirmed by source inspection)

## Evidence

- timestamp: 2026-05-14T00:00:00Z
  source: `taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx:166`
  finding: Image thumbnails grid declared as `<div className="grid grid-cols-4 gap-2">`. Children are `<AttachmentThumbnail>` components.

- timestamp: 2026-05-14T00:00:00Z
  source: `taskflow/src/routes/dashboard/issue-detail/AttachmentThumbnail.tsx:15`
  finding: Each thumbnail is sized `className="w-20 h-20 rounded-md ..."` — fixed 80px × 80px. Combined with `grid-cols-4` parent, the 1fr cells stretch much wider than the thumbnail on large viewports, leaving empty horizontal space around each image.

- timestamp: 2026-05-14T00:00:00Z
  source: `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:183`
  finding: AIO grid declared as `<div className="grid grid-cols-4 gap-2">` with inline children sized `w-20 h-20` (same 80×80 fixed thumbnails). Identical anti-pattern as the legacy attachments section.

- timestamp: 2026-05-14T00:00:00Z
  source: codebase pattern survey
  finding: Project consistently uses `flex flex-wrap gap-X` for collections of fixed-size chips/items (UnifiedFilterBar, BacklogFilterBar, FieldsSection, etc.). `flex flex-wrap` is the idiomatic in-project pattern for this scenario.

- timestamp: 2026-05-14T00:00:00Z
  source: post-fix verification
  finding: TypeScript `tsc --noEmit` passes clean. `vitest run AioTestRunsSection.test.tsx` → 28 passed, 2 skipped. Pre-existing biome lint warnings unrelated to changed files. No tests directly cover `AttachmentsSection`.

## Resolution

root_cause: Both attachment thumbnail grids use `grid grid-cols-4 gap-2`, which produces four equal `1fr` columns regardless of viewport width. The thumbnail children are fixed 80×80px (`w-20 h-20`), so on wide viewports each cell becomes much wider than its content, producing the perceived "really spaced" gaps. The grid does not adapt — it always renders exactly four columns even when many more compact thumbnails would fit comfortably.
fix: Replaced `grid grid-cols-4 gap-2` with `flex flex-wrap gap-2` on both grids. With flex-wrap the 80×80px thumbnails pack tightly with a consistent 8px gap and wrap to the next row when they run out of horizontal space — giving compact, screen-width-adaptive layout. This matches the in-project idiom for fixed-size chip/item collections (UnifiedFilterBar, FieldsSection, etc.).
verification: `tsc --noEmit` clean. `AioTestRunsSection.test.tsx` → 28/28 tests pass (2 skipped, unchanged). No new lint warnings introduced (pre-existing warnings unrelated). Both grids now render thumbnails tightly packed with consistent 8px gaps across all viewport widths.
files_changed:
  - taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
