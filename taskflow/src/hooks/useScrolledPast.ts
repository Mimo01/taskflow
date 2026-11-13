import { useEffect, useState } from 'react';

/**
 * True only while `target` is scrolled out of view ABOVE the top edge of `root`
 * (not when it is merely below the fold). Starts false and resets to false whenever
 * root / target / resetKey change, so a late-mounting target (after a skeleton) never
 * flashes the wrong state: the first observer entry decides.
 * Returns false when IntersectionObserver is unavailable (jsdom).
 */
export function useScrolledPast(
  root: HTMLElement | null,
  target: HTMLElement | null,
  resetKey?: unknown,
): boolean {
  const [past, setPast] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey intentionally re-arms the observer
  useEffect(() => {
    setPast(false);
    if (typeof IntersectionObserver === 'undefined' || !root || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        setPast(!e.isIntersecting && e.boundingClientRect.bottom <= (e.rootBounds?.top ?? 0));
      },
      { root, threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [root, target, resetKey]);

  return past;
}
