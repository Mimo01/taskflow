# Quick 261105-jq0: Asset preview advanced controls - Research

**Researched:** 2026-11-05
**Domain:** In-app image viewer (zoom/pan/rotate) inside Tauri macOS WKWebView, React 19 + React Compiler
**Confidence:** MEDIUM-HIGH (codebase facts HIGH; WKWebView pinch semantics MEDIUM until probed on hardware)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- BOTH surfaces get the controls via ONE shared zoomable image viewer component, so attachment-modal images and wiki inline images behave identically.
- Image controls (all selected by user): Zoom in/out buttons. Ctrl/⌘+wheel and trackpad pinch zoom toward the cursor; drag to pan when zoomed. Fit (reset), actual size 100% (1:1) toggle, live zoom % readout, double-click to toggle zoom. Rotate 90°. Keyboard shortcuts (+ / − / 0 at minimum) and toolbar extras: download, and "open in external app". Existing Esc / ← / → behaviour must keep working (← / → should not conflict with panning — research to decide).
- Engine: research decides (library vs hand-rolled CSS-transform hook). Must work in Tauri's macOS WKWebView (Safari gesture events for pinch, wheel ctrlKey semantics).

### Claude's Discretion
- Which non-image kinds get zoom. Suggested default: text/code get font-size zoom (shared +/−/0 shortcuts); PDF/video/audio keep native controls.
- Toolbar placement and visual style (must fit the existing dark overlay: white/80 ghost buttons).

### Deferred Ideas (OUT OF SCOPE)
- None listed.
</user_constraints>

## Summary

Hand-roll it. Put the zoom/pan/rotate state in a **pure reducer** (`src/lib/image-viewer.ts`) and add a thin `useImageViewer` hook that wires up non-passive `wheel`, Safari `gesture*` and pointer listeners on a stage ref. Build one `<ZoomableImage>` / `<ImageViewer>` component that both `AttachmentPreviewModal` (the image branch) and `ImageLightbox` render. `react-zoom-pan-pinch` (4.2.0, maintained, 3.6M downloads/week) was checked and rejected for this app. It has no Safari `gesturestart/gesturechange` handling. It has no rotation, and rotating a child would break its bounds math. It has no concept of "100% = natural pixels". And it can't do "ctrl-or-⌘ + wheel only" (`wheelDisabled` passes `ctrlKey` only). Every locked control would need a workaround on top of it. This is desktop-only with mouse and trackpad (no touch), so the hand-rolled math is about 150 lines and fully unit-testable.

Two integration facts matter more than the engine choice. (1) The viewer must use `useAuthBlob` directly instead of `AuthImage`. It needs the `<img>` `onLoad` natural size and the blob URL for download. (2) **`openPath` is not permitted by the current capability.** `opener:default` = `allow-open-url, allow-reveal-item-in-dir, allow-default-urls`, with no `allow-open-path`. So the existing `openPath(savedPath).catch(() => undefined)` in `AttachmentsSection.handleDownload` is almost certainly rejected and swallowed silently today. "Open in external app" needs a capability change.

**Primary recommendation:** pure `viewerReducer` + `useImageViewer` hook + shared `ImageViewer` component. Arrows pan when zoomed past fit and navigate otherwise. Add `opener:allow-open-path` scoped to `$DOWNLOAD/**` and `$TEMP/**`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Zoom/pan/rotate math | Browser (pure TS module) | — | Deterministic, testable without layout |
| Gesture/wheel/key input | Browser (hook on stage ref) | — | Needs non-passive native listeners |
| Authenticated image bytes | Browser (`useAuthBlob`, plugin-http) | — | Existing single auth-fetch path |
| Save to disk / open externally | Tauri Rust (`save_attachment`) + opener plugin | Capabilities JSON | FS + OS launch are native-only |

## Best-practice control set (prescriptive)

Sources: Preview/Quick Look conventions, yet-another-react-lightbox Zoom plugin [CITED: yet-another-react-lightbox.com/plugins/zoom], browser image viewers. Defaults marked [ASSUMED] are conventions, not specs.

