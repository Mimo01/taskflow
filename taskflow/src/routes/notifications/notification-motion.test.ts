import { describe, expect, it } from 'vitest';
import {
  createSwipeRightTracker,
  NOTIF_COLLAPSE_FRAMES_MS,
  NOTIF_COLLAPSE_MS,
  NOTIF_EXIT_MS,
  NOTIF_SLIDE_MS,
} from './notification-motion';

const ev = (deltaX: number, timeStamp: number, deltaY = 0) => ({ deltaX, deltaY, timeStamp });

describe('createSwipeRightTracker', () => {
  it('fires once a rightward swipe (negative deltaX) travels the threshold', () => {
    const track = createSwipeRightTracker(60, 200);
    expect(track(ev(-25, 0))).toBe(false);
    expect(track(ev(-25, 16))).toBe(false);
    expect(track(ev(-25, 32))).toBe(true);
  });

  it('a slightly diagonal swipe with vertical-heavy first/last events still fires', () => {
    // Real trackpad swipe: starts and ends with events where |deltaY| >= |deltaX|.
    const track = createSwipeRightTracker(40, 200, 1.5);
    expect(track(ev(-3, 0, 4))).toBe(false);
    expect(track(ev(-6, 8, 6))).toBe(false);
    expect(track(ev(-14, 16, 3))).toBe(false);
    expect(track(ev(-18, 24, 2))).toBe(true);
  });

  it('a mostly-vertical scroll with steady sideways drift never fires', () => {
    const track = createSwipeRightTracker(40, 200, 1.5);
    for (let t = 0; t < 600; t += 16) expect(track(ev(-12, t, 30))).toBe(false);
  });

  it('ignores leftward swipes', () => {
    const track = createSwipeRightTracker(60, 200);
    for (let t = 0; t < 200; t += 16) expect(track(ev(40, t))).toBe(false);
  });

  it('ignores vertical-dominant scrolling with some sideways drift', () => {
    const track = createSwipeRightTracker(60, 200);
    for (let t = 0; t < 200; t += 16) expect(track(ev(-10, t, -40))).toBe(false);
  });

  it('does not fire again on trailing momentum of the same gesture', () => {
    const track = createSwipeRightTracker(60, 200);
    expect(track(ev(-70, 0))).toBe(true);
    for (let t = 16; t < 400; t += 16) expect(track(ev(-30, t))).toBe(false);
  });

  it('a new gesture after an idle pause can fire again', () => {
    const track = createSwipeRightTracker(60, 200);
    expect(track(ev(-70, 0))).toBe(true);
    expect(track(ev(-70, 500))).toBe(true);
  });

  it('a gesture that idles out before the threshold starts over', () => {
    const track = createSwipeRightTracker(60, 200);
    expect(track(ev(-40, 0))).toBe(false);
    expect(track(ev(-40, 400))).toBe(false);
    expect(track(ev(-30, 416))).toBe(true);
  });
});

describe('exit timing (WR-04)', () => {
  it('the store removal outlasts the slide-out, the two pin frames and the height collapse', () => {
    expect(NOTIF_EXIT_MS).toBeGreaterThanOrEqual(
      NOTIF_SLIDE_MS + NOTIF_COLLAPSE_FRAMES_MS + NOTIF_COLLAPSE_MS,
    );
  });
});
