---
phase: quick-261105-jq0
verified: 2026-11-05T00:00:00Z
status: human_needed
score: 8/8 must-haves verified in code (hardware input paths pending Task 4)
human_verification:
  - test: "Trackpad pinch over the image in `npm run tauri dev`"
    expected: "Zooms toward the fingers, page does not magnify, no double-applied zoom (gesture* vs ctrl-wheel)"
    why_human: "WKWebView pinch path (gesture* vs ctrl-wheel) can't be exercised in jsdom; the probe was never run"
  - test: "Cmd/Ctrl+scroll with a mouse, plain scroll at fit and when zoomed, drag pan, release drag over backdrop"
    expected: "Zooms toward cursor; plain scroll pans only when zoomed; preview stays open after a drag released on the backdrop"
    why_human: "Real pointer/wheel hardware in Tauri"
  - test: "Open externally and Download on an image and a PDF, in both the attachment modal and the wiki/AIO lightbox"
    expected: "File opens in the OS default app; Download saves then auto-opens; failure shows an error in the modal"
    why_human: "The opener:allow-open-path capability only takes effect after a full Tauri rebuild, and it launches an OS app"
  - test: "Visual check: 800% sharpness, toolbar placement and fit within viewport, dblclick toggle, keys + - 0 1 r R, arrows, Esc"
    expected: "Pixel-sharp at high zoom; compact bottom-centre pill; Left/Right navigate at fit and pan when zoomed"
    why_human: "Rendering quality and feel"
---

# Quick 261105-jq0: Asset preview zoom controls - Verification

**Goal:** Opening a supported asset preview gives viewer-grade controls, with zoom in/out at minimum.
**Status:** human_needed. All automated and code-level checks pass. The only open items are the Task 4 hardware checkpoint steps.
**Re-verification:** No, initial verification.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Attachment images and wiki/AIO inline images share one ImageViewer | VERIFIED | `ImageLightbox.tsx` and `AttachmentPreviewModal.tsx` each render `<ImageViewer key=...>`. `AuthImage` is no longer used in the modal. |
| 2 | Zoom via buttons and +/-/=/_ keys, with a live % readout | VERIFIED | `useImageViewer.ts` keydown handles + = - _ (Ctrl/Meta allowed). `ImageViewer.tsx` shows `Math.round(scale*100)%` and zoom buttons dispatch `zoomIn`/`zoomOut` (ladder in `lib/image-viewer.ts`). ImageViewer tests pass. |
| 3 | Ctrl/Cmd+wheel and pinch zoom toward the cursor; drag/wheel pan only when pannable | VERIFIED (code) / human for hardware | Non-passive `wheel` listener: ctrl/meta dispatches `wheelZoom` at the cursor point. Safari `gesture*` handlers dispatch `pinch`, and ctrl-wheel is ignored while a gesture is active. Pan applies only when `pannableRef` is true. `zoomAt` uses `t' = p - (p - t) * ratio` followed by `clampPan`. Real-device behaviour is deferred to Task 4. |
| 4 | Fit (0), 100% (1), dblclick toggle, rotate (r/R) with re-fit | VERIFIED | The reducer has `fit`, `actual`, `toggleZoom` (fit to 100%, or 2x if fit is already 1, otherwise back to fit) and `rotate` (calls `fitState`). Keys are wired in the hook. |
| 5 | Arrows navigate at fit, pan when zoomed; Esc always closes | VERIFIED | The hook's capture-phase handler returns early (no preventDefault) when not pannable, and pans and prevents default when pannable. The modal's handler returns on `defaultPrevented` arrows. The hook never handles Escape. `stopNonEscape` lets Esc through. |
| 6 | Download keeps its old behaviour; Open externally saves and opens, with errors surfaced | VERIFIED | `AttachmentsSection`: `handleDownload` uses `fetchAndSave` and then `openSavedFile(...).catch(noop)`. `handleOpenExternal` rethrows `Couldn't open <file>: <reason>`. The modal and ImageViewer render the error in the toolbar status slot. `default.json` has `opener:allow-open-path` scoped to `$DOWNLOAD/**` and `$TEMP/**` (no `**`). |
| 7 | Text/code get font zoom (same keys); PDF/video/audio get only Download + Open externally | VERIFIED | The modal has `fontSize` state (default 12) and applies it as an inline `style` on the `<pre>`. Its keydown branch is active only for text/code. There is a "Text controls" toolbar (zoom, readout, fit). pdf/video/audio get a "File actions" toolbar with actions only and no key interception. |
| 8 | Zoom/rotation reset on navigation; a pan drag released over the backdrop doesn't close | VERIFIED | `key={current.id}` and `key={src}` remount the viewer. `fontSize` and `openError` reset on index change. Both overlays use the `downOnBackdrop` pointerdown-origin guard. |

**Score:** 8/8 verified at code and test level.

## Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/image-viewer.ts` | VERIFIED | The exports (fitScale, clampPan, zoomAt, nextStop, prevStop, viewerReducer, initialViewerState, nextFontSize, prevFontSize) are all present and the math is substantive. |
| `src/lib/save-attachment.ts` | VERIFIED | saveBytes, saveBlobUrl, openSavedFile (errors propagate) and filenameFromSrc. |
| `ImageViewer.tsx`, `ViewerToolbar.tsx`, `useImageViewer.ts` | VERIFIED | Substantive and wired. Data flows from `useAuthBlob` to the img to `onLoad` and then the reducer. |
| `src-tauri/capabilities/default.json` | VERIFIED | Scoped `opener:allow-open-path`. |

## Key Links

| From | To | Status |
|------|----|--------|
| ImageLightbox to ImageViewer | WIRED |
| AttachmentPreviewModal to ImageViewer | WIRED |
| useImageViewer to viewerReducer (`passive: false` listeners) | WIRED |
| save-attachment to `invoke('save_attachment')` and `openPath` | WIRED |
| AttachmentsSection to modal `onOpenExternal` | WIRED |

## Spot-checks

- Ran `vitest` on image-viewer, save-attachment, ImageViewer, AttachmentPreviewModal and WikiRenderer: 5 files, 229 tests, all pass.
- `tsc --noEmit` is clean. `react-zoom-pan-pinch` is not in `package.json`. No TODO/FIXME/TBD/XXX markers in the touched files.
- The summary reports the full suite as passing (284 files). I did not rerun it.

## Anti-patterns

None blocking. Minor note: a reducer-level `zoomAt` at minimum scale returns the fit state when `next` is within EPS of fit. This is intentional.

## Requirements

QUICK-261105-jq0 is satisfied at code level. The decisions D-01..D-05 are honoured.

## Human Verification Required

These are the Task 4 how-to-verify steps 1-10, which are not yet performed. The pinch-path probe (ctrl-wheel vs gesture*) was also not run. Both input paths are handled defensively, so a double-zoom is unlikely but unconfirmed.

1. Trackpad pinch zoom toward the fingers without page magnification.
2. Cmd/Ctrl+wheel zoom, plain-scroll pan only when zoomed, and drag pan with no close on backdrop release.
3. Open externally and Download on an image and a PDF, in the modal and in the lightbox (needs a full `tauri dev` rebuild for the capability).
4. 800% pixel sharpness, toolbar layout, and the keyboard and dblclick behaviour.

## Gaps Summary

No code gaps. Status is human_needed only because of the pending hardware checkpoint.

_Verifier: Claude (gsd-verifier)_