| Control | Recommendation |
|---|---|
| Scale unit | `scale` is relative to **natural pixels**: 1 = 100% = 1 image px per CSS px. The readout shows `Math.round(scale*100)%`. |
| Fit | `fit = min(1, stageW / rotW, stageH / rotH)`, where `rotW/rotH` swap at 90°/270°. Don't upscale small images past 100% when fitting, as Preview does [ASSUMED]. Keep `mode: 'fit' \| 'free'` so a window resize re-fits while in fit mode. |
| Min / max | min = `min(fit, 0.1)`, max = 8 (800%). yarl also defaults maxZoom to 8 [CITED]. |
| Button / key steps | Snap to the next stop on the ladder `[0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8]`, like browser zoom [ASSUMED]. Zoom toward the stage centre. |
| Wheel / pinch | Continuous: `s' = clamp(s * exp(-deltaY * k))`. Use k ≈ 0.01 and clamp the per-event factor to [0.8, 1.25], because a mouse ctrl+wheel notch reports deltaY ≈ 100 [ASSUMED]. Zoom toward the cursor. |
| Zoom-to-point | With `transform-origin: center` and p = cursor relative to the stage centre: `t' = p − (p − t) · (s'/s)`. Then clamp. |
| Pan clamp | Per axis: if `content*s ≤ stage`, centre (t = 0). Otherwise `\|t\| ≤ (content*s − stage)/2`. Use the rotated content dims. |
| Plain wheel / 2-finger scroll | When zoomed (pannable), pan by `-deltaX/-deltaY`. At fit, do nothing (don't zoom without ctrl/⌘), as in Preview [ASSUMED]. |
| Double-click | At fit, zoom to 100% at the cursor; if fit is already 1, go to 2×. Otherwise go back to fit. Covers the "1:1 toggle" too. |
| Rotate | 90° clockwise steps (`r` key; `Shift+R` counter-clockwise). Re-fit after rotating. |
| Drag | Pointer drag pans only when pannable. Use `cursor: grab/grabbing`, and `zoom-in` at fit. Use `setPointerCapture`. |
| Keyboard | `+` or `=` zoom in, `-` or `_` zoom out. The ⌘ variants (⌘=, ⌘−) also work [CITED: yarl shortcut list]. `0` = fit, `1` = 100%, `r` = rotate. **←/→/↑/↓ pan when `scale > fit`; otherwise ←/→ keep prev/next** (yarl does the same: arrows pan when zoomed [CITED]). `Esc` always closes (existing behaviour). Call `preventDefault` on handled keys. |
| Reset | Zoom/rotation resets on navigation: mount the viewer with `key={src}`. |

**Toolbar:** a bottom-centre floating pill, `bg-black/60 rounded-full`, with `text-white/80 hover:text-white hover:bg-white/10` ghost icon buttons (lucide `ZoomOut`, `ZoomIn`, `Maximize` (fit), `Scan`/`1:1` text, `RotateCw`, `Download`, `ExternalLink`). The layout is `[−] 100% [+] │ [Fit] [1:1] │ [⟳] │ [⤓] [↗]`, kept on one compact row. The filename caption sits above the pill or stays where it is now. Close stays top-right and the prev/next chevrons stay at the sides (unchanged). Use `role="toolbar" aria-label="Image controls"`. Each button gets `aria-label`, `title` with its shortcut ("Zoom in (+)") and `aria-keyshortcuts`. Disable zoom-in at max and zoom-out at min. The readout is plain text and needs no aria-live (it would be too chatty during a pinch). Show the toolbar from mount, with controls disabled until the image's natural size is known.

## Engine decision

| | Hand-rolled reducer + hook (RECOMMENDED) | react-zoom-pan-pinch 4.2.0 |
|---|---|---|
| Maintenance / React 19 | n/a | Active (4.2.0, 2026-09-03), peer `react: *` [VERIFIED: npm registry] |
| Size | ~150–250 LOC | dist esm 162 KB raw / ~33 KB gz, unminified [VERIFIED: npm pack] |
| Safari `gesture*` events | Handled explicitly | **Not handled**: no `gesturestart/gesturechange` listeners in dist [VERIFIED: grep of dist] |
| ctrl/⌘ + wheel only | Trivial | `wheel.wheelDisabled:true` allows `ctrlKey` only, so ⌘ is blocked; `activationKeys` relies on keydown state, which a synthetic pinch `ctrlKey` doesn't set [VERIFIED: dist source `isWheelAllowed`] |
| Rotation | Native in the transform | None; bounds use the unrotated content box |
| 100% = natural px | Native | Scale 1 = laid-out size; needs `setTransform` math |
| Defaults to fight | — | plain wheel zooms, `minScale:1`, keyboard off, double-click zoomIn only |

Rejected `yet-another-react-lightbox`: it is a full lightbox framework that would replace both modals, including the non-image kinds and the data:-URI PDF path. That is too big a rewrite for this task.

### WKWebView input semantics
- From Safari/WebKit 15, a trackpad pinch on macOS is sent as `wheel` with `ctrlKey: true`, *and* WebKit still fires the proprietary `gesturestart/gesturechange/gestureend` events. In `gesturechange`, `scale` is cumulative from the start of the gesture [CITED: danburzo.ro/dom-gestures]. Some reports claim Safari sends gesture events only [LOW]. **Handle both paths.** On `gesturestart`, store `startScale` and set `gestureActive = true`. On `gesturechange`, apply `s = startScale * e.scale` at `(e.clientX, e.clientY)`. While `gestureActive`, ignore ctrl-wheel so the zoom isn't applied twice. Clear the flag on `gestureend`, which can fire twice, so make it idempotent.
- All of these listeners must be **non-passive** and call `preventDefault()`, or WebKit will try to magnify the page. React's `onWheel` is passive at the root, so use `ref.addEventListener('wheel', h, { passive: false })` inside an effect [ASSUMED: React 17+ behaviour, well known].
- `tauri.conf.json` doesn't set `zoomHotkeysEnabled` (Tauri 2 default false), so ⌘=/⌘− are free for the viewer [VERIFIED: grep]. No global single-key hotkeys conflict; app-wide `useHotkeys` are all `mod+…` or `escape` [VERIFIED: grep].
- **Probe on real hardware before UAT.** Log `wheel.ctrlKey` and `gesture*` events in the built app to confirm which path fires in this WKWebView.

## Architecture / integration

```
img (blobUrl from useAuthBlob) ──onLoad(natural w,h)──┐
stage ResizeObserver(contentRect) ────────────────────┼─► viewerReducer(state, action) ─► style.transform =
wheel / gesture* / pointer / keydown ─► actions ──────┘     {natural, stage, scale, tx, ty, rot, mode}   translate(tx,ty) scale(s) rotate(r)
toolbar buttons ─► actions; Download / Open ─► onDownload / onOpenExternal props
```

- **Files:** `src/lib/image-viewer.ts` (pure: `fitScale`, `clampPan`, `zoomAt`, `nextStop/prevStop`, `viewerReducer`). `src/components/app/ImageViewer.tsx` (stage, `<img>`, toolbar, listeners; it portals nothing). The modals keep their portal, backdrop, close and nav. `ImageLightbox` becomes overlay + `<ImageViewer>`. `AttachmentPreviewModal` renders `<ImageViewer key={current.id}>` in the `'image'` case.
- **Image layout:** render `<img>` with explicit `width/height = natural px`, absolutely centred in an `overflow-hidden` stage that fills the overlay (for example `w-[90vw] h-[85vh]`). Drop `object-contain` and `max-w`. Show the existing pulse placeholder until `onLoad`. Because the bitmap is at native resolution, scaling down stays sharp.
- **Event loop:** use a reducer, so listeners registered once in an effect dispatch actions and never read state. This avoids stale closures and works with the React Compiler; don't keep viewer state in module scope (see memory "React Compiler vs module reads").
- **Download:** `AttachmentPreviewModal` already gets `onDownload(att)`, which uses plugin-http fetch, then `invoke('save_attachment')` to save into Downloads, then `openPath`. `ImageLightbox` (wiki/AIO) has no download today. Add a shared helper such as `src/lib/save-attachment.ts`: `saveBlobUrl(blobUrl, filename)` reads bytes from the already-fetched blob (native `globalThis.fetch(blobUrl)`, not plugin-http) and calls `save_attachment`. That avoids a second authenticated fetch. Filename comes from `alt`, then the URL's last path segment, then `image`.
- **Open in external app:** save with the same command, then `openPath(path)`. **Required capability change** in `src-tauri/capabilities/default.json`: `{ "identifier": "opener:allow-open-path", "allow": [{ "path": "$DOWNLOAD/**" }, { "path": "$TEMP/**" }] }` [CITED: v2.tauri.app/plugin/opener]. Recommendation: Open = save to Downloads + `openPath` (Preview opens it); Download = save + `revealItemInDir`, or keep the existing behaviour. The planner should decide whether "Download" should stop auto-opening now that "Open" exists. Show errors through the existing feedback pattern; don't swallow them.

## Non-image kinds

| Kind | Recommendation |
|---|---|
| text / code | Font-size zoom with the same `+ − 0` keys and the same toolbar minus 1:1/rotate. Ladder `[10, 11, 12, 13, 14, 16, 18, 20, 24]` px, base 12 (`text-xs`). Use an inline `style={{fontSize}}`, since a CSS transform would break wrapping and scroll. |
| pdf | Keep the native viewer. WKWebView's PDF `<embed>` has its own pinch/⌘+ zoom, and CSS-transforming a plugin `<embed>` blurs it and breaks hit-testing [ASSUMED]. Show only Download + Open-external (most useful for PDFs). |
| video / audio | Native controls. Download + Open-external only. Don't intercept ←/→ while the media element is focused (it seeks). |

## Common Pitfalls
1. **Drag-release closes the modal.** If pointerdown lands on the image and pointerup on the backdrop, `click` fires on the common ancestor (the overlay), and its `onClick={onClose}` runs. Close only when the pointerdown *also* started on the backdrop (`downTarget === e.currentTarget`). Also suppress the click after a drag of more than 3px.
2. **Passive wheel.** Using React `onWheel` makes `preventDefault` a no-op, so the page magnifies. Use a native listener with `{passive:false}`.
3. **Natural size before load.** `naturalWidth` is 0 until `onLoad`. Disable controls and skip fit until it is known. If the blob changes (navigation), the `key` remount resets it.
4. **Rotation swaps fit dims.** At 90°/270°, fit and clamp must use (h, w). Re-fit after rotating.
5. **Blur from `will-change: transform`.** WebKit rasterises the layer at the scale it had when promoted, so the image looks soft when zoomed [ASSUMED]. Apply `will-change` only during an active gesture or animation, or not at all.
6. **Double-applied pinch.** Ignore ctrl-wheel while a gesture is active (see above).
7. **Key conflicts.** Arrows must pan only when `scale > fit + ε`. Media elements and the Peek panel's `useHotkeys('escape')` both listen on document, and Esc closing both the viewer and the peek panel is existing behaviour (don't regress it). Match `e.key`, not `e.code`, so `+` works across layouts.
8. **Silent opener failure** (existing): `.catch(() => undefined)` hides the missing `allow-open-path`. Surface the error.

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest 4 + jsdom 29 + @testing-library/react 16 (app dir `taskflow/`) |
| Quick run | `cd taskflow && npx vitest run src/lib/image-viewer.test.ts src/components/app/ImageViewer.test.tsx` |
| Full suite | `cd taskflow && npm test` (also runs in the pre-commit hook; put RED and GREEN in one commit) |

