---
status: resolved
trigger: "on issue detail when i open a preview of asset the main sidebar border has higher zindex than the preview"
created: 2026-11-05
updated: 2026-11-05
---

## Symptoms
- expected: attachment preview overlay covers the whole window, including the app sidebar
- actual: the sidebar's right border (resize handle) paints over the preview's dark backdrop

## Current Focus
next_action: none (resolved)

## Evidence
- timestamp: 2026-11-05 — `src/main.tsx:706` `<main className="isolate ...">` creates a stacking context
- timestamp: 2026-11-05 — AttachmentPreviewModal / ImageLightbox render `fixed inset-0 z-50` inline (no portal), so their z-50 is confined inside main
- timestamp: 2026-11-05 — Sidebar resize handle `absolute ... z-20 border-r` (Sidebar.tsx:283) lives outside main, in the root context, so it outranks the whole main subtree

## Eliminated

## Resolution
root_cause: preview overlays were rendered inside the `isolate` <main> stacking context, so z-50 could not lift them above the sidebar's z-20 resize-handle border
fix: render AttachmentPreviewModal and ImageLightbox via createPortal(…, document.body)
verification: biome + tsc clean; src/routes/dashboard vitest 1866 passed; lightbox tests now query document.body (they'd fail if the dialog were still inside the container)
files_changed:
  - taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx
  - taskflow/src/routes/dashboard/ImageLightbox.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx
