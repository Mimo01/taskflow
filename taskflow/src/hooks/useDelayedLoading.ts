import { useEffect, useRef, useState } from 'react';

/**
 * Returns true only after `delayMs` (default 200ms) of continuous pending state.
 * Prevents skeleton flash on fast loads — if data resolves within the delay window,
 * the skeleton is never shown.
 *
 * @param isPending — true when data is loading
 * @param delayMs — how long to wait before showing skeleton (default 200ms)
 */
export function useDelayedLoading(isPending: boolean, delayMs = 200): boolean {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPending) {
      timerRef.current = setTimeout(() => setShowSkeleton(true), delayMs);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setShowSkeleton(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPending, delayMs]);

  return showSkeleton;
}
