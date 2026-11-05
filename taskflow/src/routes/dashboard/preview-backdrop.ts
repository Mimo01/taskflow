/**
 * Empty space inside a preview overlay (the image stage around the picture,
 * layout wrappers) is marked with this attribute so clicking it closes the
 * preview just like the dark backdrop. Content (image, text, toolbar,
 * buttons) is never marked, so clicks on it never close.
 */
export const BACKDROP_ATTR = { 'data-preview-backdrop': 'true' } as const;

export function isBackdropTarget(target: EventTarget | null, overlay: EventTarget): boolean {
  if (target === overlay) return true;
  return target instanceof HTMLElement && target.dataset.previewBackdrop === 'true';
}
