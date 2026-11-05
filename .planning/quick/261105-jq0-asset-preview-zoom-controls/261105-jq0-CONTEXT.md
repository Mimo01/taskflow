# Quick Task 261105-jq0: Asset preview advanced controls (zoom at minimum) - Context

**Gathered:** 2026-11-05
**Status:** Ready for planning

<domain>
## Task Boundary

When clicking any supported asset a preview opens. User wants more advanced control over the preview, following best practices for media viewers/lightboxes — at minimum zoom in/out.

Current surfaces (paths relative to app dir `taskflow/`):
- `src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx` — attachments section preview (image, text, code, pdf, video, audio, fallback). Has only close + prev/next + Esc/←/→.
- `src/routes/dashboard/ImageLightbox.tsx` — wiki inline-image lightbox (WikiRenderer, AuthImage, AioTestRunsSection). Close + Esc only.

</domain>

<decisions>
## Implementation Decisions

### Surfaces
- BOTH surfaces get the controls via ONE shared zoomable image viewer component, so attachment-modal images and wiki inline images behave identically.

### Image controls (all selected by user)
- Zoom in/out buttons.
- Ctrl/⌘+wheel and trackpad pinch zoom toward the cursor; drag to pan when zoomed.
- Fit (reset), actual size 100% (1:1) toggle, live zoom % readout, double-click to toggle zoom.
- Rotate 90°.
- Keyboard shortcuts (+ / − / 0 at minimum) and toolbar extras: download, and "open in external app".
- Existing Esc / ← / → behaviour must keep working (← / → should not conflict with panning — research to decide, e.g. arrows pan only when zoomed, or keep arrows for navigation).

### Engine
- Research decides: maintained library (e.g. react-zoom-pan-pinch) vs small hand-rolled CSS-transform hook. Must work in Tauri's macOS WKWebView (Safari gesture events for pinch, wheel ctrlKey semantics).

### Claude's Discretion
- Which non-image kinds get zoom. Suggested default: text/code get font-size zoom (shared +/−/0 shortcuts); PDF/video/audio keep native controls. Research/planner may adjust.
- Toolbar placement and visual style (must fit the existing dark overlay: white/80 ghost buttons).

</decisions>

<specifics>
## Specific Ideas

- Project memory: custom fixed z-50 overlays must be portalled to body (already done in both components).
- PDFs use data: URIs (WKWebView blanks on blob: PDFs).
- "Open in external app": Tauri app — check what existing opener/download helpers exist (onDownload prop already passed into the modal).
- One row / compact UI preferences: keep toolbar compact.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
