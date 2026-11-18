import { useCallback } from 'react';

/** Nearest ancestor that scrolls vertically, or null. */
export function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return null;
}

/**
 * Callback ref for a `sticky bottom-0` strip whose height can change (the comment
 * composer expanding on focus). When it grows, the scroll position stays put, so the
 * strip covers the content just above it and a bottom-scrolled view is no longer at
 * the bottom. Scrolling the container by the growth keeps both in place.
 */
export function useKeepContentAboveSticky() {
  return useCallback((el: HTMLElement | null) => {
    if (!el) return;
    let prev = el.offsetHeight;
    const ro = new ResizeObserver(() => {
      const height = el.offsetHeight;
      const delta = height - prev;
      prev = height;
      if (delta > 0) scrollParent(el)?.scrollBy({ top: delta });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
}
