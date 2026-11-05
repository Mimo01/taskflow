---
status: resolved
blockers: 0
warnings: 5
resolved_in: f1e38c55
# All 5 fixed inline after user decisions (2026-11-05): Download = save only;
# Open externally = safe-type allowlist else reveal in Finder; $TEMP scope dropped.
# WR-03 was partly pre-existing (old body wrapper stopPropagation + double Escape).
# 13 regression tests added, each proven failing on d03bc949.
depth: quick
range: b766ce32..d03bc949
---

# Code Review — 261105-jq0 asset preview zoom controls

Sound: zoom-to-cursor math (rotation-independent), clampPan 90/270 swap, listener cleanup, blob URL revocation, no React Compiler module reads.

## WR-01 Auto-open launches any attachment type (security) — CONFIRMED
`opener:allow-open-path` ($DOWNLOAD/**, $TEMP/**) is new; before it, Download's `openPath(...).catch(() => undefined)` was silently denied. Now Download and Open externally launch any saved file (.command, .terminal, .jar, .dmg) in its default handler. `$TEMP/**` only used as a fallback.

## WR-02 fetchAndSave / saveBlobUrl ignore HTTP status — CONFIRMED
`AttachmentsSection.fetchAndSave` calls `resp.blob()` without `resp.ok`; a 401/404 body is saved as the attachment and opened, UI says "saved to Downloads". Lightbox Download of an external (non-Jira) image src uses native fetch (CORS).

## WR-03 stopNonEscape blocks modal document key handler
Modal listens on `document`; portal content's React stopPropagation stops native propagation at root. With focus on a toolbar button: text/code `+/-/0` dead, image ←/→ at fit dead. Escape inside wrapper fires onClose twice (overlay onKeyDown + document).

## WR-04 wasDrag click suppression is dead code
Stage onClick never closes; backdrop protection comes from parents' downOnBackdrop. Remove wasDrag/dragDistance/DRAG_THRESHOLD_PX.

## WR-05 gestureActive can stick
Cleared only on gestureend; a lost gesture disables ctrl/cmd-wheel zoom until the next pinch. Expire by timestamp (~300ms) or reset on pointerdown.
