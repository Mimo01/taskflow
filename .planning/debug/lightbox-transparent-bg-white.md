---
status: resolved
trigger: "On issue detail page when I open an image in a lighbox and the image has transparent bg, it should get a white background"
created: 2026-05-25
updated: 2026-05-25
---

## Symptoms

- **Expected:** White background behind image — the lightbox should render a solid white background so transparent areas appear white, not see-through.
- **Actual:** Nothing behind transparent areas — transparent pixels are fully transparent, you see whatever is beneath the lightbox.
- **Error messages:** None reported.
- **Timeline:** Always been this way — lightbox never applied a white background to transparent images.
- **Reproduction:** Open issue detail page, click an image with transparent background to open it in the lightbox.

## Current Focus

hypothesis: AuthImage rendered directly inside the dark overlay div — no bg-white wrapper exists anywhere in the rendering tree behind the image
test: ~
expecting: ~
next_action: complete
reasoning_checkpoint: Transparent pixels composite against the black overlay (bg-black/80). Adding bg-white wrapper div around AuthImage in both lightboxes gives transparent areas a white background.

## Evidence

- timestamp: 2026-05-25
  file: taskflow/src/routes/dashboard/ImageLightbox.tsx
  observation: AuthImage placed directly inside overlay div with no background. onClick stopPropagation was on AuthImage itself, not a wrapper.

- timestamp: 2026-05-25
  file: taskflow/src/routes/dashboard/issue-detail/AttachmentLightbox.tsx
  observation: AuthImage placed inside flex column container with no background. Same pattern — no bg-white anywhere in image subtree.

## Eliminated

- CSS on AuthImage itself: object-contain only controls sizing, has no background effect
- The overlay bg-black/80: this is what transparent pixels show through to — it is the problem, not a fix candidate

## Resolution

root_cause: Both ImageLightbox and AttachmentLightbox render AuthImage without any background wrapper. Transparent pixels composite directly against the dark overlay (bg-black/80), making transparency visible.
fix: Wrapped AuthImage in a `<div className="bg-white rounded-lg">` in both lightbox components. The white div sits between the dark overlay and the image, so transparent areas render as white.
verification: Open a transparent PNG in the lightbox on the issue detail page — transparent regions should now appear white.
files_changed:
  - taskflow/src/routes/dashboard/ImageLightbox.tsx
  - taskflow/src/routes/dashboard/issue-detail/AttachmentLightbox.tsx
