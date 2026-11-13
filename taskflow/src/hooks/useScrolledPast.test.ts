import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrolledPast } from './useScrolledPast';

type Cb = (entries: IntersectionObserverEntry[]) => void;
let instances: FakeIO[] = [];

class FakeIO {
  cb: Cb;
  disconnected = false;
  constructor(cb: Cb) {
    this.cb = cb;
    instances.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
}

function entry(p: { isIntersecting: boolean; bottom: number }): IntersectionObserverEntry {
  return {
    isIntersecting: p.isIntersecting,
    boundingClientRect: { bottom: p.bottom, top: p.bottom - 10 },
    rootBounds: { top: 100, bottom: 600 },
  } as unknown as IntersectionObserverEntry;
}

describe('useScrolledPast', () => {
  beforeEach(() => {
    instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIO);
  });
  afterEach(() => vi.unstubAllGlobals());

  const root = document.createElement('div');
  const target = document.createElement('h2');

  it('is true when the target is above the root top', () => {
    const { result } = renderHook(() => useScrolledPast(root, target));
    expect(result.current).toBe(false);
    act(() => instances[0].cb([entry({ isIntersecting: false, bottom: 50 })]));
    expect(result.current).toBe(true);
  });

  it('is false when below the fold', () => {
    const { result } = renderHook(() => useScrolledPast(root, target));
    act(() => instances[0].cb([entry({ isIntersecting: false, bottom: 800 })]));
    expect(result.current).toBe(false);
  });

  it('is false when intersecting', () => {
    const { result } = renderHook(() => useScrolledPast(root, target));
    act(() => instances[0].cb([entry({ isIntersecting: true, bottom: 150 })]));
    expect(result.current).toBe(false);
  });

  it('is false without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { result } = renderHook(() => useScrolledPast(root, target));
    expect(result.current).toBe(false);
  });

  it('is false with null root or target', () => {
    const a = renderHook(() => useScrolledPast(null, target));
    const b = renderHook(() => useScrolledPast(root, null));
    expect(a.result.current).toBe(false);
    expect(b.result.current).toBe(false);
    expect(instances).toHaveLength(0);
  });

  it('disconnects on unmount', () => {
    const { unmount } = renderHook(() => useScrolledPast(root, target));
    unmount();
    expect(instances[0].disconnected).toBe(true);
  });

  it('resets to false when resetKey changes', () => {
    const { result, rerender } = renderHook(({ k }) => useScrolledPast(root, target, k), {
      initialProps: { k: 'A' },
    });
    act(() => instances[0].cb([entry({ isIntersecting: false, bottom: 50 })]));
    expect(result.current).toBe(true);
    rerender({ k: 'B' });
    expect(result.current).toBe(false);
  });
});