- **Pure reducer (most of the coverage):** zoomAt keeps the cursor point fixed; clamp centres small content and bounds large content; fit with a rotation swap; never upscales past 1; ladder next/prev; min/max clamp; double-click toggle; `mode:'fit'` re-fits on a stage resize.
- **Component (jsdom):** the global `ResizeObserver` mock in `src/test/setup.ts` delivers a **600×400** contentRect synchronously, so read the stage size from `contentRect`, not `clientWidth`. Stub the natural size with `Object.defineProperty(img, 'naturalWidth', {value: 1200})` plus `fireEvent.load(img)`. Assert the readout text (e.g. fit 50% → `+` → 67%), the `style.transform` string, keyboard `+ − 0 1 r`, arrows navigate at fit and don't navigate when zoomed, Esc closes, readout resets on `rerender` with a new key, `fireEvent.wheel(stage, {ctrlKey:true, deltaY:-100})`, a synthetic `gesturechange` (`Object.assign(new Event('gesturechange'), {scale:2, clientX, clientY})`), and that a drag ending on the backdrop does not close.
- Mock `useAuthBlob` (or `@tauri-apps/plugin-http`) the way existing AuthImage consumers do. Existing tests in `WikiRenderer.test.tsx` and `AioTestRunsSection.test.tsx` open `ImageLightbox`: keep `role="dialog"` and the alt-based `aria-label`. Check before renaming "Close lightbox" (`grep -rn "Close lightbox" src`; no tests reference it today).
- **Manual-only:** real trackpad pinch, ⌘/ctrl+wheel, sharpness at 800%, and Open-external launching Preview in `npm run tauri dev`.
- **Wave 0 gaps:** `src/lib/image-viewer.test.ts` and `src/components/app/ImageViewer.test.tsx` are new. No framework install is needed.

