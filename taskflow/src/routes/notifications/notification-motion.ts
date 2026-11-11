/** Motion timing for the notification panel (261111-m0g). Keep in sync with index.css `notif-*`. */

/** Arrival-while-open slide-in. */
export const NOTIF_ENTER_MS = 450;
/** Clear: the card slides out for this long, then the row collapses its height. */
export const NOTIF_SLIDE_MS = 200;
/** Clear: total time before the items are actually removed from the store. */
export const NOTIF_EXIT_MS = 500;
/** Stack Clear: delay between consecutive cards sliding out. */
export const NOTIF_STACK_STAGGER_MS = 50;
/** Clear all: delay between consecutive cards sliding out, and the cap on the last one. */
export const NOTIF_CLEAR_ALL_STAGGER_MS = 30;
export const NOTIF_CLEAR_ALL_MAX_DELAY_MS = 240;
export const NOTIF_FLASH_MS = 500;
export const NOTIF_FAN_MS = 450;
/** Group open: rows grow from 0 (cards unfold down, staggered). Group close: rows fold up. */
export const NOTIF_UNFOLD_MS = 300;
export const NOTIF_FOLD_MS = 260;
/** Symmetric ease-in-out so group open/close starts and lands softly (no abrupt start/stop). */
export const NOTIF_GROUP_EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';
/** A collapsed stack row is this much taller than the open group's top card (StackCard pb-3). */
export const NOTIF_STACK_EXTRA_PX = 12;

/** A missing matchMedia (jsdom) means motion is allowed. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Horizontal trackpad swipe (two fingers to the right) that closes the open panel. */
export const NOTIF_SWIPE_CLOSE_PX = 40;
/** The gesture must be this much more horizontal than vertical (summed over the gesture). */
export const NOTIF_SWIPE_DOMINANCE = 1.5;
/** A pause this long between wheel events ends the gesture (momentum events arrive faster). */
export const NOTIF_SWIPE_IDLE_MS = 200;

export interface WheelLike {
  deltaX: number;
  deltaY: number;
  timeStamp: number;
}

/**
 * Tracks one wheel gesture and returns true exactly once when it has travelled
 * NOTIF_SWIPE_CLOSE_PX to the right while staying clearly horizontal. A two-finger swipe right
 * on a macOS trackpad reports negative deltaX. Direction is judged over the WHOLE gesture, not per
 * event: real swipes are never perfectly level, and dropping each slightly diagonal event made
 * short or diagonal swipes miss the threshold (261111-m0g UAT "sometimes doesn't work"). Trailing
 * momentum of a fired gesture cannot fire it again until the gesture goes idle.
 */
export function createSwipeRightTracker(
  threshold = NOTIF_SWIPE_CLOSE_PX,
  idleMs = NOTIF_SWIPE_IDLE_MS,
  dominance = NOTIF_SWIPE_DOMINANCE,
): (e: WheelLike) => boolean {
  let right = 0;
  let vertical = 0;
  let lastAt = Number.NEGATIVE_INFINITY;
  let fired = false;
  return (e) => {
    if (e.timeStamp - lastAt > idleMs) {
      right = 0;
      vertical = 0;
      fired = false;
    }
    lastAt = e.timeStamp;
    if (fired) return false;
    right -= e.deltaX;
    vertical += Math.abs(e.deltaY);
    if (right < threshold || right < vertical * dominance) return false;
    fired = true;
    return true;
  };
}
