import { useEffect, useRef } from 'react';

/**
 * Escape closes the topmost preview overlay — and only it.
 *
 * Registered on `window` in the capture phase so it runs before every
 * document-level handler (an underlying Base UI sheet/dialog, the app's
 * FULLSCREEN-ESC-01 guard in main.tsx). It:
 *  - preventDefault()s, so WKWebView doesn't fall through to macOS
 *    `cancelOperation:` and exit native fullscreen;
 *  - stops propagation, so a sheet the preview was opened from stays open.
 */
export function usePreviewEscape(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open]);
}