## Package Legitimacy Audit
No packages will be installed. `react-zoom-pan-pinch` was inspected via `npm pack` and rejected, and `yet-another-react-lightbox` was rejected. Uses the existing `@tauri-apps/plugin-opener@2.5.3` (`openPath`, `revealItemInDir`) and lucide icons.

## Security Domain
- V5 input: the filename passed to `save_attachment` is already sanitised in Rust (`Path::file_name`). Keep the `allow-open-path` scope to `$DOWNLOAD/**`/`$TEMP/**`, never `**`. `openPath` launches whatever handler the OS has for the extension, so only open files the app itself wrote.
- No new network surface: bytes come from the existing `useAuthBlob` blob.

## Assumptions Log
| # | Claim | Risk if wrong |
|---|---|---|
| A1 | The WKWebView in Tauri fires ctrl-wheel and/or `gesture*` for pinch | Pinch does nothing. Mitigated by handling both paths and a hardware probe |
| A2 | `openPath` is currently rejected (no `allow-open-path`) | Low. The capability is needed either way. Confirm by logging the error |
| A3 | `will-change` blur, PDF-embed transform issues | Cosmetic. Verify at UAT |
| A4 | Zoom ladder, wheel k, fit-never-upscales conventions | UX tuning only |
| A5 | `globalThis.fetch(blob:)` works in WKWebView for re-reading bytes | Fallback: expose the `Blob` from `useAuthBlob`, or re-fetch through the existing `handleDownload` path |

## Sources
- Codebase: `AttachmentPreviewModal.tsx`, `ImageLightbox.tsx`, `AuthImage.tsx`, `useAuthBlob.ts`, `AttachmentsSection.tsx:72-94`, `src-tauri/src/lib.rs:35`, `src-tauri/capabilities/default.json`, `src-tauri/gen/schemas/acl-manifests.json` (opener default set), `src/test/setup.ts:53`, `vite.config.ts:37` (React Compiler)
- npm registry: react-zoom-pan-pinch 4.2.0 (dist inspected), yet-another-react-lightbox 3.33.0
- [yarl Zoom plugin docs](https://yet-another-react-lightbox.com/plugins/zoom): defaults and keyboard map
- [Tauri opener plugin](https://v2.tauri.app/plugin/opener/): `allow-open-path` scope syntax
- [Dan Burzo, "Pinch me, I'm zooming"](https://danburzo.ro/dom-gestures/): Safari gesture events vs ctrl-wheel (WebKit #225788)
- [react-zoom-pan-pinch releases](https://github.com/BetterTyped/react-zoom-pan-pinch/releases)

**Valid until:** 2026-12-05
