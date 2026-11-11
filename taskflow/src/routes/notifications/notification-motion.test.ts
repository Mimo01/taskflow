import { describe, expect, it } from 'vitest';
import { createSwipeRightTracker } from './notification-motion';

const ev = (deltaX: number, timeStamp: number, deltaY = 0) => ({ deltaX, deltaY, timeStamp });

describe('createSwipeRightTracker', () => {
  it('fires once a rightward swipe (negative deltaX) travels the threshold', () => {
    const track = createSwipeRightTracker(60, 200);
    expect(track(ev(-25, 0))).toBe(false);
    expect(track(ev(-25, 16))).toBe(false);
    expect(track(ev(-25, 32))).toBe(true);
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
