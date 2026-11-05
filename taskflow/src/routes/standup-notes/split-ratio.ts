/** Pure helpers for the Standup Yesterday|Today percentage split. */

/** Each pane keeps at least this many px. */
export const MIN_PANE_PX = 320;
export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;
export const DEFAULT_SPLIT_RATIO = 0.5;

/** Clamp a left-pane ratio to the allowed bounds for the given container width. */
export function clampSplitRatio(ratio: number, containerPx: number): number {
  if (!Number.isFinite(ratio) || !Number.isFinite(containerPx) || containerPx <= 0) {
    return DEFAULT_SPLIT_RATIO;
  }
  const lower = Math.max(MIN_SPLIT_RATIO, MIN_PANE_PX / containerPx);
  const upper = Math.min(MAX_SPLIT_RATIO, 1 - MIN_PANE_PX / containerPx);
  if (lower > upper) return DEFAULT_SPLIT_RATIO;
  return Math.max(lower, Math.min(upper, ratio));
}

/** Convert a left-pane px width into a clamped ratio of the container. */
export function pxToSplitRatio(px: number, containerPx: number): number {
  if (!Number.isFinite(containerPx) || containerPx <= 0) return DEFAULT_SPLIT_RATIO;
  return clampSplitRatio(px / containerPx, containerPx);
}
