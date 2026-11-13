import { type UIEvent, useEffect, useState } from 'react';

/**
 * Header condense state driven by a scroller's `onScroll`. Hysteresis (condense past 16px,
 * expand only back near the top, <= 4px) so the header's own height change can never flip it
 * back and forth. `resetKey` re-expands the header when the page swaps content.
 *
 * `minOverflow`: pages whose header has a tall collapsible slot would, on short content, grow
 * the scroller when condensing, get their scrollTop clamped and expand again (a loop). Condensing
 * additionally requires the scroller to overflow by more than this many pixels.
 */
export function useCompactOnScroll(resetKey: unknown, { minOverflow = 0 } = {}) {
  const [compact, setCompact] = useState(false);
  const onScroll = (e: UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const top = el.scrollTop;
    const overflow = el.scrollHeight - el.clientHeight;
    setCompact((c) => (c ? top > 4 : top > 16 && overflow > minOverflow));
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey intentionally resets on content swap
  useEffect(() => {
    setCompact(false);
  }, [resetKey]);
  return [compact, onScroll] as const;
}
