/** Motion timing for the notification panel (261111-m0g). Keep in sync with index.css `notif-*`. */

/** Open stagger step between rows, and how many rows stagger at all. */
export const NOTIF_STAGGER_MS = 35;
export const NOTIF_INTRO_MAX = 12;
/** How long `intro` stays on after the panel opens or the filter changes. */
export const NOTIF_INTRO_WINDOW_MS = 700;
/** Arrival-while-open slide-in. */
export const NOTIF_ENTER_MS = 450;
/** Clear: the card slides out for this long, then the row collapses its height. */
export const NOTIF_SLIDE_MS = 200;
/** Clear: total time before the items are actually removed from the store. */
export const NOTIF_EXIT_MS = 500;
/** Stack Clear: delay between consecutive cards sliding out. */
export const NOTIF_STACK_STAGGER_MS = 50;
export const NOTIF_FLASH_MS = 500;
export const NOTIF_FAN_MS = 450;

/** A missing matchMedia (jsdom) means motion is allowed. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
