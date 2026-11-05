---
phase: quick-261105-jq0
plan: 01
subsystem: dashboard/asset-preview
tags: [image-viewer, zoom, tauri, opener, wkwebview]
requires: []
provides:
  - shared ImageViewer (zoom/pan/rotate) used by attachment modal and wiki/AIO lightbox
  - opener:allow-open-path capability scoped to $DOWNLOAD/** and $TEMP/**
affects: [AttachmentPreviewModal, ImageLightbox, AttachmentsSection]
tech-stack:
  added: []
  patterns: [pure reducer + native non-passive listener hook, pointerdown-origin backdrop guard]
key-files:
  created:
    - taskflow/src/lib/image-viewer.ts
    - taskflow/src/lib/image-viewer.test.ts
    - taskflow/src/lib/save-attachment.ts
    - taskflow/src/lib/save-attachment.test.ts
    - taskflow/src/routes/dashboard/useImageViewer.ts
    - taskflow/src/routes/dashboard/ViewerToolbar.tsx
    - taskflow/src/routes/dashboard/ImageViewer.tsx
    - taskflow/src/routes/dashboard/ImageViewer.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.test.tsx
  modified:
    - taskflow/src-tauri/capabilities/default.json
    - taskflow/src/routes/dashboard/ImageLightbox.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx
decisions:
  - Hand-rolled reducer engine (no new packages)
  - Arrows pan only when zoomed past fit; otherwise navigate
  - Download keeps save-then-auto-open; Open externally is separate and surfaces errors
  - Key handlers stop propagation of non-Escape keys only, so Esc still closes from a focused toolbar button
metrics:
  tasks: 3 of 4 (task 4 is a human checkpoint, pending)
  completed: 2026-11-05
---

# Phase quick-261105-jq0 Plan 01: Asset preview zoom controls Summary

Shared hand-rolled ImageViewer (zoom toward cursor via ctrl/cmd-wheel, Safari gesture pinch, drag pan, fit/100%/rotate, shortcuts, Download + Open externally) wired into both the attachment preview modal and the wiki/AIO lightbox, plus text/code font zoom and a scoped `opener:allow-open-path` capability.

## Commits

- f182bcc9: viewer zoom math (`viewerReducer`), save/open helpers, opener capability
- 87354362: ImageViewer, ViewerToolbar, useImageViewer; ImageLightbox rewired
- d03bc949: AttachmentPreviewModal integration, text/code font zoom, media toolbar, AttachmentsSection `fetchAndSave` + `handleOpenExternal`

## Deviations from Plan

- [Rule 1 - Bug] `clampPan` returned `-0`, breaking equality; normalised with `|| 0`.
- [Rule 1 - Bug] Plan's toolbar/stage `onKeyDown` propagation-stoppers would have swallowed Escape from a focused toolbar button (React root stopPropagation blocks the document listener). Added `stopNonEscape` helper (exported from ViewerToolbar.tsx) used by toolbar, stage, lightbox wrapper and modal body wrapper.
- PDF/video max height reduced 85vh to 75vh and text/code to 75vh so the new toolbar and caption fit below.
- No production code was bent for test mocks.

## Known Stubs

None.

## Task 4 (pending, human checkpoint)

Pinch-path probe (ctrl-wheel vs gesture*) NOT run by the executor; both paths are handled (gesture events set a flag that ignores ctrl-wheel). User to record the result.

## Self-Check: PASSED

Full vitest (284 files), tsc and biome on touched files pass; commits f182bcc9, 87354362, d03bc949 exist.

## Post-review fixes (orchestrator, f1e38c55)

User decisions after code review: Download saves only (the pre-task auto-open never worked — `allow-open-path` wasn't granted); Open externally kept but limited to passive document/media extensions (`isSafeToOpen`), everything else revealed in Finder with an info message (`REVEALED_MESSAGE`). Opener scope narrowed to `$DOWNLOAD/**`.

- WR-02: `assertOk` rejects non-2xx before saving (`fetchAndSave`, `saveBlobUrl`).
- WR-03: removed `stopNonEscape` and overlay Escape `onKeyDown`; keys reach the document/window listeners, Escape closes once.
- WR-04: removed dead `wasDrag`/`dragDistance`.
- WR-05: gesture suppression of ctrl-wheel expires after `GESTURE_STALE_MS` (300ms).
- 13 regression tests, each verified failing on d03bc949 in a temp worktree. Full suite 4456 passed.
