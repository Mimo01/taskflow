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

/** Horizontal trackpad swipe (two fingers to the right) that closes the open panel. */
export const NOTIF_SWIPE_CLOSE_PX = 60;
/** A pause this long between wheel events ends the gesture (momentum events arrive faster). */
export const NOTIF_SWIPE_IDLE_MS = 200;

export interface WheelLike {
  deltaX: number;
  deltaY: number;
  timeStamp: number;
}

/**
 * Tracks one horizontal wheel gesture and returns true exactly once when it has travelled
 * NOTIF_SWIPE_CLOSE_PX to the right. Two-finger swipe right on a macOS trackpad reports
 * negative deltaX. Vertical-dominant events (list scrolling) are ignored, and the trailing
 * momentum of a fired gesture cannot fire it again until the gesture goes idle.
 */
export function createSwipeRightTracker(
  threshold = NOTIF_SWIPE_CLOSE_PX,
  idleMs = NOTIF_SWIPE_IDLE_MS,
): (e: WheelLike) => boolean {
  let travelled = 0;
  let lastAt = Number.NEGATIVE_INFINITY;
  let fired = false;
  return (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return false;
    if (e.timeStamp - lastAt > idleMs) {
      travelled = 0;
      fired = false;
    }
    lastAt = e.timeStamp;
    if (fired) return false;
    travelled = Math.max(0, travelled - e.deltaX);
    if (travelled < threshold) return false;
    fired = true;
    return true;
  };
}
